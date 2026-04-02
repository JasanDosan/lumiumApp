import { useState, useEffect } from 'react';
import { movieService } from '@/services/movieService';
import { getRelatedGames } from '@/data/gameMovieTags';
import DragRow from './DragRow';
import UnifiedCard from './UnifiedCard';

const TYPE_CONFIG = {
  game:   { badge: 'bg-accent',     text: 'text-accent',     label: 'GAME'   },
  movie:  { badge: 'bg-amber-500',  text: 'text-amber-400',  label: 'FILM'   },
  series: { badge: 'bg-violet-500', text: 'text-violet-400', label: 'SERIES' },
};

/**
 * Inline detail panel — slides open below whatever row it's placed after.
 *
 * Props:
 *   item      — the selected item object
 *   type      — 'game' | 'movie' | 'series'
 *   isOpen    — controls expand/collapse animation
 *   onClose   — called when user clicks the close button
 */
export default function InlineDetail({ item, type, isOpen, onClose }) {
  const [movieDetails, setMovieDetails] = useState(null);
  const [similar, setSimilar]           = useState([]);
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    if (!isOpen || !item) return;
    setMovieDetails(null);
    setSimilar([]);

    if (type === 'movie' && item.tmdbId) {
      setLoading(true);
      Promise.all([
        movieService.getDetails(item.tmdbId).catch(() => null),
        movieService.getMovieRecs(item.tmdbId).catch(() => ({ results: [] })),
      ])
        .then(([det, recs]) => {
          setMovieDetails(det);
          setSimilar((recs?.results ?? []).slice(0, 8));
        })
        .finally(() => setLoading(false));
    } else if (type === 'game') {
      setSimilar(getRelatedGames(item.id, 8));
    }
  }, [isOpen, item?.tmdbId, item?.id, type]); // eslint-disable-line react-hooks/exhaustive-deps

  const cfg      = TYPE_CONFIG[type] ?? TYPE_CONFIG.movie;
  const title    = item?.title ?? item?.name;
  const image    = item?.backdropUrl ?? item?.image ?? null;
  const overview = movieDetails?.overview ?? item?.overview ?? null;
  const rating   = item?.rating;
  const year     = item?.releaseDate?.slice(0, 4);

  // Normalise genres → array of strings
  const genres = (() => {
    const raw = movieDetails?.genres ?? [];
    if (!raw.length) return [];
    return typeof raw[0] === 'string' ? raw : raw.map(g => g.name ?? g).filter(Boolean);
  })();

  const gameTags = (type === 'game' && !genres.length) ? (item?.tags ?? []).slice(0, 5) : [];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: isOpen ? '1fr' : '0fr',
        transition: 'grid-template-rows 380ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <div className="overflow-hidden">
        {item && (
          <div
            className="mt-3 bg-white rounded-2xl border border-line overflow-hidden"
            style={{
              boxShadow: '0 20px 60px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)',
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'opacity 300ms ease, transform 300ms ease',
            }}
          >
            {/* Backdrop strip */}
            {image && (
              <div className="relative h-44 overflow-hidden">
                <img
                  src={image} alt="" draggable={false}
                  className="w-full h-full object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-white" />
              </div>
            )}

            <div className="px-5 sm:px-7 pb-7 pt-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <span className={`inline-block text-[9px] font-black tracking-[0.18em] uppercase
                                   px-2 py-0.5 rounded-md text-white mb-2 ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-ink leading-tight line-clamp-2">
                    {title}
                  </h3>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {rating != null && (
                      <span className="text-sm font-semibold text-ink">
                        ★ {typeof rating === 'number' ? rating.toFixed(1) : String(rating)}
                      </span>
                    )}
                    {year && <span className="text-sm text-ink-mid">{year}</span>}
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full
                             bg-surface-high text-ink-light hover:text-ink transition-colors mt-0.5"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Genre / tag pills */}
              {(genres.length > 0 || gameTags.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(genres.length > 0 ? genres : gameTags).map(tag => (
                    <span key={tag}
                          className="text-[11px] px-2.5 py-1 rounded-full bg-surface-high
                                     text-ink-mid border border-line">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Overview */}
              {overview && (
                <p className="text-sm text-ink-mid leading-relaxed mt-3 line-clamp-4">
                  {overview}
                </p>
              )}

              {/* Similar / related row */}
              {loading && (
                <div className="flex gap-3 mt-6 overflow-hidden">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="shrink-0 w-36">
                      <div className="skeleton rounded-xl" style={{ aspectRatio: '16/9' }} />
                    </div>
                  ))}
                </div>
              )}

              {!loading && similar.length > 0 && (
                <div className="mt-6">
                  <p className="text-[10px] font-black tracking-[0.18em] uppercase text-ink-light mb-3">
                    {type === 'game' ? 'Similar Games' : 'More Like This'}
                  </p>
                  <DragRow gap="gap-3">
                    {similar.map(s => (
                      <div key={s.id ?? s.tmdbId} className="shrink-0 w-36 sm:w-40 pointer-events-auto">
                        <UnifiedCard
                          item={s}
                          type={type === 'game' ? 'game' : 'movie'}
                        />
                      </div>
                    ))}
                  </DragRow>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
