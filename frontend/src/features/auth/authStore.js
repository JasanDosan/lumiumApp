import { create } from 'zustand';
import { authService } from '@/services/authService';
import { setToken, clearToken } from '@/services/tokenStore';

const TOKEN_KEY = 'cm_token';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  initAuth: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    // Hydrate tokenStore immediately so the first API call has the token
    setToken(token);
    set({ token, isLoading: true });
    try {
      const user = await authService.getMe();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      clearToken();
      set({ token: null, isLoading: false });
    }
  },

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await authService.login(credentials);
      localStorage.setItem(TOKEN_KEY, token);
      setToken(token);
      set({ token, user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const { token, user } = await authService.register(data);
      localStorage.setItem(TOKEN_KEY, token);
      setToken(token);
      set({ token, user, isAuthenticated: true, isLoading: false });
      return true;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    clearToken();
    set({ user: null, token: null, isAuthenticated: false, error: null });
    // No dynamic import needed — favoritesStore subscribes to auth changes via its own init
  },

  clearError: () => set({ error: null }),
}));
