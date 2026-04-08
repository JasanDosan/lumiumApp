import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { personService } from '@/services/personService';
import { useUserLibraryStore, normalizeMovie } from '@/features/library/libraryStore';
import { useAuthStore } from '@/features/auth/authStore';
import DetailHero from '@/components/detail/DetailHero';
import HScrollRow from '@/components/detail/HScrollRow';
import { toast } from '@/stores/toastStore';
import MovieRow from './MovieRow';
import SectionWrapper from '@/components/ui/SectionWrapper';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n) {
  if (!n || n === 0) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);
}

function fmtRuntime(min) {
  if (!min) return null;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

// ─── CastCard ─────────────────────────────────────────────────────────────────

function CastCard({ person }) {
  return (
    <Link to={`/person/${person.id}`} className="group block shrink-0 w-28 text-left">
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
    </Link>
  );
}

// ─── CrewCard ─────────────────────────────────────────────────────────────────

function CrewCard({ person, role }) {
  return (
    <Link
      to={`/person/${person.id}`}
      className="group flex items-center gap-3 px-4 py-3 rounded-xl border border-line bg-surface hover:border-line/60 transition-all"
    >
      <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-high shrink-0">
        {person.profileUrl ? (
          <img src={person.profileUrl} alt={person.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-faint text-xs">◎</div>
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[12px] text-ink-light uppercase tracking-wider font-semibold mb-0.5">{role}</p>
        <p className="text-[13px] font-semibold text-ink truncate group-hover:underline underline-offset-2">{person.name}</p>
      </div>
    </Link>
  );
}

// ─── InfoSection ──────────────────────────────────────────────────────────────

function InfoSection({ movie }) {
  const [expanded, setExpanded] = useState(false);
  const overview = movie.overview || '';
  const cutoff = 360;
  const displayText = overview.length > cutoff && !expanded
    ? overview.slice(0, cutoff).trimEnd() + '…'
    : overview;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 lg:gap-16">
      {/* Overview */}
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

        {movie.genres?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            {movie.genres.map(g => (
              <Link
                key={g.id}
                to={`/?genres=${g.id}`}
                className="text-xs px-3 py-1 rounded-full border border-line text-ink-mid hover:border-ink/30 hover:text-ink transition-colors"
              >
                {g.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-6 lg:gap-5 lg:min-w-[180px]">
        {movie.releaseDate && (
          <Stat label="Release" value={new Date(movie.releaseDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
        )}
        {movie.runtime > 0 && (
          <Stat label="Runtime" value={fmtRuntime(movie.runtime)} />
        )}
        {fmt(movie.budget) && (
          <Stat label="Budget" value={fmt(movie.budget)} />
        )}
        {fmt(movie.revenue) && (
          <Stat label="Box office" value={fmt(movie.revenue)} />
        )}
        {movie.status && (
          <Stat label="Status" value={movie.status} />
        )}
        {movie.originalLanguage && (
          <Stat label="Language" value={movie.originalLanguage.toUpperCase()} />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-ink-light mb-0.5">{label}</p>
      <p className="text-sm font-medium text-ink">{value}</p>
    </div>
  );
}

// ─── DetailSkeleton ───────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="skeleton w-full" style={{ height: 'min(80vh, 720px)' }} />
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-12 space-y-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10">
          <div className="space-y-3">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-5/6 rounded" />
            <div className="skeleton h-4 w-4/6 rounded" />
          </div>
        </div>
        {[1, 2, 3].map(n => (
          <div key={n}>
            <div className="skeleton h-3 w-20 rounded mb-4" />
            <HScrollRow isLoading skeletonCount={7} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MovieDetailPage ──────────────────────────────────────────────────────────

export default function MovieDetailPage() {
  const { id } = useParams();
  const { addItem, removeItem, hasMovie } = useUserLibraryStore();
  const { isAuthenticated } = useAuthStore();

  const [movie, setMovie]               = useState(null);
  const [similar, setSimilar]           = useState([]);
  const [recs, setRecs]                 = useState([]);
  const [collection, setCollection]     = useState(null);
  const [directorFilms, setDirectorFilms] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  const isFav = movie ? hasMovie(movie.tmdbId) : false;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      setMovie(null);
      setSimilar([]);
      setRecs([]);
      setCollection(null);
      setDirectorFilms([]);

      try {
        // Wave 1 — critical data
        const details = await movieService.getDetails(id);
        if (cancelled) return;
        setMovie(details);
        setLoading(false);

        // Wave 2 — parallel secondary
        const [simData, recData] = await Promise.all([
          movieService.getSimilar(id).catch(() => ({ results: [] })),
          movieService.getMovieRecs(id).catch(() => ({ results: [] })),
        ]);
        if (cancelled) return;
        setSimilar((simData.results || []).slice(0, 14));
        setRecs((recData.results || []).slice(0, 14));

        // Wave 3 — collection, then director
        if (details.collectionId) {
          const col = await movieService.getCollection(details.collectionId).catch(() => null);
          if (!cancelled && col?.parts?.length > 1) setCollection(col);
        }

        if (details.directorId) {
          await new Promise(r => setTimeout(r, 300));
          const person = await personService.getPerson(details.directorId).catch(() => null);
          if (!cancelled && person?.directed?.length > 0) {
            setDirectorFilms(
              person.directed
                .filter(m => String(m.tmdbId) !== String(id))
                .slice(0, 14)
            );
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load movie.');
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id]);

  const toggleFav = () => {
    if (!movie) return;
    if (isFav) {
      removeItem(`movie_${Number(movie.tmdbId)}`);
      toast('Removed from library');
    } else {
      addItem(normalizeMovie(movie));
      toast(`Saved — ${movie.title}`);
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

  if (!movie) return null;

  const crewEntries = [
    movie.directorId && { id: movie.directorId, name: movie.director, role: 'Director', profileUrl: null },
    ...(movie.writers   || []).map(w => ({ id: w.id, name: w.name, role: w.job,      profileUrl: w.profileUrl })),
    ...(movie.producers || []).map(p => ({ id: p.id, name: p.name, role: 'Producer', profileUrl: p.profileUrl })),
  ].filter(Boolean);

  const collectionParts = collection?.parts?.filter(m => String(m.tmdbId) !== String(id)) ?? [];

  const heroMeta = [
    movie.releaseDate && { value: movie.releaseDate.slice(0, 4), bold: true },
    movie.runtime > 0 && { value: fmtRuntime(movie.runtime) },
    movie.rating    && { value: movie.rating.toFixed(1), icon: 'star' },
    movie.originalLanguage && { value: movie.originalLanguage.toUpperCase() },
  ].filter(Boolean);

  const heroActions = (
    <>
      {movie.trailerKey && (
        <a
          href={`https://www.youtube.com/watch?v=${movie.trailerKey}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-white/15 text-white border border-white/25 hover:bg-white/25 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          Trailer
        </a>
      )}
      {movie.directorId && (
        <Link
          to={`/person/${movie.directorId}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-white/15 text-white border border-white/25 hover:bg-white/25 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {movie.director}
        </Link>
      )}
      <Link
        to="/for-you"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-white/15 text-white border border-white/25 hover:bg-white/25 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 3l14 9-14 9V3z" />
        </svg>
        For You
      </Link>
    </>
  );

  return (
    <div className="min-h-screen bg-canvas">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <DetailHero
        type="movie"
        backdropUrl={movie.backdropUrl}
        posterUrl={movie.posterUrl}
        title={movie.title}
        tagline={movie.tagline}
        meta={heroMeta}
        isSaved={isFav}
        onToggleSave={isAuthenticated ? toggleFav : undefined}
        actions={heroActions}
      />

      {/* ── Content sections ─────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 pb-20 space-y-14 pt-12">

        {/* 1 — Info */}
        <InfoSection movie={movie} />

        {/* 2 — Cast */}
        {movie.cast?.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between mb-4">
              <p className="section-label">Cast</p>
            </div>
            <HScrollRow>
              {movie.cast.map(actor => (
                <CastCard key={actor.id} person={actor} />
              ))}
            </HScrollRow>
          </section>
        )}

        {/* 3 — Crew */}
        {crewEntries.length > 0 && (
          <section>
            <p className="section-label mb-4">Key crew</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {crewEntries.map(entry => (
                <CrewCard key={`${entry.role}-${entry.id}`} person={entry} role={entry.role} />
              ))}
            </div>
          </section>
        )}

        <div className="border-t border-line" />

        {/* 4 — Collection / Saga */}
        {collectionParts.length > 0 && (
          <SectionWrapper label="Part of a saga" title={collection.name}>
            <MovieRow movies={collectionParts} />
          </SectionWrapper>
        )}

        {/* 5 — More from director */}
        {directorFilms.length > 0 && (
          <SectionWrapper
            label="More from the director"
            title={movie.director}
            seeAllTo={`/person/${movie.directorId}`}
          >
            <MovieRow movies={directorFilms} />
          </SectionWrapper>
        )}

        {/* 6 — TMDB Recommendations */}
        {recs.length > 0 && (
          <SectionWrapper label="You might also like" title="Recommended">
            <MovieRow movies={recs} />
          </SectionWrapper>
        )}

        {/* 7 — Similar */}
        {similar.length > 0 && (
          <SectionWrapper label="In the same vein" title="Similar films">
            <MovieRow movies={similar} />
          </SectionWrapper>
        )}
      </div>
    </div>
  );
}
