import { create } from 'zustand';

let nextId = 0;
const DURATION = 3000; // ms before auto-dismiss

export const useToastStore = create((set, get) => ({
  toasts: [],

  add(message, type = 'success') {
    const id = ++nextId;
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().remove(id), DURATION);
  },

  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

/**
 * Imperative helper — call outside of React components (event handlers, callbacks).
 * Usage: import { toast } from '@/stores/toastStore'
 *        toast('Saved to library')
 *        toast('Something went wrong', 'error')
 */
export const toast = (message, type = 'success') =>
  useToastStore.getState().add(message, type);
