import { useEffect, useState, useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { GAME_CATALOG, translateMetaToTMDB, getRelatedGames } from '@/data/gameMovieTags';
import GameHero from './GameHero';
import GameRow from './GameRow';
import UnifiedCard from '@/components/ui/UnifiedCard';
import DragRow from '@/components/ui/DragRow';

// ─── localStorage: track recently played ─────────────────────────────────────

function recordRecentGame(id) {
  try {
    const prev    = JSON.parse(localStorage.getItem('pm_recent_games') || '[]');
    const updated = [id, ...prev.filter(x => x !== id)].slice(0, 8);
    localStorage.setItem('pm_recent_games', JSON.stringify(updated));
  } catch { /* silent */ }
}

// ─── Landscape discovery row ──────────────────────────────────────────────────

function DiscoveryRow({ items, type, isLoading }) {
  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shrink-0 w-64 xl:w-72">
            <div className="skeleton aspect-video rounded-xl" />
          </div>
        ))}
      </div>
    );
  }
  if (!items.length) return (
    <p className="text-sm text-ink-light py-3">Nothing matched this game's vibe.</p>
  );
  return (
    <DragRow gap="gap-4">
      {items.map(item => (
        <div key={item.tmdbId ?? item.id} className="shrink-0 w-64 xl:w-72 pointer-events-auto">
          <UnifiedCard item={item} type={type} />
        </div>
      ))}
    </DragRow>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({ overline, title, subtitle, color = 'default' }) {
  const colorMap = {
    amber:  { bar: 'bg-amber-500',  over: 'text-amber-400'  },
    violet: { bar: 'bg-violet-500', over: 'text-violet-400' },
    accent: { bar: 'bg-accent',     over: 'text-accent'     },
    default:{ bar: 'bg-line',       over: 'text-ink-light'  },
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

// ─── Tag pill ─────────────────────────────────────────────────────────────────

function TagPill({ label }) {
  return (
    <span className="text-[12px] px-3 py-1 rounded-full border border-line text-ink-mid cursor-default">
      {label}
    </span>
  );
}

// ─── GameDetailPage ───────────────────────────────────────────────────────────

export default function GameDetailPage() {
  const { id } = useParams();
  const game   = GAME_CATALOG.find(g => g.id === id);

  const [relatedMovies, setRelatedMovies] = useState([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [relatedSeries, setRelatedSeries] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(true);

  const similarGames = useMemo(() => getRelatedGames(id, 8), [id]);

  // Record this game as recently played
  useEffect(() => {
    if (id) recordRecentGame(id);
  }, [id]);

  // Fetch related media
  useEffect(() => {
    if (!game) return;

    const filters = translateMetaToTMDB(game.meta);

    movieService.discover({ ...filters, page: 1 })
      .then(data => setRelatedMovies((data.results || []).slice(0, 16)))
      .catch(console.error)
      .finally(() => setMoviesLoading(false));

    tvService.discover({ genres: filters.genres, sort_by: filters.sort_by })
      .then(data => setRelatedSeries((data.results || []).slice(0, 16)))
      .catch(console.error)
      .finally(() => setSeriesLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!game) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-canvas">

      {/* ══════════════════════════════════════════════════════════════════
          HERO — large image, title, tags, rating, CTA
      ══════════════════════════════════════════════════════════════════ */}
      <GameHero game={game} />

      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">

        {/* ════════════════════════════════════════════════════════════════
            GAME INFO — short description + metadata
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-12 pb-2">
          <div className="flex flex-col sm:flex-row gap-8">
            {/* Description */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink-mid leading-relaxed max-w-prose">
                {game.description ?? game.tagline}
              </p>
              {game.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {game.tags.map(tag => <TagPill key={tag} label={tag} />)}
                </div>
              )}
            </div>

            {/* Metadata sidebar */}
            <div className="shrink-0 sm:w-52 space-y-5">
              {game.price != null && (
                <div>
                  <p className="section-label mb-1">Price</p>
                  <p className="text-3xl font-black text-ink">
                    {game.price === 0 ? 'Free' : `$${game.price.toFixed(2)}`}
                  </p>
                </div>
              )}
              {game.rating != null && (
                <div>
                  <p className="section-label mb-1">Score</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-ink">{game.rating}</span>
                    <span className="text-sm text-ink-light">/ 10</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            MEDIA — game capsule art / alternate images
        ════════════════════════════════════════════════════════════════ */}
        {(() => {
          const steamId = game.image?.match(/apps\/(\d+)\//)?.[1];
          if (!steamId) return null;
          const capsuleUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${steamId}/capsule_616x353.jpg`;
          return (
            <section className="pt-10">
              <SectionHead overline="Media" title="Game Media" color="default" />
              <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                <img
                  src={capsuleUrl}
                  alt={`${game.name} capsule`}
                  className="shrink-0 h-40 rounded-xl object-cover bg-surface-high"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
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
          );
        })()}

        <div className="border-t border-line mt-12" />

        {/* ════════════════════════════════════════════════════════════════
            RELATED MOVIES — prominent, NOT secondary
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-12">
          <SectionHead
            overline="Films"
            title={`Movies for ${game.name} fans`}
            subtitle="Matched by mood, theme & genre"
            color="amber"
          />
          <DiscoveryRow items={relatedMovies} type="movie" isLoading={moviesLoading} />
        </section>

        {/* ════════════════════════════════════════════════════════════════
            RELATED SERIES — prominent, NOT secondary
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14">
          <SectionHead
            overline="Series"
            title={`Shows that match ${game.name}`}
            subtitle="Same energy, different screen"
            color="violet"
          />
          <DiscoveryRow items={relatedSeries} type="series" isLoading={seriesLoading} />
        </section>

        {/* ════════════════════════════════════════════════════════════════
            SIMILAR GAMES
        ════════════════════════════════════════════════════════════════ */}
        <section className="pt-14 pb-20">
          <SectionHead overline="Similar games" title="You might also like" color="accent" />
          <GameRow games={similarGames} cardWidth="w-44 sm:w-52" />
        </section>

      </div>
    </div>
  );
}
