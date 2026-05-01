/**
 * BecauseYouPlayed — "Personalized for you" section.
 *
 * Reads the user's full saved library, builds a taste profile, and surfaces
 * scored recommendations across all three media types.
 *
 * Data flow:
 *   useUserLibraryStore.library
 *     → usePersonalizedRecs (hook)
 *       → buildTasteProfile  (genre/tag weights)
 *       → TMDB discover      (movie + series candidates)
 *       → GAME_CATALOG filter (game candidates)
 *       → scored + filtered results
 *     → rendered in type-segmented rows with explanation text
 */

import { useState } from 'react';
import {
  useUserLibraryStore,
  normalizeMovie,
  normalizeSeries,
} from '@/features/library/libraryStore';
import {
  usePersonalizedRecs,
  buildRowReason,
} from '@/features/recommendations/usePersonalizedRecs';
import ExpandableRow from '@/components/ui/ExpandableRow';

// ─── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'all',    label: 'All',    emoji: '✨', activeClass: 'bg-accent     text-white', inactiveColor: 'text-accent-light' },
  { id: 'games',  label: 'Games',  emoji: '🎮', activeClass: 'bg-accent     text-white', inactiveColor: 'text-accent-light' },
  { id: 'movies', label: 'Movies', emoji: '🎬', activeClass: 'bg-amber-500  text-white', inactiveColor: 'text-amber-400'   },
  { id: 'series', label: 'Series', emoji: '📺', activeClass: 'bg-violet-500 text-white', inactiveColor: 'text-violet-400'  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function RowLabel({ color, label, reason }) {
  const COLORS = {
    amber:  { bar: 'bg-amber-500',  text: 'text-amber-400'    },
    violet: { bar: 'bg-violet-500', text: 'text-violet-400'   },
    accent: { bar: 'bg-accent',     text: 'text-accent-light' },
  };
  const c = COLORS[color] ?? COLORS.accent;
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-0.5">
        <div className={`w-0.5 h-4 ${c.bar} rounded-full shrink-0`} />
        <p className={`text-[10px] font-black tracking-[0.2em] uppercase ${c.text}`}>{label}</p>
      </div>
      {reason && (
        <p className="text-[11px] text-ink-light ml-3 italic">{reason}</p>
      )}
    </div>
  );
}

function SkeletonRow({ count = 5, width = 'w-52 sm:w-60' }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`shrink-0 ${width}`}>
          <div className="skeleton rounded-2xl" style={{ aspectRatio: '16/9' }} />
          <div className="skeleton h-2.5 w-3/4 rounded mt-2" />
        </div>
      ))}
    </div>
  );
}

/**
 * Renders a single type row (movies / series / games) with a header,
 * explanation reason, and a draggable card row with add-to-library buttons.
 */
function ContentSection({ type, items, isLoading, isPrimary, reason }) {
  const CONFIG = {
    movies: {
      label: "Movies you'll love",
      color: 'amber',
      primaryWidth: 'w-56 sm:w-64 lg:w-72',
      secondaryWidth: 'w-44 sm:w-52',
      gap: 'gap-4',
      skeletonCount: 4,
    },
    series: {
      label: "Series you'll love",
      color: 'violet',
      primaryWidth: 'w-56 sm:w-64 lg:w-72',
      secondaryWidth: 'w-44 sm:w-52',
      gap: 'gap-4',
      skeletonCount: 4,
    },
    games: {
      label: 'Games you might like',
      color: 'accent',
      primaryWidth: 'w-44 sm:w-52',
      secondaryWidth: 'w-36 sm:w-40',
      gap: 'gap-3',
      skeletonCount: 5,
    },
  };

  const { label, color, primaryWidth, secondaryWidth, gap, skeletonCount } = CONFIG[type];
  const cardWidth = isPrimary ? primaryWidth : secondaryWidth;

  const { addItem, removeItem, hasMovie, hasSeries, addGame, removeGame, hasGame } =
    useUserLibraryStore();

  /** Returns the toggle handler for a given item + itemType. */
  function getAddHandler(item, itemType) {
    if (itemType === 'movie') {
      return () =>
        hasMovie(item.tmdbId)
          ? removeItem(`movie_${Number(item.tmdbId)}`)
          : addItem(normalizeMovie(item));
    }
    if (itemType === 'series') {
      return () =>
        hasSeries(item.tmdbId)
          ? removeItem(`series_${Number(item.tmdbId)}`)
          : addItem(normalizeSeries(item));
    }
    if (itemType === 'game') {
      const rawId = String(item.id ?? item.rawId ?? '');
      return () => (hasGame(rawId) ? removeGame(rawId) : addGame(item));
    }
    return undefined;
  }

  /** Returns true if the item is already in the user's library. */
  function getLibraryCheck(item, itemType) {
    if (itemType === 'movie')  return hasMovie(item.tmdbId);
    if (itemType === 'series') return hasSeries(item.tmdbId);
    if (itemType === 'game')   return hasGame(String(item.id ?? item.rawId ?? ''));
    return false;
  }

  if (!isLoading && !items.length) return null;

  return (
    <div>
      <RowLabel color={color} label={label} reason={reason} />
      {isLoading ? (
        <SkeletonRow count={skeletonCount} width={cardWidth} />
      ) : (
        <ExpandableRow
          items={items}
          cardWidth={cardWidth}
          gap={gap}
          onAddToLibrary={getAddHandler}
          libraryCheck={getLibraryCheck}
        />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BecauseYouPlayed() {
  const {
    library,
    games:   myGames,
    movies:  myMovies,
    series:  mySeries,
  } = useUserLibraryStore();

  const {
    movies,
    series,
    games,
    profile,
    profileSummary,
    isLoading,
    isEmpty,
  } = usePersonalizedRecs(library);

  const [activeTab, setActiveTab] = useState('all');

  const totalSaved = library.length;
  const needed     = Math.max(0, 3 - totalSaved);

  const showMovies = activeTab === 'all' || activeTab === 'movies';
  const showSeries = activeTab === 'all' || activeTab === 'series';
  const showGames  = activeTab === 'all' || activeTab === 'games';

  // Per-row explanation text derived from the taste profile
  const movieReason  = profile ? buildRowReason('movie',  profile) : null;
  const seriesReason = profile ? buildRowReason('series', profile) : null;
  const gameReason   = profile ? buildRowReason('game',   profile) : null;

  // Primary type = the type with the most saved items → gets larger card size
  const primaryType =
    myMovies.length >= myGames.length && myMovies.length >= mySeries.length ? 'movies' :
    myGames.length  >= mySeries.length                                       ? 'games'  :
                                                                               'series';

  return (
    <section
      style={{
        background:   'linear-gradient(180deg, rgba(139,92,246,0.18) 0%, rgba(11,11,15,0.95) 100%)',
        border:       '1px solid rgba(139,92,246,0.25)',
        borderRadius: '24px',
        padding:      '36px 32px',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center mb-6">
        <p className="text-[10px] font-black tracking-[0.28em] text-accent uppercase mb-2">
          Personalized for you
        </p>
        <p className="text-sm text-ink-mid">
          {profileSummary || 'Save titles to unlock your taste profile'}
        </p>
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {isEmpty ? (
        <div className="flex flex-col items-center text-center py-8">
          <p className="text-4xl mb-4">✨</p>
          <p className="text-sm font-semibold text-ink-mid mb-2">
            Save more titles to unlock personalized recommendations
          </p>
          <p className="text-xs text-ink-light leading-relaxed max-w-xs">
            {needed > 0
              ? `Add ${needed} more item${needed !== 1 ? 's' : ''} to your library — then we'll analyse your taste and surface the best matches.`
              : 'Browse games, movies, and series to build your taste profile.'}
          </p>
        </div>
      ) : (
        <>
          {/* ── Tabs ──────────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 mb-3 justify-center flex-wrap">
            {TABS.map(tab => {
              const count =
                tab.id === 'all'    ? totalSaved :
                tab.id === 'games'  ? myGames.length  :
                tab.id === 'movies' ? myMovies.length :
                                      mySeries.length;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold
                             border transition-all duration-150 ${
                    activeTab === tab.id
                      ? `${tab.activeClass} border-transparent shadow-md`
                      : `border-subtle bg-surface ${tab.inactiveColor} hover:border-accent/30`
                  }`}
                >
                  <span>{tab.emoji}</span>
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                      activeTab === tab.id
                        ? 'bg-white/20 text-white'
                        : 'bg-surface-high text-ink-light'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ── Gradient divider ──────────────────────────────────────────────── */}
          <div className="h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent mb-6" />

          {/* ── Content rows ──────────────────────────────────────────────────── */}
          <div className="space-y-7">
            {showMovies && (
              <ContentSection
                type="movies"
                items={movies}
                isLoading={isLoading}
                isPrimary={primaryType === 'movies'}
                reason={movieReason}
              />
            )}
            {showSeries && (
              <ContentSection
                type="series"
                items={series}
                isLoading={isLoading}
                isPrimary={primaryType === 'series'}
                reason={seriesReason}
              />
            )}
            {showGames && (
              <ContentSection
                type="games"
                items={games}
                isLoading={isLoading}
                isPrimary={primaryType === 'games'}
                reason={gameReason}
              />
            )}
          </div>

          {/* ── No-results state ──────────────────────────────────────────────── */}
          {!isLoading &&
            movies.length === 0 &&
            series.length === 0 &&
            games.length  === 0 && (
            <p className="text-center text-xs text-ink-light italic py-4">
              No recommendations found — try saving more diverse titles.
            </p>
          )}
        </>
      )}
    </section>
  );
}
