import api from './api';
import { getToken } from './tokenStore';

/**
 * steamService.js (frontend)
 *
 * Covers all Steam-related frontend ↔ backend calls:
 *   - importLibrary : POST /api/steam/import      (existing)
 *   - connect       : redirect to Steam OpenID    (new)
 *   - disconnect    : POST /api/auth/steam/disconnect (new)
 *   - refreshProfile: GET  /api/steam/profile     (stub — future)
 *
 * Never called on render. Only called on explicit user action.
 */

// Base URL for redirect (bypasses Vite proxy — we need the real server URL).
// Falls back to the current origin + /api for SSR safety (unused in this app).
const BACKEND_API =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api';

export const steamService = {
  /**
   * Import a user's Steam library.
   * @param {string} steamInput — Steam profile URL, SteamID64, or vanity slug
   * @returns {{ imported, skipped, totalFetched, enrichedCount, steamId, library }}
   */
  importLibrary: (steamInput) =>
    api.post('/steam/import', { steamInput }).then(r => r.data),

  /**
   * Initiate Steam OpenID account linking.
   * Reads the current JWT from tokenStore and redirects the browser to the
   * backend Steam login handler, which drives the OpenID flow.
   * On return, the backend redirects to CLIENT_URL?steam=connected|error.
   */
  connect() {
    const token = getToken();
    if (!token) throw new Error('Must be logged in to connect Steam');
    window.location.href =
      `${BACKEND_API}/auth/steam/login?token=${encodeURIComponent(token)}`;
  },

  /**
   * Unlink Steam from the current user account.
   * @returns {{ ok: true }}
   */
  disconnect: () =>
    api.post('/auth/steam/disconnect').then(r => r.data),

  // ── Future actions (not yet implemented on backend) ───────────────────────

  /**
   * Refresh the user's Steam persona name + avatar from Steam API.
   * @returns {{ personaName, avatarUrl }}
   */
  // refreshProfile: () => api.post('/steam/refresh-profile').then(r => r.data),
};
