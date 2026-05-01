import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tvService } from '@/services/tvService';
import { useUserLibraryStore, normalizeSeries } from '@/features/library/libraryStore';
import DetailHero from '@/components/detail/DetailHero';
import HScrollRow from '@/components/detail/HScrollRow';
import { toast } from '@/stores/toastStore';
import UnifiedCard from '@/components/ui/UnifiedCard';
import DragRow from '@/components/ui/DragRow';

// ─── Shared sub-components ────────────────────────────────────────────────────

function Stat({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-ink-light mb-0.5">
        {label}
      </p>
      <p className="text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

function CastCard({ person }) {
  const href = person.id ? `/person/${person.id}` : null;
  const inner = (
    <div className="shrink-0 w-28">
      <div className="aspect-[2/3] rounded-md overflow-hidden bg-surface-high">
        {person.profileUrl ? (
          <img
            src={person.profileUrl}
            alt={person.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-high">
            <span className="text-2xl text-ink-faint select-none">◎</span>
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-[12px] font-semibold text-ink leading-tight line-clamp-2">{person.name}</p>
        {person.character && (
          <p className="text-[11px] text-ink-light mt-0.5 line-clamp-1 italic">{person.character}</p>
        )}
      </div>
    </div>
  );
  if (href) return <Link to={href} className="group block">{inner}</Link>;
  return <div>{inner}</div>;
}

// ─── Overview section ─────────────────────────────────────────────────────────

function OverviewSection({ series }) {
  const [expanded, setExpanded] = useState(false);
  const overview  = series.overview ?? series.metadata?.overview ?? '';
  const cutoff    = 360;
  const displayText = overview.length > cutoff && !expanded
    ? overview.slice(0, cutoff).trimEnd() + '…'
    : overview;

  const genres = (series.genres ?? []).filter(g => {
    if (typeof g === 'object' && g !== null) return !!g.name;
    if (typeof g === 'string')               return !!g;
    return false;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 lg:gap-16">
      {/* Left — overview + genres */}
      <div>
        <p className="section-label mb-3">Synopsis</p>
        {overview ? (
          <>
            <p className="text-sm text-ink-mid leading-relaxed">{displayText}</p>
            {overview.length > cutoff && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="mt-2 text-xs text-ink-light hover:text-ink transition-colors"
              >
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-ink-light italic">No synopsis available.</p>
        )}

        {genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            {genres.map((g, i) => (
              <span key={i} className="text-xs px-3 py-1 rounded-full border border-line text-ink-mid">
                {typeof g === 'object' ? g.name : g}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right — stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-6 lg:gap-5 lg:min-w-[180px]">
        <Stat
          label="First aired"
          value={series.firstAirDate
            ? new Date(series.firstAirDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : series.releaseDate
              ? new Date(series.releaseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
              : null}
        />
        {series.lastAirDate && series.status !== 'Returning Series' && (
          <Stat
            label="Last aired"
            value={new Date(series.lastAirDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          />
        )}
        <Stat label="Seasons"  value={series.numberOfSeasons  ? String(series.numberOfSeasons)  : null} />
        <Stat label="Episodes" value={series.numberOfEpisodes ? String(series.numberOfEpisodes) : null} />
        <Stat label="Status"   value={series.status} />
        <Stat label="Language" value={series.originalLanguage ? series.originalLanguage.toUpperCase() : null} />
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="skeleton w-full" style={{ height: 'min(80vh, 720px)' }} />
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-12 space-y-14">
        <div className="space-y-3">
          <div className="skeleton h-3 w-16 rounded" />
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-5/6 rounded" />
          <div className="skeleton h-4 w-4/6 rounded" />
        </div>
        <div>
          <div className="skeleton h-3 w-20 rounded mb-4" />
          <HScrollRow isLoading skeletonCount={7} />
        </div>
      </div>
    </div>
  );
}

// ─── SeriesDetailPage ─────────────────────────────────────────────────────────

export default function SeriesDetailPage() {
  const { id } = useParams();
  const { addItem, removeItem, hasSeries, library } = useUserLibraryStore();

  const [series,  setSeries]  = useState(null);
  const [similar, setSimilar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const isSaved = series ? hasSeries(series.tmdbId ?? series.externalId ?? id) : false;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setSeries(null);
      setSimilar([]);

      try {
        let data = null;
        try {
          data = await tvService.getDetails(id);
        } catch {
          const stored = library.find(
            i => i.type === 'series' && (String(i.tmdbId) === String(id) || String(i.externalId) === String(id))
          );
          data = stored ?? null;
        }

        if (cancelled) return;

        if (!data) {
          setError('Series not found.');
          setLoading(false);
          return;
        }

        setSeries(data);
        setLoading(false);

        try {
          const simData = await tvService.getSimilar(id);
          if (!cancelled) setSimilar((simData?.results ?? []).slice(0, 14));
        } catch {
          // similar endpoint not available — skip
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load series.');
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSave = () => {
    if (!series) return;
    const tmdbId = series.tmdbId ?? series.externalId ?? id;
    if (isSaved) {
      removeItem(`series_${Number(tmdbId)}`);
      toast('Removed from library');
    } else {
      addItem(normalizeSeries({ ...series, tmdbId }));
      toast(`Saved — ${series.title ?? series.name}`);
    }
  };

  if (loading) return <DetailSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-ink-mid">{error}</p>
        <Link to="/" className="text-sm text-ink underline">Go home</Link>
      </div>
    );
  }

  if (!series) return null;

  const year   = (series.firstAirDate ?? series.releaseDate)?.slice(0, 4);
  const rating = series.rating ? Number(series.rating).toFixed(1) : null;

  const heroMeta = [
    year                     && { value: year, bold: true },
    series.numberOfSeasons   && { value: `${series.numberOfSeasons} season${series.numberOfSeasons !== 1 ? 's' : ''}` },
    rating                   && { value: rating, icon: 'star' },
    series.status            && { value: series.status },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-canvas">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <DetailHero
        type="series"
        backdropUrl={series.backdropUrl}
        posterUrl={series.posterUrl}
        title={series.title ?? series.name}
        meta={heroMeta}
        isSaved={isSaved}
        onToggleSave={toggleSave}
      />

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 pb-20 space-y-14 pt-12">

        {/* 1 — Overview + stats */}
        <OverviewSection series={series} />

        {/* 2 — Cast */}
        {series.cast?.length > 0 && (
          <section>
            <p className="section-label mb-4">Cast</p>
            <HScrollRow>
              {series.cast.map((actor, i) => (
                <CastCard key={actor.id ?? i} person={actor} />
              ))}
            </HScrollRow>
          </section>
        )}

        {/* 3 — Creators */}
        {series.createdBy?.length > 0 && (
          <section>
            <p className="section-label mb-3">Created by</p>
            <div className="flex flex-wrap gap-2">
              {series.createdBy.map((c, i) => (
                <span
                  key={i}
                  className="text-sm px-4 py-2 rounded-xl border border-line text-ink-mid bg-surface"
                >
                  {c.name ?? c}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 4 — Similar series */}
        {similar.length > 0 && (
          <>
            <div className="border-t border-line" />
            <section>
              <p className="section-label mb-1">In the same vein</p>
              <h2 className="text-2xl font-bold text-ink mb-5">Similar series</h2>
              <DragRow gap="gap-4">
                {similar.map((s, i) => (
                  <div key={s.tmdbId ?? s.id ?? i} className="shrink-0 w-44 sm:w-52 pointer-events-auto">
                    <UnifiedCard item={s} type="series" />
                  </div>
                ))}
              </DragRow>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
