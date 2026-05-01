import { useEffect, useState, useRef } from 'react';
import { rawgService } from '@/services/rawgService';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { GAME_CATALOG } from '@/data/gameMovieTags';
import { useUserLibraryStore } from '@/features/library/libraryStore';
import ExpandableRow from '@/components/ui/ExpandableRow';
import ContentBand from '@/components/ui/ContentBand';

const TOP_GAMES = [...GAME_CATALOG].sort((a, b) => b.rating - a.rating).slice(0, 12);

function TrendingSection({ eyebrow, headline, color, children }) {
  const colorCls = {
    accent: 'text-accent',
    amber:  'text-amber-400',
    violet: 'text-violet-400',
  }[color] ?? 'text-ink-light';

  return (
    <section>
      <p className={`eyebrow ${colorCls} mb-1`}>{eyebrow}</p>
      <h3 className="headline-md text-ink mb-4">{headline}</h3>
      {children}
    </section>
  );
}

function RowSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="shrink-0 w-44 sm:w-52">
          <div className="skeleton aspect-video rounded-2xl" />
        </div>
      ))}
    </div>
  );
}

export default function TrendingNow() {
  const [games, setGames]               = useState([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [movies, setMovies]             = useState([]);
  const [moviesLoading, setMoviesLoading] = useState(true);
  const [series, setSeries]             = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(true);

  const { toggleGame, hasGame, toggleMovie, hasMovie, toggleSeries, hasSeries } =
    useUserLibraryStore();

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    rawgService.getTrending(12)
      .then(results => setGames(results.length ? results : TOP_GAMES))
      .catch(() => setGames(TOP_GAMES))
      .finally(() => setGamesLoading(false));

    setTimeout(() => {
      movieService.getTrending()
        .then(data => setMovies((data.results ?? []).slice(0, 16)))
        .catch(() => setMovies([]))
        .finally(() => setMoviesLoading(false));
    }, 300);

    setTimeout(() => {
      tvService.getTrending()
        .then(data => setSeries((data.results ?? []).slice(0, 16)))
        .catch(() => setSeries([]))
        .finally(() => setSeriesLoading(false));
    }, 600);
  }, []);

  return (
    <div className="space-y-0">
      {/* Trending Games */}
      <ContentBand zone="surface" size="compact" topBorder>
        <TrendingSection eyebrow="Games" headline="Trending this week" color="accent">
          {gamesLoading ? <RowSkeleton /> : (
            <ExpandableRow
              items={games.map(g => ({ item: g, type: 'game' }))}
              cardWidth="w-44 sm:w-52"
              gap="gap-3"
              onAddToLibrary={(item) => toggleGame(item)}
              libraryCheck={(item) => hasGame(item.id ?? item.rawId)}
            />
          )}
        </TrendingSection>
      </ContentBand>

      {/* Trending Movies */}
      <ContentBand zone="canvas" size="compact" topBorder>
        <TrendingSection eyebrow="Films" headline="Popular this week" color="amber">
          {moviesLoading ? <RowSkeleton /> : (
            <ExpandableRow
              items={movies.map(m => ({ item: m, type: 'movie' }))}
              cardWidth="w-44 sm:w-52"
              gap="gap-3"
              onAddToLibrary={(item) => toggleMovie(item)}
              libraryCheck={(item) => hasMovie(item.tmdbId ?? item.id)}
            />
          )}
        </TrendingSection>
      </ContentBand>

      {/* Trending Series */}
      <ContentBand zone="surface" size="compact" topBorder>
        <TrendingSection eyebrow="Series" headline="Trending on TV" color="violet">
          {seriesLoading ? <RowSkeleton /> : (
            <ExpandableRow
              items={series.map(s => ({ item: s, type: 'series' }))}
              cardWidth="w-44 sm:w-52"
              gap="gap-3"
              onAddToLibrary={(item) => toggleSeries(item)}
              libraryCheck={(item) => hasSeries(item.tmdbId ?? item.id)}
            />
          )}
        </TrendingSection>
      </ContentBand>
    </div>
  );
}
