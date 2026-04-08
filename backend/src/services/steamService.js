/**
 * steamService.js
 *
 * Responsibilities:
 *   - Resolve Steam vanity URL / raw SteamID64 → canonical SteamID64
 *   - Fetch owned games from Steam GetOwnedGames
 *   - Enrich top games with RAWG genre/tag data (best-effort, non-blocking)
 *   - Return array of normalized library items ready for addToLibrary
 *
 * Steam API calls never happen on frontend render — only on explicit user action.
 */

import axios from 'axios';
import { searchGames } from './rawgService.js';

// ─── Steam HTTP client ────────────────────────────────────────────────────────

const steam = axios.create({
  baseURL: 'https://api.steampowered.com',
  timeout: 15000,
});

// ─── Constants ────────────────────────────────────────────────────────────────

const STEAM_CDN = 'https://cdn.akamai.steamstatic.com/steam/apps';
const ENRICH_LIMIT = 50; // only enrich top N games by playtime to respect RAWG rate limits

// ─── ID resolution ────────────────────────────────────────────────────────────

/**
 * Parse whatever the user typed and return a { type, value } descriptor.
 * type: 'steamid' | 'vanity'
 */
function parseInput(input) {
  const s = input.trim();

  // Full URL: https://steamcommunity.com/profiles/76561198xxxxxxxxx
  const profileMatch = s.match(/steamcommunity\.com\/profiles\/(\d{15,20})/);
  if (profileMatch) return { type: 'steamid', value: profileMatch[1] };

  // Full URL: https://steamcommunity.com/id/somevanity
  const vanityMatch = s.match(/steamcommunity\.com\/id\/([^/?\s]+)/);
  if (vanityMatch) return { type: 'vanity', value: vanityMatch[1] };

  // Raw SteamID64 (17-digit number)
  if (/^\d{15,20}$/.test(s)) return { type: 'steamid', value: s };

  // Assume everything else is a vanity URL slug
  return { type: 'vanity', value: s };
}

/**
 * Resolve a vanity URL to a SteamID64.
 * Returns null if the vanity URL is not found.
 */
async function resolveVanityUrl(vanity) {
  const { data } = await steam.get('/ISteamUser/ResolveVanityURL/v1/', {
    params: {
      key:       process.env.STEAM_API_KEY,
      vanityurl: vanity,
    },
  });
  // success: 1 = found, 42 = no match
  if (data?.response?.success !== 1) return null;
  return data.response.steamid;
}

/**
 * Given raw user input, resolve to a SteamID64 string.
 * Throws a descriptive error on failure.
 */
export async function resolveSteamId(input) {
  const parsed = parseInput(input);

  if (parsed.type === 'steamid') return parsed.value;

  const resolved = await resolveVanityUrl(parsed.value);
  if (!resolved) {
    const err = new Error('Steam profile not found. Check the URL or custom ID and try again.');
    err.statusCode = 404;
    throw err;
  }
  return resolved;
}

// ─── Owned games fetch ────────────────────────────────────────────────────────

/**
 * Fetch all owned games for a given SteamID64.
 * Returns an array of raw Steam game objects:
 *   { appid, name, playtime_forever, img_icon_url, img_logo_url }
 *
 * Throws if the profile is private or the API key is invalid.
 */
export async function fetchOwnedGames(steamId) {
  const { data } = await steam.get('/IPlayerService/GetOwnedGames/v1/', {
    params: {
      key:              process.env.STEAM_API_KEY,
      steamid:          steamId,
      include_appinfo:  1,
      include_played_free_games: 1,
      format:           'json',
    },
  });

  const response = data?.response;

  // Private profile — Steam returns an empty response object
  if (!response || !response.games) {
    const err = new Error('This Steam profile is private. Set your game details to public and try again.');
    err.statusCode = 403;
    err.code = 'profile_private';
    throw err;
  }

  return response.games ?? [];
}

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Build the Steam CDN header image URL for a game.
 * Falls back to the icon URL if neither header nor logo is available.
 */
function steamImageUrl(appId) {
  // Steam header images are always available at this path for store games
  return `${STEAM_CDN}/${appId}/header.jpg`;
}

/**
 * Convert a raw Steam game + optional RAWG enrichment into a Lumium library item.
 * Shape is compatible with the existing libraryItemSchema and normalizeGame().
 */
function normalizeSteamGame(steamGame, rawgData = null) {
  const appId      = String(steamGame.appid);
  const title      = steamGame.name ?? `Steam App ${appId}`;
  const imageUrl   = steamImageUrl(appId);
  const playtime   = steamGame.playtime_forever ?? 0; // minutes

  return {
    id:         `game_steam_${appId}`,
    externalId: `steam_${appId}`,
    source:     'steam',
    type:       'game',
    title,
    imageUrl,
    image:      imageUrl,
    rating:     rawgData?.rating ?? null,
    genres:     [],
    tags:       rawgData?.tags ?? [],
    rawId:      rawgData ? String(rawgData.id) : undefined,
    emoji:      '🎮',
    metadata: {
      steamAppId:   appId,
      playtime,                            // minutes — used for recommendation weighting
      rawgId:       rawgData?.id ?? null,
      rawgEnriched: rawgData !== null,
    },
    addedAt: new Date().toISOString(),
  };
}

// ─── RAWG enrichment ──────────────────────────────────────────────────────────

/**
 * Slugify a game title for comparison: lowercase, remove special chars, collapse spaces.
 */
function slug(name) {
  return name.toLowerCase().replace(/[™®:–—''".!?,]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Attempt to find a RAWG match for a game by name.
 * Returns the first RAWG result if the normalized title closely matches; else null.
 */
async function findRawgMatch(title) {
  try {
    const results = await searchGames(title, 3);
    if (!results.length) return null;

    const target = slug(title);
    const best   = results[0];
    const candidate = slug(best.name ?? '');

    // Accept if exact match or one contains the other
    if (candidate === target || candidate.includes(target) || target.includes(candidate)) {
      return best;
    }
    return null;
  } catch {
    return null; // enrichment is best-effort — never block import
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Full import pipeline:
 *   1. Resolve SteamID64
 *   2. Fetch owned games
 *   3. Enrich top ENRICH_LIMIT games by playtime with RAWG data
 *   4. Normalize all games into Lumium library items
 *
 * Returns:
 *   { steamId, games: LibraryItem[], enrichedCount, totalCount }
 */
export async function importSteamLibrary(input) {
  const steamId = await resolveSteamId(input);
  const rawGames = await fetchOwnedGames(steamId);

  if (rawGames.length === 0) {
    return { steamId, games: [], enrichedCount: 0, totalCount: 0 };
  }

  // Sort by playtime descending so we enrich the most-played games first
  const sorted = [...rawGames].sort((a, b) => (b.playtime_forever ?? 0) - (a.playtime_forever ?? 0));

  // Split into games to enrich vs. games to import raw
  const toEnrich = sorted.slice(0, ENRICH_LIMIT);
  const rawOnly  = sorted.slice(ENRICH_LIMIT);

  // Enrich sequentially with a small delay to be polite to RAWG
  let enrichedCount = 0;
  const enrichedGames = [];

  for (let i = 0; i < toEnrich.length; i++) {
    const g = toEnrich[i];
    const rawgData = await findRawgMatch(g.name);
    if (rawgData) enrichedCount++;
    enrichedGames.push(normalizeSteamGame(g, rawgData));

    // Small stagger between RAWG calls to avoid rate-limit bursts
    if (i < toEnrich.length - 1) {
      await new Promise(r => setTimeout(r, 120));
    }
  }

  const rawOnlyNormalized = rawOnly.map(g => normalizeSteamGame(g, null));

  return {
    steamId,
    games:         [...enrichedGames, ...rawOnlyNormalized],
    enrichedCount,
    totalCount:    rawGames.length,
  };
}
