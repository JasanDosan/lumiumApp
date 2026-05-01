/**
 * SteamRecentRow.jsx
 *
 * "Recently played on Steam" — a discovery surface, not a Steam mirror.
 *
 * Each game card resolves to an internal Lumium page when possible:
 *   1. GAME_CATALOG match (curated list)  → /game/:slug        (richest experience)
 *   2. Steam-imported library item        → /game/steam_:appId (RAWG resolves by title)
 *   3. No Lumium match                    → new tab to Steam   (external fallback)
 *
 * The appId→catalog mapping is derived at module level from GAME_CATALOG image URLs.
 * No extra data models or API calls needed.
 *
 * Actions per card:
 *   - Primary click: navigate to Lumium page (or Steam if no match)
 *   - Save/unsave: available for catalog games, shown on hover
 *   - "Owned on Steam" badge: shown when the game is in the user's steam library
 *   - Playtime: this week or total, as context
 */

import { useEffect, useMemo } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAuthStore }        from '@/features/auth/authStore';
import { useSteamStore }       from './useSteamStore';
import { useUserLibraryStore } from '@/features/library/libraryStore';
import { GAME_CATALOG }        from '@/data/gameMovieTags';
import { toast }               from '@/stores/toastStore';
import DragRow                 from '@/components/ui/DragRow';

// ─── Catalog lookup (module-level, computed once) ─────────────────────────────
//
// GAME_CATALOG entries use image: steam(appId) which produces:
//   https://cdn.akamai.steamstatic.com/steam/apps/<appId>/header.jpg
// We extract appId from each image URL to build an O(1) lookup map.

const CATALOG_BY_APPID = (() => {
  const map = {};
  for (const game of GAME_CATALOG) {
    const m = game.image?.match(/steam\/apps\/(\d+)\//);
    if (m) map[Number(m[1])] = game;
  }
  return map;
})();

// ─── Resolution ───────────────────────────────────────────────────────────────

/**
 * Given a Steam appId, return the best Lumium match.
 * @param {number}   appId
 * @param {object[]} steamLibraryItems — user.library items with source === 'steam'
 */
function resolveLumiumGame(appId, steamLibraryItems) {
  // 1. Curated catalog — slug-based route, full game page
  const catalogGame = CATALOG_BY_APPID[appId] ?? null;
  if (catalogGame) {
    return { path: `/game/${catalogGame.id}`, kind: 'catalog', catalogGame, libraryItem: null };
  }

  // 2. Steam-imported library item — GameDetailPage resolves RAWG detail by title
  const libraryItem = steamLibraryItems.find(
    g => Number(g.metadata?.steamAppId) === appId
  );
  if (libraryItem) {
    return { path: `/game/steam_${appId}`, kind: 'library', catalogGame: null, libraryItem };
  }

  // 3. No match in Lumium — link to Steam store as fallback
  return { path: null, kind: 'external', catalogGame: null, libraryItem: null };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(minutes) {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

// ─── SteamGameCard ────────────────────────────────────────────────────────────

function SteamGameCard({ game }) {
  const navigate = useNavigate();
  const { games: libraryGames, addGame, removeGame, hasGame } = useUserLibraryStore();

  // Filter once — only steam-sourced library items matter for match + badge
  const steamLibraryItems = useMemo(
    () => libraryGames.filter(g => g.source === 'steam'),
    [libraryGames]
  );

  const { path, kind, catalogGame, libraryItem } = useMemo(
    () => resolveLumiumGame(game.appId, steamLibraryItems),
    [game.appId, steamLibraryItems]
  );

  // "Owned on Steam" = the game was imported from their steam library
  const isOwned   = kind === 'library' || !!libraryItem;
  // "Saved" = user explicitly saved the catalog version of this game
  const isSaved   = catalogGame ? hasGame(catalogGame.id) : false;
  const hasLumium = !!path;

  // primaryImage is set by normalizeRecentGame; guard against older stored entries that
  // only have appId by reconstructing the header URL as an in-place fallback.
  const headerImg = game.primaryImage
    ?? `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appId}/header.jpg`;
  const time2w    = fmt(game.playtime2Weeks);
  const timeTotal = fmt(game.playtimeForever);
  const steamUrl  = `https://store.steampowered.com/app/${game.appId}`;

  const handleClick = () => {
    if (path) navigate(path);
    else window.open(steamUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSave = (e) => {
    e.stopPropagation();
    if (!catalogGame) return;
    if (isSaved) {
      removeGame(catalogGame.id);
      toast(`Removed — ${catalogGame.name}`);
    } else {
      addGame(catalogGame);
      toast(`Saved — ${catalogGame.name}`);
    }
  };

  return (
    <div className="shrink-0 w-40 group/card">

      {/* ── Image + overlay ──────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden rounded-xl bg-surface-high"
        style={{ aspectRatio: '16/9' }}
      >
        <button
          onClick={handleClick}
          className="block w-full h-full"
          aria-label={hasLumium
            ? `View ${game.name} in Lumium`
            : `Open ${game.name} on Steam`}
        >
          <img
            src={headerImg}
            alt={game.name}
            loading="lazy"
            draggable={false}
            className="w-full h-full object-cover transition-transform duration-300
                       group-hover/card:scale-[1.05]"
            onError={(e) => {
              const img = e.currentTarget;
              // Stage 1: try icon image (hash-based small icon)
              if (!img.dataset.fallback) {
                img.dataset.fallback = '1';
                const icon = game.iconImage ?? game.iconUrl ?? null;
                if (icon) { img.src = icon; return; }
              }
              // Stage 2: hide img — bg-surface-high container acts as placeholder
              img.style.display = 'none';
            }}
          />

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/45
                          transition-colors duration-200" />

          {/* Hover CTA label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-[10px] font-bold text-white px-2.5 py-1 rounded-full
                         bg-black/70 backdrop-blur-sm whitespace-nowrap
                         opacity-0 group-hover/card:opacity-100 transition-opacity duration-200"
            >
              {hasLumium ? 'View in Lumium' : 'Open on Steam ↗'}
            </span>
          </div>
        </button>

        {/* "Owned on Steam" badge — top left */}
        {isOwned && (
          <span
            className="absolute top-1.5 left-1.5 pointer-events-none
                       text-[8px] font-black tracking-wide uppercase leading-none
                       bg-emerald-500/90 text-white px-1.5 py-[3px] rounded
                       backdrop-blur-sm"
          >
            Owned
          </span>
        )}

        {/* Playtime this week — bottom right */}
        {time2w && (
          <span
            className="absolute bottom-1.5 right-1.5 pointer-events-none
                       text-[9px] font-bold tabular-nums leading-none
                       bg-black/70 text-white/90 px-1.5 py-[3px] rounded
                       backdrop-blur-sm"
          >
            {time2w}
          </span>
        )}

        {/* Save / unsave — top right, visible on hover (catalog games only) */}
        {catalogGame && (
          <button
            onClick={handleSave}
            aria-label={isSaved
              ? `Remove ${game.name} from library`
              : `Save ${game.name} to library`}
            className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full
                        flex items-center justify-center border
                        transition-all duration-150
                        opacity-0 group-hover/card:opacity-100
                        ${isSaved
                          ? 'bg-accent border-accent/60 text-white'
                          : 'bg-black/60 border-white/20 text-white hover:bg-black/80 backdrop-blur-sm'
                        }`}
          >
            {isSaved ? (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="mt-1.5 px-0.5">
        <p className="text-[12px] font-medium text-ink leading-snug line-clamp-1">
          {game.name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          {time2w ? (
            <span className="text-[10px] text-ink-light tabular-nums">
              {time2w} this week
            </span>
          ) : timeTotal ? (
            <span className="text-[10px] text-ink-light tabular-nums">
              {timeTotal} total
            </span>
          ) : null}
          {!hasLumium && (
            <span className="text-[9px] text-ink-light/50 ml-auto">↗ Steam</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SteamRecentRow ───────────────────────────────────────────────────────────

export default function SteamRecentRow() {
  const { user }                                  = useAuthStore();
  const { recentGames, recentStatus, loadRecent } = useSteamStore();

  const isConnected = !!user?.steam?.connected;

  // Load stored recent games on mount — reads backend cache, never calls Steam API
  useEffect(() => {
    if (isConnected && recentGames.length === 0 && recentStatus === 'idle') {
      loadRecent();
    }
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isConnected || recentGames.length === 0) return null;

  return (
    <div className="border-t border-line/40 px-6 sm:px-12 lg:px-20 py-5 bg-canvas">
      <div className="max-w-[1280px] mx-auto">

        {/* Row header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-0.5 h-4 bg-emerald-400 rounded-full shrink-0" />
          <p className="text-[10px] font-black tracking-[0.2em] uppercase text-emerald-400">
            Steam
          </p>
          <span className="text-ink-light/40 text-[10px]">·</span>
          <p className="text-[10px] text-ink-light">Recently played</p>
        </div>

        {/* Drag-scrollable card row */}
        <DragRow gap="gap-3">
          {recentGames.map(game => (
            <SteamGameCard key={game.appId} game={game} />
          ))}
        </DragRow>

      </div>
    </div>
  );
}
