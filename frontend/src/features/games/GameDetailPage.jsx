import { useEffect, useState, useMemo } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { GAME_CATALOG, translateMetaToTMDB, getRelatedGames } from '@/data/gameMovieTags';
import GameHero from './GameHero';
import GameRow from './GameRow';
import MovieRow from '@/features/movies/MovieRow';
import SectionWrapper from '@/components/ui/SectionWrapper';

// ─── Tag pill ─────────────────────────────────────────────────────────────────

function TagPill({ children }) {
  return (
    <span className="text-[12px] px-3 py-1 rounded-full border border-line text-ink-mid hover:border-line/60 hover:text-ink transition-colors cursor-default">
      {children}
    </span>
  );
}

// ─── Info block ───────────────────────────────────────────────────────────────

function GameInfoBlock({ game }) {
  return (
    <section className="flex flex-col sm:flex-row gap-8">
      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="section-label mb-2">About</p>
        <p className="text-sm text-ink-mid leading-relaxed">
          {game.description ?? game.tagline}
        </p>
      </div>

      {/* Meta sidebar */}
      <div className="shrink-0 sm:w-56 space-y-4">
        {/* Price */}
        {game.price != null && (
          <div>
            <p className="section-label mb-1">Price</p>
            <p className="text-2xl font-bold text-ink">
              {game.price === 0 ? 'Free to Play' : `$${game.price.toFixed(2)}`}
            </p>
          </div>
        )}

        {/* Rating */}
        {game.rating != null && (
          <div>
            <p className="section-label mb-1">User Score</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-ink">{game.rating}</span>
              <span className="text-xs text-ink-light">/ 10</span>
              <svg className="w-4 h-4 text-yellow-400 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
          </div>
        )}

        {/* Tags */}
        {game.tags?.length > 0 && (
          <div>
            <p className="section-label mb-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {game.tags.map(tag => <TagPill key={tag}>{tag}</TagPill>)}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── GameDetailPage ───────────────────────────────────────────────────────────

export default function GameDetailPage() {
  const { id } = useParams();
  const game = GAME_CATALOG.find(g => g.id === id);

  const [relatedMovies, setRelatedMovies]       = useState([]);
  const [moviesLoading, setMoviesLoading]       = useState(true);
  const [relatedSeries, setRelatedSeries]       = useState([]);
  const [seriesLoading, setSeriesLoading]       = useState(true);

  const similarGames = useMemo(() => getRelatedGames(id, 8), [id]);

  useEffect(() => {
    if (!game) return;

    const filters = translateMetaToTMDB(game.meta);

    // Related movies — genre + mood aligned
    movieService.discover({ ...filters, page: 1 })
      .then(data => setRelatedMovies((data.results || []).slice(0, 16)))
      .catch(console.error)
      .finally(() => setMoviesLoading(false));

    // Related series — TV discover by matching genres
    tvService.discover({ genres: filters.genres, sort_by: filters.sort_by })
      .then(data => setRelatedSeries((data.results || []).slice(0, 16)))
      .catch(console.error)
      .finally(() => setSeriesLoading(false));

  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!game) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-canvas">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <GameHero game={game} />

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-10 space-y-16">

        {/* ── 1. Game info + tags ─────────────────────────────────────────── */}
        <GameInfoBlock game={game} />

        <div className="border-t border-line" />

        {/* ── 2. Related Movies ───────────────────────────────────────────── */}
        <SectionWrapper
          label="Watch after playing"
          title={`Movies for ${game.name} fans`}
        >
          {moviesLoading || relatedMovies.length > 0 ? (
            <MovieRow movies={relatedMovies} isLoading={moviesLoading} cardWidth="w-32 sm:w-36" />
          ) : (
            <p className="text-sm text-ink-light py-4">No matches found.</p>
          )}
        </SectionWrapper>

        {/* ── 3. Related Series ───────────────────────────────────────────── */}
        <SectionWrapper
          label="Binge after playing"
          title={`Series that match ${game.name}'s vibe`}
        >
          {seriesLoading || relatedSeries.length > 0 ? (
            <MovieRow movies={relatedSeries} isLoading={seriesLoading} cardWidth="w-32 sm:w-36" />
          ) : (
            <p className="text-sm text-ink-light py-4">No matches found.</p>
          )}
        </SectionWrapper>

        {/* ── 4. Similar Games ────────────────────────────────────────────── */}
        <SectionWrapper
          label="Similar games"
          title="You might also like"
        >
          <GameRow games={similarGames} cardWidth="w-40 sm:w-48" />
        </SectionWrapper>

      </div>
    </div>
  );
}
