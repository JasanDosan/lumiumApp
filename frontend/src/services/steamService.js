import api from './api';

/**
 * steamService.js (frontend)
 *
 * Thin wrapper around POST /api/steam/import.
 * All Steam API calls happen server-side — this just sends the user's Steam input
 * and receives normalized library items in return.
 *
 * Never called on render. Only called on explicit user action.
 */

export const steamService = {
  /**
   * Import a user's Steam library.
   * @param {string} steamInput — Steam profile URL, SteamID64, or vanity slug
   * @returns {{ imported, skipped, totalFetched, enrichedCount, steamId, library }}
   */
  importLibrary: (steamInput) =>
    api.post('/steam/import', { steamInput }).then(r => r.data),
};
