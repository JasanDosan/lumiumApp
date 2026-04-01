import { useEffect, useState, useMemo } from 'react';
import { getRelatedGames } from '@/data/gameMovieTags';
import UnifiedCard from '@/components/ui/UnifiedCard';
import DragRow from '@/components/ui/DragRow';
import GameRow from '@/features/games/GameRow';

// ─── Landscape discovery row ──────────────────────────────────────────────────

function DiscoveryRow({ items, type, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shrink-0 w-72 xl:w-80">
            <div className="skeleton aspect-video rounded-xl" />
          </div>
        ))}
      </div>
    );
  }
  if (!items.length) return (
    <p className="text-sm text-ink-light py-3">Nothing matched this game&apos;s vibe.</p>
  );
  return (
    <DragRow gap="gap-4">
      {items.map(item => (
        <div key={item.tmdbId ?? item.id} className="shrink-0 w-72 xl:w-80 pointer-events-auto">
          <UnifiedCard item={item} type={type} />
        </div>
      ))}
    </DragRow>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({ overline, title, subtitle, color = 'default' }) {
  const colorMap = {
    amber:   { bar: 'bg-amber-500',  over: 'text-amber-400'  },
    violet:  { bar: 'bg-violet-500', over: 'text-violet-400' },
    accent:  { bar: 'bg-accent',     over: 'text-accent'     },
    default: { bar: 'bg-line',       over: 'text-ink-light'  },
  };
  const c = colorMap[color] ?? colorMap.default;
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-0.5 h-5 ${c.bar} rounded-full shrink-0`} />
        <p className={`text-[10px] font-black tracking-[0.2em] uppercase ${c.over}`}>{overline}</p>
      </div>
      <h2 className="text-2xl font-bold text-ink leading-tight">{title}</h2>
      {subtitle && <p className="text-xs text-ink-light mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── GameModal ────────────────────────────────────────────────────────────────

export default function GameModal({
  game,
  movies = [],
  series = [],
  isLoading = false,
  isOpen,
  onClose,
  onGameSelect,
}) {
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible]           = useState(false);

  // ── Animation lifecycle ───────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      document.body.style.overflow = 'hidden';
      const t = setTimeout(() => setVisible(true), 16);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
      const t = setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = '';
      }, 350);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── ESC to close ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const similarGames = useMemo(() => getRelatedGames(game?.id, 8), [game?.id]);

  if (!shouldRender || !game) return null;

  const steamId = game.image?.match(/apps\/(\d+)\//)?.[1];
  const capsuleUrl = steamId
    ? `https://cdn.akamai.steamstatic.com/steam/apps/${steamId}/capsule_616x353.jpg`
    : null;

  return (
    <>
      {/* ── Backdrop ───────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm"
        style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 350ms cubic-bezier(0.32,0,0.67,0)',
        }}
        onClick={onClose}
      />

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 z-50 overflow-y-auto bg-canvas"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0) scale(1)' : 'translateY(28px) scale(0.98)',
          transition: 'opacity 350ms cubic-bezier(0.32,0,0.67,0), transform 350ms cubic-bezier(0.32,0,0.67,0)',
          willChange: 'opacity, transform',
        }}
      >
        {/* ── Compact hero ─────────────────────────────────────────────────── */}
        <div className="relative h-72 sm:h-80 overflow-hidden">
          {game.image && (
            <img
              src={game.image}
              alt={game.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/60 to-canvas/20" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/70 backdrop-blur-sm transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Hero text */}
          <div className="absolute bottom-0 inset-x-0 px-6 sm:px-10 pb-8">
            <div className="max-w-screen-xl mx-auto">
              <p className="text-[10px] font-black tracking-[0.22em] text-accent uppercase mb-2">
                {game.tags?.[0] ?? 'Game'}
              </p>
              <h1 className="text-4xl sm:text-5xl font-black text-ink leading-none tracking-tight">
                {game.emoji}&nbsp;{game.name}
              </h1>
              {game.tagline && (
                <p className="text-sm text-ink-mid mt-2 max-w-md">{game.tagline}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Content ────────────────────────────────────────────────────────── */}
        <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 pb-24">

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 py-6 border-b border-line">
            {game.rating != null && (
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-ink">{game.rating}</span>
                <span className="text-xs text-ink-light">/ 10</span>
              </div>
            )}
            {game.price != null && (
              <div className="text-sm font-semibold text-ink">
                {game.price === 0 ? 'Free to Play' : `$${game.price.toFixed(2)}`}
              </div>
            )}
            {game.meta?.mood?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {game.meta.mood.map(m => (
                  <span key={m} className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.07] text-ink-mid border border-white/[0.08] capitalize">
                    {m.replace('_', ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Description */}
          {(game.description ?? game.tagline) && (
            <p className="text-sm text-ink-mid leading-relaxed max-w-2xl mt-6">
              {game.description ?? game.tagline}
            </p>
          )}

          {/* Tags */}
          {game.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {game.tags.map(tag => (
                <span key={tag} className="text-[12px] px-3 py-1 rounded-full border border-line text-ink-mid">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="border-t border-line mt-10" />

          {/* ── Related Movies ───────────────────────────────────────────────── */}
          <section className="pt-10">
            <SectionHead
              overline="Films"
              title={`Movies for ${game.name} fans`}
              subtitle={isLoading ? undefined : `${movies.length} titles matched`}
              color="amber"
            />
            <DiscoveryRow items={movies} type="movie" isLoading={isLoading} />
          </section>

          {/* ── Related Series ───────────────────────────────────────────────── */}
          <section className="pt-14">
            <SectionHead
              overline="Series"
              title={`Shows that match ${game.name}`}
              subtitle={isLoading ? undefined : `${series.length} titles matched`}
              color="violet"
            />
            <DiscoveryRow items={series} type="series" isLoading={isLoading} />
          </section>

          {/* ── Game Media ───────────────────────────────────────────────────── */}
          {(capsuleUrl || game.image) && (
            <section className="pt-14">
              <SectionHead overline="Media" title="Game Media" />
              <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                {capsuleUrl && (
                  <img
                    src={capsuleUrl}
                    alt={`${game.name} capsule`}
                    className="shrink-0 h-40 rounded-xl object-cover bg-surface-high"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                {game.image && (
                  <img
                    src={game.image}
                    alt={`${game.name} header`}
                    className="shrink-0 h-40 rounded-xl object-cover bg-surface-high"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>
            </section>
          )}

          {/* ── Similar Games ────────────────────────────────────────────────── */}
          <section className="pt-14">
            <SectionHead overline="Similar games" title="You might also like" color="accent" />
            <GameRow
              games={similarGames}
              onSelect={(id) => onGameSelect(id)}
              cardWidth="w-44 sm:w-52"
            />
          </section>

        </div>
      </div>
    </>
  );
}
