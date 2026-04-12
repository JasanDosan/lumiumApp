/**
 * SteamConnectButton.jsx
 *
 * Compact header button for Steam account linking.
 *
 * States:
 *   idle       — user has no Steam connected → "Connect Steam" pill
 *   connected  — user has Steam → avatar + green dot + disconnect menu
 *   loading    — disconnect in flight → spinner
 *
 * Only renders when the user is authenticated. Hides on mobile (managed
 * from profile page instead to keep the header uncluttered).
 */

import { useState, useRef, useEffect } from 'react';
import { useAuthStore }  from '@/features/auth/authStore';
import { useSteamStore } from '@/features/steam/useSteamStore';
import { steamService }  from '@/services/steamService';
import { toast }         from '@/stores/toastStore';

// ─── Steam SVG (inline — no external dep) ─────────────────────────────────────

function SteamIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59
               1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524
               4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105
               l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39
               3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24
               11.979 24c6.627 0 11.999-5.373 11.999-12S18.606 0 11.979 0zM7.54
               18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076
               3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26
               -1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497
               1.41-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665
               0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0
               3.015-1.35 3.015-3.015zm-5.273.005c0-1.252 1.013-2.266 2.265-2.266
               1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252
               0-2.265-1.014-2.265-2.265z" />
    </svg>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function SteamConnectButton() {
  const { isAuthenticated, user } = useAuthStore();
  const { disconnectSteam, disconnectStatus, syncLibrary, syncRecent, status, recentStatus } =
    useSteamStore();

  const [menuOpen, setMenuOpen]     = useState(false);
  const [connecting, setConnecting] = useState(false);
  const menuRef = useRef(null);

  const steam = user?.steam;  // null | { connected, steamId, personaName, avatarUrl, lastSyncedAt }

  // ── Click outside to close menu ──────────────────────────────────────────
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // ── Not logged in — render nothing ───────────────────────────────────────
  if (!isAuthenticated) return null;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleConnect = () => {
    try {
      setConnecting(true);
      steamService.connect(); // triggers page redirect — connecting state is cosmetic
    } catch (err) {
      toast(err.message || 'Could not initiate Steam login', 'error');
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setMenuOpen(false);
    try {
      await disconnectSteam();
      toast('Steam disconnected');
    } catch {
      toast('Failed to disconnect Steam', 'error');
    }
  };

  const handleSyncLibrary = async () => {
    setMenuOpen(false);
    try {
      const result = await syncLibrary();
      const n = result?.imported ?? 0;
      toast(n > 0 ? `Imported ${n} new game${n !== 1 ? 's' : ''} from Steam` : 'Library up to date');
    } catch (err) {
      toast(err?.response?.data?.message ?? 'Library sync failed', 'error');
    }
  };

  const handleSyncRecent = async () => {
    setMenuOpen(false);
    try {
      const result = await syncRecent();
      const n = result?.count ?? 0;
      toast(n > 0 ? `Synced ${n} recently played game${n !== 1 ? 's' : ''}` : 'No recent activity found');
    } catch {
      toast('Failed to sync recent games', 'error');
    }
  };

  const isDisconnecting = disconnectStatus === 'loading';
  const isSyncing       = status === 'loading' || recentStatus === 'loading';

  // ─────────────────────────────────────────────────────────────────────────
  // CONNECTED STATE
  // ─────────────────────────────────────────────────────────────────────────

  if (steam?.connected) {
    return (
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label={`Steam: ${steam.personaName || steam.steamId}. Click to manage`}
          aria-expanded={menuOpen}
          aria-haspopup="true"
          className="flex items-center gap-1.5 rounded-full focus-visible:outline-none
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {/* Avatar or Steam icon */}
          <span className="relative inline-flex">
            {steam.avatarUrl ? (
              <img
                src={steam.avatarUrl}
                alt={steam.personaName || 'Steam avatar'}
                className="w-6 h-6 rounded-full object-cover border border-line/50"
                draggable={false}
              />
            ) : (
              <span className="w-6 h-6 rounded-full bg-surface-high border border-line/50
                               flex items-center justify-center">
                <SteamIcon className="w-3.5 h-3.5 text-ink-mid" />
              </span>
            )}
            {/* Green connected dot */}
            <span
              aria-hidden="true"
              className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full
                         bg-emerald-400 border border-canvas"
            />
          </span>
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-2 w-56 bg-surface border border-line
                       rounded-xl shadow-xl z-[60] overflow-hidden py-1 animate-fade-in"
          >
            {/* Info row */}
            <div className="px-3 py-2.5 border-b border-line/60">
              <p className="text-[10px] font-black tracking-[0.18em] uppercase text-ink-light mb-0.5">
                Steam
              </p>
              <p className="text-sm font-medium text-ink truncate">
                {steam.personaName || steam.steamId}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <p className="text-[11px] text-emerald-400 font-medium">Connected</p>
              </div>
              {steam.lastSyncedAt && (
                <p className="text-[10px] text-ink-light mt-1">
                  Synced {new Date(steam.lastSyncedAt).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric',
                  })}
                </p>
              )}
            </div>

            {/* Sync actions */}
            <button
              role="menuitem"
              onClick={handleSyncLibrary}
              disabled={isSyncing}
              className="w-full text-left px-3 py-2 text-[13px] text-ink-mid hover:text-ink
                         hover:bg-surface-high transition-colors disabled:opacity-50
                         disabled:cursor-not-allowed"
            >
              {status === 'loading' ? 'Syncing library…' : 'Sync library'}
            </button>
            <button
              role="menuitem"
              onClick={handleSyncRecent}
              disabled={isSyncing}
              className="w-full text-left px-3 py-2 text-[13px] text-ink-mid hover:text-ink
                         hover:bg-surface-high transition-colors disabled:opacity-50
                         disabled:cursor-not-allowed"
            >
              {recentStatus === 'loading' ? 'Syncing recent…' : 'Sync recent games'}
            </button>

            {/* Divider */}
            <div className="border-t border-line/40 my-1" />

            <button
              role="menuitem"
              onClick={handleDisconnect}
              disabled={isDisconnecting || isSyncing}
              className="w-full text-left px-3 py-2 text-[13px] text-ink-light hover:text-ink
                         hover:bg-surface-high transition-colors disabled:opacity-50
                         disabled:cursor-not-allowed"
            >
              {isDisconnecting ? 'Disconnecting…' : 'Disconnect Steam'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // IDLE STATE — not connected
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      aria-label="Connect your Steam account"
      className="hidden md:flex items-center gap-1.5 text-[12px] font-semibold text-ink-mid
                 hover:text-ink border border-line/70 hover:border-line rounded-full
                 px-2.5 py-1 transition-all duration-150
                 disabled:opacity-50 disabled:cursor-not-allowed
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      {connecting ? (
        <span
          aria-hidden="true"
          className="w-3.5 h-3.5 rounded-full border border-ink-light border-t-transparent animate-spin"
        />
      ) : (
        <SteamIcon className="w-3.5 h-3.5 shrink-0" />
      )}
      <span>{connecting ? 'Redirecting…' : 'Steam'}</span>
    </button>
  );
}
