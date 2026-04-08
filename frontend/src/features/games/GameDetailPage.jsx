import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { rawgService } from '@/services/rawgService';
import { GAME_CATALOG, translateMetaToTMDB, getRelatedGames } from '@/data/gameMovieTags';
import { useUserLibraryStore } from '@/features/library/libraryStore';
import DetailHero from '@/components/detail/DetailHero';
import { toast } from '@/stores/toastStore';
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

// ─── RAWG ID resolver ─────────────────────────────────────────────────────────

/**
 * Given the URL :id param, a library item, and a catalog game, determine the
 * RAWG numeric ID to use for the detail fetch.
 * Returns null if no RAWG ID can be resolved.
 */
async function resolveRawgId(urlId, libraryItem, catalogGame) {
  // 1. Direct RAWG numeric ID in the URL
  if (/^\d+$/.test(urlId)) return urlId;

  // 2. Library item already has a RAWG rawId
  if (libraryItem?.rawId && /^\d+$/.test(libraryItem.rawId)) return libraryItem.rawId;

  // 3. Library item enriched at Steam import — metadata.rawgId
  if (libraryItem?.metadata?.rawgId && /^\d+$/.test(String(libraryItem.metadata.rawgId))) {
    return String(libraryItem.metadata.rawgId);
  }

  // 4. Search by title (catalog game or Steam game without rawgId)
  const searchTitle = catalogGame?.name ?? libraryItem?.title ?? null;
  if (!searchTitle) return null;

  try {
    const results = await rawgService.search(searchTitle, 3);
    if (!results.length) return null;

    // Accept the first result whose name is a close match
    const normalize = (s) => s.toLowerCase().replace(/[™®:–—''".!?,]/g, '').replace(/\s+/g, ' ').trim();
    const target = normalize(searchTitle);

    for (const r of results) {
      const candidate = normalize(r.name ?? '');
      if (candidate === target || candidate.includes(target) || target.includes(candidate)) {
        return String(r.id);
      }
    }
    // Fallback: just take first result
    return results[0] ? String(results[0].id) : null;
  } catch {
    return null;
  }
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

// ─── Tag pill ─────────────────────────────────────────────────────────────────

function TagPill({ label }) {
  return (
    <span className="text-[12px] px-3 py-1 rounded-full border border-line text-ink-mid cursor-default">
      {label}
    </span>
  );
}

// ─── Stat block ───────────────────────────────────────────────────────────────

function StatBlock({ label, value, children }) {
  if (!value && !children) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-ink-light mb-1">{label}</p>
      {children ?? <p className="text-sm font-medium text-ink">{value}</p>}
    </div>
  );
}

// ─── Metacritic badge ─────────────────────────────────────────────────────────

function MetacriticBadge({ score, url }) {
  if (!score) return null;
  const color =
    score >= 75 ? 'bg-green-500 text-white' :
    score >= 50 ? 'bg-yellow-400 text-black' :
                  'bg-red-500 text-white';
  const inner = (
    <span className={`inline-flex items-center justify-center w-12 h-12 rounded-lg text-xl font-black ${color}`}>
      {score}
    </span>
  );
  if (url) return <a href={url} target="_blank" rel="noopener noreferrer">{inner}</a>;
  return inner;
}

// ─── ESRB badge ───────────────────────────────────────────────────────────────

function EsrbBadge({ rating }) {
  if (!rating) return null;
  const abbr = {
    everyone:         'E',
    'everyone-10-plus': 'E10+',
    teen:             'T',
    mature:           'M',
    'adults-only':    'AO',
    'rating-pending': 'RP',
  };
  return (
    <div className="inline-flex flex-col items-center justify-center w-10 h-12 border-2 border-ink-mid rounded px-1">
      <span className="text-[8px] font-black tracking-tight text-ink-mid leading-none">ESRB</span>
      <span className="text-base font-black text-ink leading-none mt-0.5">{abbr[rating.slug] ?? rating.name[0]}</span>
    </div>
  );
}

// ─── Ratings breakdown ────────────────────────────────────────────────────────

function RatingsBreakdown({ ratings, total }) {
  if (!ratings?.length || !total) return null;
  const labelColors = {
    exceptional: 'bg-green-500',
    recommended: 'bg-blue-500',
    meh:         'bg-yellow-400',
    skip:        'bg-red-400',
  };
  return (
    <div className="space-y-2">
      {ratings.map(r => (
        <div key={r.id} className="flex items-center gap-3">
          <span className="text-xs text-ink-light w-24 capitalize">{r.title}</span>
          <div className="flex-1 h-1.5 bg-surface-high rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${labelColors[r.title] ?? 'bg-accent'}`}
              style={{ width: `${r.percent}%` }}
            />
          </div>
          <span className="text-xs text-ink-light w-10 text-right tabular-nums">{r.count.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Screenshots gallery ──────────────────────────────────────────────────────

function ScreenshotGallery({ screenshots }) {
  if (!screenshots?.length) return null;
  return (
    <DragRow gap="gap-3">
      {screenshots.map(s => (
        <a
          key={s.id}
          href={s.image}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 w-72 xl:w-80 pointer-events-auto rounded-xl overflow-hidden
                     ring-1 ring-transparent hover:ring-accent/30 transition-all duration-200"
        >
          <img
            src={s.image}
            alt="Screenshot"
            loading="lazy"
            draggable={false}
            className="aspect-video w-full object-cover"
          />
        </a>
      ))}
    </DragRow>
  );
}

// ─── Discovery row (movies / series) ─────────────────────────────────────────

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

// ─── About section ────────────────────────────────────────────────────────────

function AboutSection({ description }) {
  const [expanded, setExpanded] = useState(false);
  if (!description) return null;
  const cutoff = 500;
  const displayText = description.length > cutoff && !expanded
    ? description.slice(0, cutoff).trimEnd() + '…'
    : description;
  return (
    <section>
      <SectionHead overline="About" title="About the game" color="accent" />
      <p className="text-sm text-ink-mid leading-relaxed max-w-prose">{displayText}</p>
      {description.length > cutoff && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-2 text-xs text-ink-light hover:text-ink transition-colors"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </section>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="skeleton w-full" style={{ height: 'min(70vh, 640px)' }} />
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-12 space-y-14">
        <div className="space-y-3">
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-5/6 rounded" />
          <div className="skeleton h-4 w-4/6 rounded" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shrink-0 w-72">
              <div className="skeleton aspect-video rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GameDetailPage ───────────────────────────────────────────────────────────

export default function GameDetailPage() {
  const { id } = useParams();
  const { addGame, removeGame, hasGame, addItem, removeItem, library } = useUserLibraryStore();

  // ── Base game resolution ──────────────────────────────────────────────────
  const catalogGame  = GAME_CATALOG.find(g => g.id === id);
  const libraryItem  = library.find(
    i => i.type === 'game' && (i.rawId === id || i.externalId === id)
  );
  const isSteamGame  = id?.startsWith('steam_');

  // ── Page state ────────────────────────────────────────────────────────────
  const [rawgDetail,      setRawgDetail]      = useState(null);
  const [rawgLoading,     setRawgLoading]     = useState(true);
  const [relatedMovies,   setRelatedMovies]   = useState([]);
  const [moviesLoading,   setMoviesLoading]   = useState(false);
  const [relatedSeries,   setRelatedSeries]   = useState([]);
  const [seriesLoading,   setSeriesLoading]   = useState(false);
  const [similar,         setSimilar]         = useState([]);
  const fetchedRef = useRef(false);

  // ── Save state ────────────────────────────────────────────────────────────
  // isSaved checks by: rawgDetail ID (if fetched), library item rawId, or direct id
  const savedId = rawgDetail?.rawgId ?? libraryItem?.rawId ?? (isSteamGame ? null : id);
  const isSaved = savedId
    ? hasGame(savedId)
    : isSteamGame && libraryItem
      ? library.some(i => i.id === libraryItem.id)
      : false;

  // ── Record recently viewed ────────────────────────────────────────────────
  useEffect(() => {
    if (id) recordRecentGame(id);
  }, [id]);

  // ── Main data fetch ───────────────────────────────────────────────────────
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const load = async () => {
      setRawgLoading(true);

      // 1. Resolve RAWG ID
      const rawgId = await resolveRawgId(id, libraryItem, catalogGame);

      // 2. Fetch RAWG detail
      if (rawgId) {
        try {
          const detail = await rawgService.getDetails(rawgId);
          setRawgDetail(detail);

          // 3. Fetch similar/series (non-blocking)
          rawgService.getSimilar(rawgId)
            .then(results => setSimilar(results.slice(0, 10)))
            .catch(() => {});

          // 4. Fetch related movies/series for catalog games
          if (catalogGame) {
            const filters = translateMetaToTMDB(catalogGame.meta);
            setMoviesLoading(true);
            setSeriesLoading(true);

            movieService.discover({ ...filters, page: 1 })
              .then(data => setRelatedMovies((data.results ?? []).slice(0, 16)))
              .catch(() => {})
              .finally(() => setMoviesLoading(false));

            tvService.discover({ genres: filters.genres, sort_by: filters.sort_by })
              .then(data => setRelatedSeries((data.results ?? []).slice(0, 16)))
              .catch(() => {})
              .finally(() => setSeriesLoading(false));
          }
        } catch {
          // RAWG fetch failed — page degrades to stored data
        }
      }

      setRawgLoading(false);
    };

    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Merged view model ─────────────────────────────────────────────────────
  const game = useMemo(() => {
    const base = catalogGame ?? (libraryItem
      ? {
          id,
          name:        libraryItem.title,
          image:       libraryItem.imageUrl ?? libraryItem.image ?? null,
          emoji:       libraryItem.emoji ?? null,
          tags:        libraryItem.tags  ?? [],
          rating:      libraryItem.rating ?? null,
          price:       null,
          tagline:     null,
          description: null,
          meta:        null,
        }
      : null);

    if (!base) return null;

    // Merge RAWG detail on top of base (RAWG wins for editorial fields)
    if (!rawgDetail) return base;

    return {
      ...base,
      // RAWG editorial fields
      name:              rawgDetail.title        ?? base.name,
      description:       rawgDetail.description  ?? base.description ?? null,
      image:             rawgDetail.backgroundImage ?? base.image,
      backgroundImage:   rawgDetail.backgroundImage ?? null,
      backgroundImageAlt: rawgDetail.backgroundImageAlt ?? null,
      rating:            rawgDetail.rating       ?? base.rating,
      ratingTop:         rawgDetail.ratingTop,
      ratingsCount:      rawgDetail.ratingsCount,
      ratings:           rawgDetail.ratings      ?? [],
      metacritic:        rawgDetail.metacritic   ?? null,
      metacriticUrl:     rawgDetail.metacriticUrl ?? null,
      released:          rawgDetail.released     ?? null,
      website:           rawgDetail.website      ?? null,
      esrbRating:        rawgDetail.esrbRating   ?? null,
      genres:            rawgDetail.genres       ?? [],
      tags:              rawgDetail.tags?.map(t => t.name) ?? base.tags ?? [],
      platforms:         rawgDetail.platforms    ?? [],
      developers:        rawgDetail.developers   ?? [],
      publishers:        rawgDetail.publishers   ?? [],
      stores:            rawgDetail.stores       ?? [],
      screenshots:       rawgDetail.screenshots  ?? [],
      redditUrl:         rawgDetail.redditUrl    ?? null,
      redditName:        rawgDetail.redditName   ?? null,
      redditCount:       rawgDetail.redditCount  ?? null,
      achievementsCount: rawgDetail.achievementsCount ?? null,
      playtimeAvg:       rawgDetail.playtimeAvg  ?? null,
      rawgId:            rawgDetail.rawgId,
    };
  }, [id, catalogGame, libraryItem, rawgDetail]);

  // Playtime from Steam library item (minutes)
  const steamPlaytime = isSteamGame ? (libraryItem?.metadata?.playtime ?? null) : null;
  const steamAppId    = isSteamGame
    ? (libraryItem?.metadata?.steamAppId ?? id.replace('steam_', ''))
    : null;

  // ── Toggle save ───────────────────────────────────────────────────────────
  const handleToggleSave = () => {
    if (!game) return;

    if (isSteamGame && libraryItem) {
      // Steam game — remove by library item id
      if (isSaved) {
        removeItem(libraryItem.id);
        toast('Removed from library');
      }
      // If not saved, it means they removed it — re-add from current rawgDetail
      else if (rawgDetail) {
        addGame({ ...rawgDetail, id: rawgDetail.rawgId });
        toast(`Saved — ${game.name}`);
      }
      return;
    }

    const gameId = rawgDetail?.rawgId ?? (isSteamGame ? null : id);
    if (!gameId) return;

    if (isSaved) {
      removeGame(gameId);
      toast('Removed from library');
    } else {
      addGame({ ...game, id: gameId });
      toast(`Saved — ${game.name}`);
    }
  };

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!rawgLoading && !game) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-4">
        <p className="text-2xl mb-2">🎮</p>
        <p className="text-sm font-semibold text-ink-mid">Game not found</p>
        <p className="text-xs text-ink-light mb-2">
          This game isn&apos;t in your library or catalog.
        </p>
        <Link to="/" className="text-sm text-accent hover:text-accent-hover transition-colors">
          Go home →
        </Link>
      </div>
    );
  }

  if (rawgLoading && !game) return <DetailSkeleton />;
  if (!game) return null;

  // ── Hero meta row ─────────────────────────────────────────────────────────
  const releaseYear = game.released ? new Date(game.released).getFullYear() : null;
  const heroMeta = [
    releaseYear                  && { value: String(releaseYear), bold: true },
    game.rating != null          && { value: game.rating.toFixed(1), icon: 'star' },
    game.metacritic              && { value: `MC ${game.metacritic}`, bold: false },
    game.platforms?.length       && { value: game.platforms.slice(0, 3).map(p => p.name).join(' / ') },
  ].filter(Boolean);

  // Hero display tags: prefer RAWG genres, fall back to catalog/stored tags
  const heroTags = game.genres?.length
    ? game.genres.slice(0, 4).map(g => g.name)
    : (Array.isArray(game.tags) ? game.tags.slice(0, 4) : []);

  // Similar games: prefer RAWG game-series, fall back to GAME_CATALOG related
  const similarGames = similar.length > 0 ? similar : getRelatedGames(id, 8);

  return (
    <div className="min-h-screen bg-canvas">

      {/* ══════════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════════ */}
      <DetailHero
        type="game"
        backdropUrl={game.backgroundImage ?? game.image}
        emoji={game.emoji}
        title={game.name}
        tagline={game.description ? null : game.tagline}
        tags={heroTags}
        meta={heroMeta}
        isSaved={isSaved}
        onToggleSave={handleToggleSave}
      />

      {/* ══════════════════════════════════════════════════════════════════
          CONTENT
      ══════════════════════════════════════════════════════════════════ */}
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 pb-24 space-y-14 pt-12">

        {/* ── Stats strip ──────────────────────────────────────────────── */}
        {(game.metacritic || game.esrbRating || game.released || game.achievementsCount || game.playtimeAvg) && (
          <section className="flex flex-wrap items-start gap-8">
            <MetacriticBadge score={game.metacritic} url={game.metacriticUrl} />
            <EsrbBadge rating={game.esrbRating} />
            <StatBlock label="Release date" value={game.released
              ? new Date(game.released).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
              : null}
            />
            {game.playtimeAvg && (
              <StatBlock label="Avg. playtime">
                <p className="text-sm font-medium text-ink">{game.playtimeAvg}h</p>
                <p className="text-[11px] text-ink-light">RAWG community avg</p>
              </StatBlock>
            )}
            {game.achievementsCount && (
              <StatBlock label="Achievements" value={game.achievementsCount.toLocaleString()} />
            )}
            {game.ratingsCount > 0 && (
              <StatBlock label="Ratings" value={game.ratingsCount.toLocaleString()} />
            )}
          </section>
        )}

        {/* ── Steam playtime ────────────────────────────────────────────── */}
        {steamPlaytime != null && steamPlaytime > 0 && (
          <section className="inline-flex items-center gap-4 px-6 py-4 rounded-2xl
                              bg-surface border border-line">
            <span className="text-2xl">🎮</span>
            <div>
              <p className="text-[10px] font-black tracking-[0.2em] uppercase text-accent mb-0.5">
                Your Steam stats
              </p>
              <p className="text-2xl font-black text-ink tabular-nums">
                {steamPlaytime >= 60
                  ? `${(steamPlaytime / 60).toFixed(1)}h`
                  : `${steamPlaytime}m`}
              </p>
              <p className="text-xs text-ink-light mt-0.5">played</p>
            </div>
            {steamAppId && (
              <a
                href={`https://store.steampowered.com/app/${steamAppId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-4 text-xs text-ink-light hover:text-ink transition-colors"
              >
                View on Steam →
              </a>
            )}
          </section>
        )}

        {/* ── About ─────────────────────────────────────────────────────── */}
        <AboutSection description={game.description} />

        {/* ── Tags + genres ─────────────────────────────────────────────── */}
        {(game.genres?.length > 0 || (Array.isArray(game.tags) && game.tags.length > 0)) && (
          <section>
            <SectionHead overline="Classification" title="Genres & tags" />
            {game.genres?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {game.genres.map(g => (
                  <span key={g.id ?? g}
                    className="text-[11px] font-semibold px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
                    {g.name ?? g}
                  </span>
                ))}
              </div>
            )}
            {Array.isArray(game.tags) && game.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {game.tags.slice(0, 24).map((t, i) => (
                  <TagPill key={i} label={typeof t === 'object' ? t.name : t} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Platforms ─────────────────────────────────────────────────── */}
        {game.platforms?.length > 0 && (
          <section>
            <SectionHead overline="Available on" title="Platforms" />
            <div className="flex flex-wrap gap-2">
              {game.platforms.map(p => (
                <span key={p.id}
                  className="text-sm px-4 py-2 rounded-xl border border-line text-ink-mid bg-surface">
                  {p.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── Ratings breakdown ─────────────────────────────────────────── */}
        {game.ratings?.length > 0 && (
          <section>
            <SectionHead overline="Community verdict" title="Player ratings" />
            <div className="max-w-sm">
              <RatingsBreakdown ratings={game.ratings} total={game.ratingsCount} />
            </div>
          </section>
        )}

        {/* ── Developers + Publishers ───────────────────────────────────── */}
        {(game.developers?.length > 0 || game.publishers?.length > 0) && (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            {game.developers?.length > 0 && (
              <div>
                <p className="section-label mb-3">Developed by</p>
                <div className="flex flex-wrap gap-2">
                  {game.developers.map(d => (
                    <span key={d.id}
                      className="text-sm px-4 py-2 rounded-xl border border-line text-ink-mid bg-surface">
                      {d.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {game.publishers?.length > 0 && (
              <div>
                <p className="section-label mb-3">Published by</p>
                <div className="flex flex-wrap gap-2">
                  {game.publishers.map(p => (
                    <span key={p.id}
                      className="text-sm px-4 py-2 rounded-xl border border-line text-ink-mid bg-surface">
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Screenshots ───────────────────────────────────────────────── */}
        {game.screenshots?.length > 0 && (
          <section>
            <SectionHead overline="Gallery" title="Screenshots" />
            <ScreenshotGallery screenshots={game.screenshots} />
          </section>
        )}

        {/* ── Stores + website ──────────────────────────────────────────── */}
        {(game.stores?.length > 0 || game.website) && (
          <section>
            <SectionHead overline="Where to play" title="Stores & links" />
            <div className="flex flex-wrap gap-2">
              {game.website && (
                <a
                  href={game.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl border border-line
                             text-ink-mid bg-surface hover:border-accent/40 hover:text-ink transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                  </svg>
                  Official site
                </a>
              )}
              {game.stores?.map(s => (
                s.url ? (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm px-4 py-2 rounded-xl border border-line text-ink-mid bg-surface
                               hover:border-accent/40 hover:text-ink transition-colors"
                  >
                    {s.name}
                  </a>
                ) : (
                  <span key={s.id}
                    className="text-sm px-4 py-2 rounded-xl border border-line text-ink-mid bg-surface">
                    {s.name}
                  </span>
                )
              ))}
            </div>
          </section>
        )}

        {/* ── Reddit / Community ────────────────────────────────────────── */}
        {game.redditUrl && (
          <section>
            <SectionHead overline="Community" title={game.redditName ?? 'Reddit'} />
            <a
              href={game.redditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-5 py-3 rounded-xl border border-line
                         bg-surface hover:border-accent/40 transition-colors group"
            >
              <span className="text-xl">📣</span>
              <div>
                <p className="text-sm font-semibold text-ink group-hover:text-accent transition-colors">
                  {game.redditName ?? 'Community subreddit'}
                </p>
                {game.redditCount != null && (
                  <p className="text-xs text-ink-light">{game.redditCount.toLocaleString()} members</p>
                )}
              </div>
              <svg className="w-4 h-4 text-ink-light ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </section>
        )}

        {/* ── Similar / game series ─────────────────────────────────────── */}
        {similarGames.length > 0 && (
          <>
            <div className="border-t border-line" />
            <section>
              <SectionHead
                overline="More like this"
                title={similar.length > 0 ? 'Game series' : 'You might also like'}
                color="accent"
              />
              <GameRow games={similarGames} cardWidth="w-44 sm:w-52" />
            </section>
          </>
        )}

        {/* ── Related movies (catalog games only) ──────────────────────── */}
        {catalogGame && (
          <>
            <div className="border-t border-line" />

            <section>
              <SectionHead
                overline="Films"
                title={`Movies for ${game.name} fans`}
                subtitle={moviesLoading ? undefined : `${relatedMovies.length} titles matched`}
                color="amber"
              />
              <DiscoveryRow items={relatedMovies} type="movie" isLoading={moviesLoading} />
            </section>

            <section>
              <SectionHead
                overline="Series"
                title={`Shows that match ${game.name}`}
                subtitle={seriesLoading ? undefined : `${relatedSeries.length} titles matched`}
                color="violet"
              />
              <DiscoveryRow items={relatedSeries} type="series" isLoading={seriesLoading} />
            </section>
          </>
        )}

      </div>
    </div>
  );
}
