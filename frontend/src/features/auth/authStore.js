/**
 * authStore.js — owns all authentication and session state.
 *
 * Responsibilities:
 *   - Token lifecycle (read/write localStorage, hydrate tokenStore)
 *   - User identity (user object, isAuthenticated)
 *   - Auth hydration gate (hasHydrated — lets the UI know when the session check is done)
 *   - Coordination: notifies libraryStore on login/logout so data syncs automatically
 *
 * What it does NOT own:
 *   - Library/favorites data → libraryStore
 *   - API request logic → authService + api.js
 *
 * Token flow:
 *   localStorage ──▶ tokenStore (module-level) ──▶ api.js request interceptor
 *   authStore writes to both on login; reads from localStorage only on initAuth.
 */

import { create } from 'zustand';
import { authService } from '@/services/authService';
import { setToken, clearToken } from '@/services/tokenStore';
import { useUserLibraryStore } from '@/features/library/libraryStore';

const TOKEN_KEY = 'cm_token';

// ─── localStorage helpers (module-private) ────────────────────────────────────

const persistToken  = (token) => localStorage.setItem(TOKEN_KEY, token);
const dropToken     = ()      => localStorage.removeItem(TOKEN_KEY);
const getPersistedToken = ()  => localStorage.getItem(TOKEN_KEY);

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create((set) => ({
  user:            null,
  token:           null,
  isAuthenticated: false,
  isLoading:       false,
  error:           null,
  /**
   * false until initAuth() resolves (success or failure).
   * Gate any component that must not render before the session is known.
   * e.g. <ProtectedRoute> flicker, redirect loops.
   */
  hasHydrated: false,

  // ─── initAuth ──────────────────────────────────────────────────────────────
  /**
   * Called once at app startup (App.jsx useEffect).
   * Reads the persisted token, validates it with the backend, then kicks off
   * library sync if the token is valid. Always sets hasHydrated = true so the
   * UI can unblock regardless of outcome.
   */
  initAuth: async () => {
    const token = getPersistedToken();
    if (!token) {
      set({ hasHydrated: true }); // no token → guest mode, unblock UI immediately
      return;
    }

    // Hydrate tokenStore before any API call fires
    setToken(token);
    set({ token, isLoading: true });

    try {
      const user = await authService.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
      // Token is valid — pull authoritative library from backend
      useUserLibraryStore.getState().onAuthLogin();
    } catch {
      // Token expired or revoked — clean up and fall back to guest
      dropToken();
      clearToken();
      set({ token: null, isLoading: false });
    } finally {
      set({ hasHydrated: true });
    }
  },

  // ─── login ─────────────────────────────────────────────────────────────────
  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await authService.login(credentials);
      persistToken(token);
      setToken(token);
      set({ token, user, isAuthenticated: true, isLoading: false });
      // Sync library from backend now that we have an authenticated session
      useUserLibraryStore.getState().onAuthLogin();
      return true;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  // ─── register ──────────────────────────────────────────────────────────────
  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await authService.register(data);
      persistToken(token);
      setToken(token);
      set({ token, user, isAuthenticated: true, isLoading: false });
      useUserLibraryStore.getState().onAuthLogin();
      return true;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  // ─── logout ────────────────────────────────────────────────────────────────
  logout: () => {
    dropToken();
    clearToken();
    set({ user: null, token: null, isAuthenticated: false, error: null });
    // Clear backend data from library state so this user's data doesn't linger
    // on shared devices or if a different account logs in next.
    useUserLibraryStore.getState().onAuthLogout();
  },

  clearError: () => set({ error: null }),
}));
