import { importSteamLibrary } from '../services/steamService.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  findUserById,
  pushLibraryItem,
} from '../repositories/userRepository.js';

// ─── POST /api/steam/import ───────────────────────────────────────────────────
//
// Body: { steamInput: string }   — Steam profile URL, SteamID64, or vanity slug
//
// Flow:
//   1. Validate Steam API key is configured
//   2. Run import pipeline (resolve → fetch → enrich → normalize)
//   3. For each normalized game, push to user.library if not already present
//   4. Return { imported, skipped, totalFetched, enrichedCount, steamId }

export const importGames = async (req, res, next) => {
  try {
    if (!process.env.STEAM_API_KEY) {
      throw new AppError('Steam integration is not configured on this server.', 503);
    }

    const { steamInput } = req.body;
    if (!steamInput || typeof steamInput !== 'string' || !steamInput.trim()) {
      throw new AppError('steamInput is required.', 400);
    }

    // Run the full Steam → RAWG pipeline
    const { steamId, games, enrichedCount, totalCount } = await importSteamLibrary(steamInput.trim());

    if (games.length === 0) {
      return res.json({
        imported:      0,
        skipped:       0,
        totalFetched:  0,
        enrichedCount: 0,
        steamId,
        message:       'No games found in this Steam library.',
      });
    }

    // Load current library once, then batch-insert missing items
    const user    = await findUserById(req.user._id);
    const existingIds = new Set(user.library.map(i => i.id));

    let imported = 0;
    let skipped  = 0;

    for (const game of games) {
      if (existingIds.has(game.id)) {
        skipped++;
        continue;
      }
      // Push directly to DB — mirrors pushLibraryItem but we update the set in memory
      // to avoid re-fetching after each insert.
      await pushLibraryItem(req.user._id, game);
      existingIds.add(game.id);
      imported++;
    }

    // Return the authoritative library after all inserts
    const updated = await findUserById(req.user._id);

    res.status(200).json({
      imported,
      skipped,
      totalFetched:  totalCount,
      enrichedCount,
      steamId,
      library:       updated.library,
    });
  } catch (err) {
    // Surface known Steam errors with appropriate HTTP codes
    if (err.statusCode) {
      return next(new AppError(err.message, err.statusCode));
    }

    // Steam API auth failure
    if (err.response?.status === 401 || err.response?.status === 403) {
      return next(new AppError('Steam API key is invalid or not configured.', 503));
    }

    next(err);
  }
};
