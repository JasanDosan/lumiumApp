/**
 * useSteamStore.js
 *
 * Manages Steam import state. Responsibilities:
 *   - Holds import status: 'idle' | 'loading' | 'success' | 'error'
 *   - Persists last import result to localStorage so sync info survives page reload
 *   - Exposes importLibrary() — the only entry point for a Steam fetch
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

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSteamStore = create((set, get) => {
  const cached = lsLoadSync();

  return {
    // ── State ─────────────────────────────────────────────────────────────────
    status:        'idle',   // 'idle' | 'loading' | 'success' | 'error'
    error:         null,
    lastSyncAt:    cached?.lastSyncAt    ?? null,  // ISO string
    lastSteamId:   cached?.lastSteamId   ?? null,
    lastImported:  cached?.lastImported  ?? null,  // count on last sync
    lastTotal:     cached?.lastTotal     ?? null,  // total games fetched on last sync

    // ── Import ────────────────────────────────────────────────────────────────
    /**
     * Run a full Steam import for the given input.
     * Only one import can be in-flight at a time.
     * On success, applies all returned library items via addItem().
     */
    async importLibrary(steamInput) {
      if (get().status === 'loading') return;

      set({ status: 'loading', error: null });

      try {
        const result = await steamService.importLibrary(steamInput);

        // Apply the authoritative library from the backend response
        // (steamController returns the full updated library)
        if (result.library) {
          const { addItem } = useUserLibraryStore.getState();
          for (const item of result.library) {
            if (item.source === 'steam') {
              // addItem is idempotent — safe to call for existing items
              await addItem(item);
            }
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
      } catch (err) {
        const message = err?.response?.data?.message ?? err.message ?? 'Import failed. Try again.';
        set({ status: 'error', error: message });
        throw err;
      }
    },

    // ── Disconnect Steam account ───────────────────────────────────────────────
    /**
     * Calls the backend to unlink Steam, then patches authStore.user in place
     * so the UI reflects the change immediately (no re-fetch needed).
     */
    disconnectStatus: 'idle',   // 'idle' | 'loading' | 'success' | 'error'

    async disconnectSteam() {
      if (get().disconnectStatus === 'loading') return;
      set({ disconnectStatus: 'loading' });
      try {
        await steamService.disconnect();
        // Patch the user object in authStore without a full re-fetch
        useAuthStore.setState(state => ({
          user: state.user ? { ...state.user, steam: null } : null,
        }));
        set({ disconnectStatus: 'success' });
      } catch {
        set({ disconnectStatus: 'error' });
        throw new Error('Failed to disconnect Steam');
      } finally {
        // Reset to idle after a brief moment so callers can check success once
        setTimeout(() => set({ disconnectStatus: 'idle' }), 1500);
      }
    },

    // ── Reset import status ───────────────────────────────────────────────────
    reset() {
      set({ status: 'idle', error: null });
    },
  };
});
