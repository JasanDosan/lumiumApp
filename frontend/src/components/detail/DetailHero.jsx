import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Unified full-width hero for game / movie / series detail pages.
 *
 * Props:
 *   type          — 'game' | 'movie' | 'series'
 *   backdropUrl   — hero background image (game screenshot / movie|series backdrop)
 *   posterUrl     — floating thumbnail shown on desktop (movie/series only)
 *   emoji         — fallback background character when no backdropUrl (games)
 *   title         — display title
 *   tagline       — italic subline (movies/games)
 *   tags          — genre/tag chips rendered before title (games)
 *   meta          — array of { value, icon?, bold? } for the meta row
 *                   icon: 'star' → renders a yellow star icon
 *                   bold: true  → renders value in white/80 medium weight
 *   isSaved       — save button state
 *   onToggleSave  — save toggle handler; undefined → no save button rendered
 *   actions       — extra ReactNode CTAs placed after the save button
 */

const TYPE_CONFIG = {
  game:   { badge: 'bg-accent',     label: 'GAME',   height: 'min(70vh, 640px)', gradient: 'from-black/90' },
  movie:  { badge: 'bg-amber-500',  label: 'FILM',   height: 'min(80vh, 720px)', gradient: 'from-black/85' },
  series: { badge: 'bg-violet-500', label: 'SERIES', height: 'min(80vh, 720px)', gradient: 'from-black/85' },
};

function StarIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function SaveIcon({ type, isSaved }) {
  if (type === 'movie') {
    return (
      <svg
        className={`w-4 h-4 ${isSaved ? 'fill-red-400 stroke-red-400' : 'fill-none stroke-current'}`}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    );
  }
  return (
    <svg
      className={`w-4 h-4 ${isSaved ? 'fill-current stroke-current' : 'fill-none stroke-current'}`}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  );
}

export default function DetailHero({
  type = 'movie',
  backdropUrl = null,
  posterUrl   = null,
  emoji       = null,
  title,
  tagline     = null,
  tags        = [],
  meta        = [],
  isSaved     = false,
  onToggleSave,
  actions     = null,
}) {
  const navigate = useNavigate();
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.movie;

  return (
    <div className="relative w-full overflow-hidden" style={{ height: cfg.height }}>

      {/* ── Background ──────────────────────────────────────────────────── */}
      {backdropUrl ? (
        <img src={backdropUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-surface-high via-canvas to-canvas flex items-center justify-center">
          {emoji && <span className="text-[10rem] opacity-10 select-none">{emoji}</span>}
        </div>
      )}

      {/* ── Gradient overlays ───────────────────────────────────────────── */}
      <div className={`absolute inset-0 bg-gradient-to-r ${cfg.gradient} via-black/60 to-transparent`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {/* ── Back button ─────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-5 left-5 sm:left-8 lg:left-12 z-20 flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* ── Floating poster — desktop only ──────────────────────────────── */}
      {posterUrl && (
        <div className="absolute right-8 lg:right-16 bottom-12 hidden lg:block z-10">
          <img
            src={posterUrl}
            alt={title}
            className="w-44 rounded-xl shadow-2xl ring-1 ring-white/10"
          />
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="relative h-full flex flex-col justify-end px-5 sm:px-8 lg:px-12 pb-10 pt-20 max-w-screen-xl mx-auto z-10">
        <div className="max-w-2xl">

          {/* Type badge */}
          <span className={`inline-block text-[10px] font-black tracking-[0.2em] uppercase
                            ${cfg.badge} text-white px-2.5 py-1 rounded-md mb-3`}>
            {cfg.label}
          </span>

          {/* Game tag chips (above title) */}
          {type === 'game' && tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.slice(0, 4).map(tag => (
                <span
                  key={tag}
                  className="text-[10px] font-medium px-2 py-0.5 rounded bg-white/10 text-white/65 border border-white/10 backdrop-blur-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Tagline — above title for movies, below for games */}
          {tagline && type === 'movie' && (
            <p className="text-white/50 text-sm italic mb-3 tracking-wide">{tagline}</p>
          )}

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tight mb-4">
            {title}
          </h1>

          {/* Tagline — below title for games */}
          {tagline && type === 'game' && (
            <p className="text-sm text-white/60 leading-relaxed max-w-md mb-4">{tagline}</p>
          )}

          {/* Meta row */}
          {meta.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-6 text-white/60 text-sm">
              {meta.map((m, i) => (
                <Fragment key={i}>
                  {i > 0 && <span className="text-white/30">·</span>}
                  <span className={`flex items-center gap-1 ${m.bold ? 'text-white/80 font-medium' : ''}`}>
                    {m.icon === 'star' && <StarIcon />}
                    {m.value}
                  </span>
                </Fragment>
              ))}
            </div>
          )}

          {/* Actions row */}
          {(onToggleSave || actions) && (
            <div className="flex flex-wrap gap-3">
              {onToggleSave && (
                <button
                  onClick={onToggleSave}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                    isSaved
                      ? 'bg-white text-ink'
                      : 'bg-white/15 text-white border border-white/25 hover:bg-white/25'
                  }`}
                >
                  <SaveIcon type={type} isSaved={isSaved} />
                  {isSaved ? 'Saved' : 'Save'}
                </button>
              )}
              {actions}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
