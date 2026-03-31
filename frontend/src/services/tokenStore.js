/**
 * Thin module-level token holder.
 * Breaks the circular dependency: api.js ← authStore ← authService ← api.js
 *
 * api.js reads from here (no store import needed).
 * authStore writes to here on login/logout.
 */

let _token = null;

export const getToken = () => _token;
export const setToken = (token) => { _token = token; };
export const clearToken = () => { _token = null; };
