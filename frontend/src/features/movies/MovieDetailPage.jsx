import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { personService } from '@/services/personService';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';
import { useLibraryStore } from '@/features/library/libraryStore';
import { useAuthStore } from '@/features/auth/authStore';
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

// ─── Drag-scroll hook (reusable, same as MovieRow) ────────────────────────────

function useDragScroll() {
  const ref = useRef(null);
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);

  const onMouseDown = useCallback((e) => {
    if (!ref.current) return;
    isDragging.current = true;
    didDrag.current = false;
    startX.current = e.pageX - ref.current.offsetLeft;
    scrollStart.current = ref.current.scrollLeft;
    ref.current.style.cursor = 'grabbing';
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!isDragging.current || !ref.current) return;
    e.preventDefault();
    const delta = (e.pageX - ref.current.offsetLeft - startX.current) * 1.4;
    if (Math.abs(delta) > 4) didDrag.current = true;
    ref.current.scrollLeft = scrollStart.current - delta;
  }, []);

  const stopDrag = useCallback(() => {
    isDragging.current = false;
    if (ref.current) ref.current.style.cursor = 'grab';
  }, []);

  const onClickCapture = useCallback((e) => {
    if (didDrag.current) { e.preventDefault(); e.stopPropagation(); }
  }, []);

  return { ref, onMouseDown, onMouseMove, stopDrag, onClickCapture };
}

// ─── CastCard ─────────────────────────────────────────────────────────────────

function CastCard({ person }) {
  return (
    <Link
      to={`/person/${person.id}`}
      className="group block shrink-0 w-28 text-left"
    >
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

// ─── HScrollRow ───────────────────────────────────────────────────────────────

function HScrollRow({ children, isLoading = false, skeletonCount = 7 }) {
  const drag = useDragScroll();

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div key={i} className="shrink-0 w-28">
            <div className="skeleton aspect-[2/3] rounded-md" />
            <div className="skeleton h-3 w-20 mt-2 rounded" />
            <div className="skeleton h-2.5 w-14 mt-1.5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={drag.ref}
      className="flex gap-4 overflow-x-auto pb-2 cursor-grab select-none"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      onMouseDown={drag.onMouseDown}
      onMouseMove={drag.onMouseMove}
      onMouseUp={drag.stopDrag}
      onMouseLeave={drag.stopDrag}
      onClickCapture={drag.onClickCapture}
    >
      {children}
    </div>
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

        {/* Genres */}
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

// ─── MovieHero ────────────────────────────────────────────────────────────────

function MovieHero({ movie, isFav, onToggleFav }) {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const year = movie.releaseDate?.slice(0, 4);
  const rating = movie.rating ? movie.rating.toFixed(1) : null;

  return (
    <div className="relative w-full overflow-hidden" style={{ height: 'min(80vh, 720px)' }}>
      {/* Backdrop */}
      {movie.backdropUrl && (
        <img
          src={movie.backdropUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {!movie.backdropUrl && (
        <div className="absolute inset-0 bg-neutral-900" />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-5 left-5 sm:left-8 lg:left-12 z-20 flex items-center gap-1.5 text-white/70 hover:text-white transition-colors text-sm"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Floating poster — desktop only */}
      {movie.posterUrl && (
        <div className="absolute right-8 lg:right-16 bottom-12 hidden lg:block z-10">
          <img
            src={movie.posterUrl}
            alt={movie.title}
            className="w-44 rounded-xl shadow-2xl ring-1 ring-white/10"
          />
        </div>
      )}

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end px-5 sm:px-8 lg:px-12 pb-10 pt-20 max-w-screen-xl mx-auto z-10">
        <div className="max-w-2xl">
          {/* Tagline */}
          {movie.tagline && (
            <p className="text-white/50 text-sm italic mb-3 tracking-wide">{movie.tagline}</p>
          )}

          {/* Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.05] tracking-tight mb-4">
            {movie.title}
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-6 text-white/60 text-sm">
            {year && <span className="text-white/80 font-medium">{year}</span>}
            {movie.runtime > 0 && (
              <>
                <span className="text-white/30">·</span>
                <span>{fmtRuntime(movie.runtime)}</span>
              </>
            )}
            {rating && (
              <>
                <span className="text-white/30">·</span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {rating}
                </span>
              </>
            )}
            {movie.originalLanguage && (
              <>
                <span className="text-white/30">·</span>
                <span className="uppercase">{movie.originalLanguage}</span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {isAuthenticated && (
              <button
                onClick={onToggleFav}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                  isFav
                    ? 'bg-white text-ink'
                    : 'bg-white/15 text-white border border-white/25 hover:bg-white/25'
                }`}
              >
                <svg
                  className={`w-4 h-4 ${isFav ? 'fill-red stroke-red' : 'fill-none stroke-current'}`}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
                {isFav ? 'Saved' : 'Save'}
              </button>
            )}

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
              to="/recommendations"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-white/15 text-white border border-white/25 hover:bg-white/25 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 3l14 9-14 9V3z" />
              </svg>
              For You
            </Link>
          </div>
        </div>
      </div>
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
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="shrink-0 w-28">
                  <div className="skeleton aspect-[2/3] rounded-md" />
                  <div className="skeleton h-3 w-20 mt-2 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MovieDetailPage ──────────────────────────────────────────────────────────

export default function MovieDetailPage() {
  const { id } = useParams();
  const { add: addFav, remove: removeFav } = useFavoritesStore();
  const { hasMovie, addMovie, removeMovie } = useLibraryStore();
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
        setLoading(false); // show hero immediately

        // Wave 2 — parallel secondary (safe: different endpoints)
        const [simData, recData] = await Promise.all([
          movieService.getSimilar(id).catch(() => ({ results: [] })),
          movieService.getMovieRecs(id).catch(() => ({ results: [] })),
        ]);
        if (cancelled) return;
        setSimilar((simData.results || []).slice(0, 14));
        setRecs((recData.results || []).slice(0, 14));

        // Wave 3 — collection, then director (sequential to spare rate limit)
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
      removeMovie(movie.tmdbId);
      removeFav(movie.tmdbId);
    } else {
      addMovie(movie);
      addFav(movie);
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

  // Build crew entries for the crew section
  const crewEntries = [
    movie.directorId && { id: movie.directorId, name: movie.director, role: 'Director', profileUrl: null },
    ...(movie.writers || []).map(w => ({ id: w.id, name: w.name, role: w.job, profileUrl: w.profileUrl })),
    ...(movie.producers || []).map(p => ({ id: p.id, name: p.name, role: 'Producer', profileUrl: p.profileUrl })),
  ].filter(Boolean);

  // Collection parts excluding this movie
  const collectionParts = collection?.parts?.filter(m => String(m.tmdbId) !== String(id)) ?? [];

  return (
    <div className="min-h-screen bg-canvas">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <MovieHero movie={movie} isFav={isFav} onToggleFav={toggleFav} />

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

        {/* Divider */}
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
