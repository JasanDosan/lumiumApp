/**
 * SteamRecentRow.jsx
 *
 * "Recently played on Steam" — a small, discrete module shown on the home page
 * when the user has Steam connected and has synced recent games.
 *
 * States:
 *   - Steam not connected         → null (renders nothing)
 *   - Connected, no recent games  → null (renders nothing)
 *   - Connected, has recent games → scrollable pill row
 *
 * Loads stored recent games on mount (GET /api/steam/recent).
 * Never fetches from Steam API directly — only reads what's already stored.
 */

import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/authStore';
import { useSteamStore } from './useSteamStore';

// ─── Playtime formatter ───────────────────────────────────────────────────────

function formatPlaytime(minutes) {
  if (!minutes || minutes === 0) return null;
  if (minutes < 60) return `${minutes}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

// ─── Single game pill ─────────────────────────────────────────────────────────

function RecentGamePill({ game }) {
  const playtime = formatPlaytime(game.playtime2Weeks);
  const href     = `https://store.steampowered.com/app/${game.appId}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-line bg-surface
                 hover:border-line/80 hover:bg-surface-high transition-colors shrink-0
                 cursor-pointer group"
    >
      {game.iconUrl ? (
        <img
          src={game.iconUrl}
          alt={game.name}
          className="w-5 h-5 rounded shrink-0 object-cover"
          loading="lazy"
          draggable={false}
        />
      ) : (
        <span className="w-5 h-5 shrink-0 text-base leading-none">🎮</span>
      )}
      <span className="text-xs font-medium text-ink group-hover:text-ink transition-colors
                       max-w-[120px] truncate">
        {game.name}
      </span>
      {playtime && (
        <span className="text-[10px] text-ink-light tabular-nums shrink-0">{playtime}</span>
      )}
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SteamRecentRow() {
  const { user }                       = useAuthStore();
  const { recentGames, recentStatus, loadRecent } = useSteamStore();

  const isConnected = !!user?.steam?.connected;

  // Load stored recent games on mount — non-blocking, no spinner on the page
  useEffect(() => {
    if (isConnected && recentGames.length === 0 && recentStatus === 'idle') {
      loadRecent();
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Don't render anything if not connected or no data
  if (!isConnected || recentGames.length === 0) return null;

  return (
    <div className="border-t border-line/40 px-6 sm:px-12 lg:px-20 py-5 bg-canvas">
      <div className="max-w-[1280px] mx-auto">
        <section>
          {/* Row header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-0.5 h-4 bg-emerald-400 rounded-full shrink-0" />
              <p className="text-[10px] font-black tracking-[0.2em] uppercase text-emerald-400">
                Steam
              </p>
            </div>
            <p className="text-xs text-ink-light">Recently played</p>
          </div>

          {/* Scrollable pill row */}
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {recentGames.map(game => (
              <RecentGamePill key={game.appId} game={game} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
