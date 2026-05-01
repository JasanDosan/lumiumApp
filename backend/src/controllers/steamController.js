import {
  importSteamLibrary,
  fetchRecentlyPlayedGames,
  normalizeRecentGame,
} from '../services/steamService.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  findUserById,
  pushLibraryItem,
  updateSteamLastSynced,
  setRecentGames,
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

// ─── Helper: run library import for a given steamId ──────────────────────────

async function runLibraryImport(userId, steamId) {
  const { games, enrichedCount, totalCount } = await importSteamLibrary(steamId);

  if (games.length === 0) {
    return { imported: 0, skipped: 0, totalFetched: 0, enrichedCount: 0 };
  }

  const user = await findUserById(userId);
  const existingIds = new Set(user.library.map(i => i.id));

  let imported = 0;
  let skipped  = 0;

  for (const game of games) {
    if (existingIds.has(game.id)) { skipped++; continue; }
    await pushLibraryItem(userId, game);
    existingIds.add(game.id);
    imported++;
  }

  await updateSteamLastSynced(userId);

  return { imported, skipped, totalFetched: totalCount, enrichedCount };
}

// ─── POST /api/steam/sync-library ────────────────────────────────────────────
//
// Auto-sync using the steamId stored from OpenID — no manual input needed.
// Requires user to be connected via Steam OpenID first.

export const syncLibrary = async (req, res, next) => {
  try {
    if (!process.env.STEAM_API_KEY) {
      throw new AppError('Steam integration is not configured on this server.', 503);
    }

    const steamId = req.user.steam?.steamId;
    if (!steamId) {
      throw new AppError('No Steam account connected. Connect Steam first.', 400);
    }

    const result = await runLibraryImport(req.user._id, steamId);
    const updated = await findUserById(req.user._id);

    res.status(200).json({ ...result, steamId, library: updated.library });
  } catch (err) {
    if (err.statusCode) return next(new AppError(err.message, err.statusCode));
    if (err.response?.status === 401 || err.response?.status === 403) {
      return next(new AppError('Steam API key is invalid or not configured.', 503));
    }
    next(err);
  }
};

// ─── POST /api/steam/sync-recent ─────────────────────────────────────────────
//
// Fetch the user's recently played games and store them in user.steamRecentGames.
// Returns the list — up to 20 games active in the last 2 weeks.

export const syncRecent = async (req, res, next) => {
  try {
    if (!process.env.STEAM_API_KEY) {
      throw new AppError('Steam integration is not configured on this server.', 503);
    }

    const steamId = req.user.steam?.steamId;
    if (!steamId) {
      throw new AppError('No Steam account connected. Connect Steam first.', 400);
    }

    const raw = await fetchRecentlyPlayedGames(steamId);
    const normalized = raw.map(normalizeRecentGame);

    await setRecentGames(req.user._id, normalized);

    res.status(200).json({ recent: normalized, count: normalized.length, steamId });
  } catch (err) {
    if (err.statusCode) return next(new AppError(err.message, err.statusCode));
    if (err.response?.status === 401 || err.response?.status === 403) {
      return next(new AppError('Steam API key is invalid or not configured.', 503));
    }
    next(err);
  }
};

// ─── GET /api/steam/profile ───────────────────────────────────────────────────
//
// Returns the user's Steam connection status, sync metadata, and library counts.

export const getProfile = async (req, res, next) => {
  try {
    const steam = req.user.steam;

    if (!steam?.steamId) {
      return res.json({ connected: false });
    }

    const user = await findUserById(req.user._id);
    const steamLibraryCount  = user.library.filter(i => i.source === 'steam').length;
    const recentGamesCount   = user.steamRecentGames?.length ?? 0;

    res.json({
      connected:        true,
      steamId:          steam.steamId,
      personaName:      steam.personaName,
      avatarUrl:        steam.avatarUrl,
      connectedAt:      steam.connectedAt,
      lastSyncedAt:     steam.lastSyncedAt ?? null,
      steamLibraryCount,
      recentGamesCount,
    });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/steam/library ───────────────────────────────────────────────────
//
// Returns only the Steam-sourced items from the user's library.

export const getLibrary = async (req, res, next) => {
  try {
    const user  = await findUserById(req.user._id);
    const items = user.library.filter(i => i.source === 'steam');
    res.json({ items, count: items.length });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/steam/recent ────────────────────────────────────────────────────
//
// Returns stored recently-played games (from last sync-recent call).

export const getRecent = async (req, res, next) => {
  try {
    const user = await findUserById(req.user._id);
    const recent = user.steamRecentGames ?? [];
    res.json({ recent, count: recent.length });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/steam/taste-profile ────────────────────────────────────────────
//
// Derives a lightweight taste profile from the user's Steam library items.
// Uses playtime as a weight signal. Only considers items with RAWG enrichment (tags present).
//
// Returns:
//   { topTags, basedOnOwnedCount, basedOnRecentCount, enrichedCount, confidence }

export const getTasteProfile = async (req, res, next) => {
  try {
    const user = await findUserById(req.user._id);

    const steamItems = user.library.filter(i => i.source === 'steam');
    const recent     = user.steamRecentGames ?? [];

    if (steamItems.length === 0) {
      return res.json({
        topTags:            [],
        basedOnOwnedCount:  0,
        basedOnRecentCount: recent.length,
        enrichedCount:      0,
        confidence:         0,
      });
    }

    // Compute total playtime (cap at 10 000 min per game to avoid Dota-like skew)
    const CAP = 10000;
    const totalPlaytime = steamItems.reduce(
      (sum, i) => sum + Math.min(i.metadata?.playtime ?? 0, CAP), 0
    );

    // Weight each tag by the game's playtime share
    const tagScores = {};
    let enrichedCount = 0;

    for (const item of steamItems) {
      const tags = item.tags ?? [];
      if (tags.length === 0) continue;
      enrichedCount++;

      const playtime = Math.min(item.metadata?.playtime ?? 0, CAP);
      const weight   = totalPlaytime > 0 ? playtime / totalPlaytime : 1 / steamItems.length;

      for (const tag of tags) {
        const name = typeof tag === 'object' ? (tag.name ?? String(tag)) : String(tag);
        tagScores[name] = (tagScores[name] ?? 0) + weight;
      }
    }

    const topTags = Object.entries(tagScores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag]) => tag);

    const confidence = enrichedCount / steamItems.length;

    res.json({
      topTags,
      basedOnOwnedCount:  steamItems.length,
      basedOnRecentCount: recent.length,
      enrichedCount,
      confidence: Math.round(confidence * 100) / 100,
    });
  } catch (err) {
    next(err);
  }
};
