import api from './api';
import { getToken } from './tokenStore';

/**
 * steamService.js (frontend)
 *
 * All Steam-related frontend ↔ backend calls.
 * Never called on render. Only called on explicit user action.
 */

// Base URL for redirect — bypasses Vite proxy since we need the real server URL.
const BACKEND_API =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api';

export const steamService = {
  // ── Library import (manual steamInput — legacy, kept for ProfilePage form) ──

  /**
   * Import a Steam library by URL / SteamID64 / vanity slug.
   * @param {string} steamInput
   */
  importLibrary: (steamInput) =>
    api.post('/steam/import', { steamInput }).then(r => r.data),

  // ── Auto-sync (uses steamId stored from OpenID connection) ───────────────────

  /**
   * Sync library using the steamId already linked via OpenID — no manual input.
   * Requires the user to have completed the Steam connect flow first.
   */
  syncLibrary: () =>
    api.post('/steam/sync-library').then(r => r.data),

  /**
   * Fetch and store recently played games (GetRecentlyPlayedGames).
   * Returns { recent: SteamRecentGame[], count, steamId }
   */
  syncRecent: () =>
    api.post('/steam/sync-recent').then(r => r.data),

  // ── Read endpoints ────────────────────────────────────────────────────────────

  /**
   * Returns connection status + sync metadata + library/recent counts.
   */
  getProfile: () =>
    api.get('/steam/profile').then(r => r.data),

  /**
   * Returns Steam-sourced library items.
   */
  getLibrary: () =>
    api.get('/steam/library').then(r => r.data),

  /**
   * Returns stored recently played games from last sync-recent call.
   */
  getRecent: () =>
    api.get('/steam/recent').then(r => r.data),

  /**
   * Returns a taste profile derived from the Steam library.
   * { topTags, basedOnOwnedCount, basedOnRecentCount, enrichedCount, confidence }
   */
  getTasteProfile: () =>
    api.get('/steam/taste-profile').then(r => r.data),

  // ── Auth ──────────────────────────────────────────────────────────────────────

  /**
   * Initiate Steam OpenID account linking.
   * Reads the current JWT and redirects the browser to the backend Steam login handler.
   * On return, backend redirects to CLIENT_URL?steam=connected|error.
   */
  connect() {
    const token = getToken();
    if (!token) throw new Error('Must be logged in to connect Steam');
    window.location.href =
      `${BACKEND_API}/auth/steam/login?token=${encodeURIComponent(token)}`;
  },

  /**
   * Unlink Steam from the current user account.
   */
  disconnect: () =>
    api.post('/auth/steam/disconnect').then(r => r.data),
};
