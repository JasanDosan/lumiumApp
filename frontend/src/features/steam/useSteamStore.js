/**
 * useSteamStore.js
 *
 * Manages all Steam-related UI state. Responsibilities:
 *   - Holds import/sync status: 'idle' | 'loading' | 'success' | 'error'
 *   - Holds recently played games in memory (populated after syncRecent)
 *   - Persists last sync metadata to localStorage so sync info survives reload
 *   - Exposes importLibrary()  — manual import by URL/ID (legacy ProfilePage form)
 *   - Exposes syncLibrary()    — auto-sync using connected steamId (no manual input)
 *   - Exposes syncRecent()     — fetch + store recently played games
 *   - Calls useUserLibraryStore.addItem() for each new game after a successful import
 *
 * What it does NOT own:
 *   - The library itself → useUserLibraryStore
 *   - API request logic → steamService
 */

import { create } from 'zustand';
import { steamService } from '@/services/steamService';
import { useUserLibraryStore } from '@/features/library/libraryStore';
import { useAuthStore } from '@/features/auth/authStore';

const LS_KEY = 'pm_steam_sync';

// ─── localStorage helpers ─────────────────────────────────────────────────────

function lsLoadSync() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function lsSaveSync(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch { /* unavailable */ }
}

// ─── Shared import helper ─────────────────────────────────────────────────────

/**
 * After a successful library import response, apply returned items to the
 * library store and persist sync metadata to localStorage + store state.
 */
function applyImportResult(set, result) {
  if (result.library) {
    const { addItem } = useUserLibraryStore.getState();
    for (const item of result.library) {
      if (item.source === 'steam') addItem(item);
    }
  }

  const syncMeta = {
    lastSyncAt:   new Date().toISOString(),
    lastSteamId:  result.steamId,
    lastImported: result.imported,
    lastTotal:    result.totalFetched,
  };
  lsSaveSync(syncMeta);
  set({ status: 'success', error: null, ...syncMeta });
  return result;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSteamStore = create((set, get) => {
  const cached = lsLoadSync();

  return {
    // ── Library import state ──────────────────────────────────────────────────
    status:        'idle',   // 'idle' | 'loading' | 'success' | 'error'
    error:         null,
    lastSyncAt:    cached?.lastSyncAt    ?? null,
    lastSteamId:   cached?.lastSteamId   ?? null,
    lastImported:  cached?.lastImported  ?? null,
    lastTotal:     cached?.lastTotal     ?? null,

    // ── Recent games state ────────────────────────────────────────────────────
    recentGames:    [],      // SteamRecentGame[] — populated after syncRecent
    recentStatus:   'idle',  // 'idle' | 'loading' | 'success' | 'error'
    recentError:    null,

    // ── Disconnect state ──────────────────────────────────────────────────────
    disconnectStatus: 'idle',

    // ── importLibrary: manual import by URL/steamId/vanity slug ───────────────
    async importLibrary(steamInput) {
      if (get().status === 'loading') return;
      set({ status: 'loading', error: null });

      try {
        const result = await steamService.importLibrary(steamInput);
        return applyImportResult(set, result);
      } catch (err) {
        const message = err?.response?.data?.message ?? err.message ?? 'Import failed. Try again.';
        set({ status: 'error', error: message });
        throw err;
      }
    },

    // ── syncLibrary: auto-sync using the connected steamId ────────────────────
    /**
     * Uses the steamId stored from OpenID — no manual input needed.
     * Requires user to have completed Steam connect flow.
     */
    async syncLibrary() {
      if (get().status === 'loading') return;
      set({ status: 'loading', error: null });

      try {
        const result = await steamService.syncLibrary();
        // Patch authStore.user.steam.lastSyncedAt so header/profile reflect it
        useAuthStore.setState(state => ({
          user: state.user?.steam
            ? { ...state.user, steam: { ...state.user.steam, lastSyncedAt: new Date().toISOString() } }
            : state.user,
        }));
        return applyImportResult(set, result);
      } catch (err) {
        const message = err?.response?.data?.message ?? err.message ?? 'Sync failed. Try again.';
        set({ status: 'error', error: message });
        throw err;
      }
    },

    // ── syncRecent: fetch recently played games and store in state ─────────────
    async syncRecent() {
      if (get().recentStatus === 'loading') return;
      set({ recentStatus: 'loading', recentError: null });

      try {
        const result = await steamService.syncRecent();
        set({ recentGames: result.recent ?? [], recentStatus: 'success', recentError: null });
        return result;
      } catch (err) {
        const message = err?.response?.data?.message ?? err.message ?? 'Failed to fetch recent games.';
        set({ recentStatus: 'error', recentError: message });
        throw err;
      }
    },

    // ── loadRecent: load stored recent games from backend (no new fetch) ───────
    async loadRecent() {
      if (get().recentStatus === 'loading') return;
      set({ recentStatus: 'loading', recentError: null });

      try {
        const result = await steamService.getRecent();
        set({ recentGames: result.recent ?? [], recentStatus: 'success', recentError: null });
      } catch {
        set({ recentStatus: 'idle', recentError: null });
      }
    },

    // ── disconnectSteam ───────────────────────────────────────────────────────
    async disconnectSteam() {
      if (get().disconnectStatus === 'loading') return;
      set({ disconnectStatus: 'loading' });
      try {
        await steamService.disconnect();
        useAuthStore.setState(state => ({
          user: state.user ? { ...state.user, steam: null } : null,
        }));
        // Clear recent games from state
        set({ disconnectStatus: 'success', recentGames: [], recentStatus: 'idle' });
      } catch {
        set({ disconnectStatus: 'error' });
        throw new Error('Failed to disconnect Steam');
      } finally {
        setTimeout(() => set({ disconnectStatus: 'idle' }), 1500);
      }
    },

    // ── reset import status ───────────────────────────────────────────────────
    reset() {
      set({ status: 'idle', error: null });
    },
  };
});
