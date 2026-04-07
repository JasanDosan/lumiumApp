import { useEffect, useState, useRef } from 'react';
import { rawgService } from '@/services/rawgService';
import { movieService } from '@/services/movieService';
import { tvService } from '@/services/tvService';
import { GAME_CATALOG } from '@/data/gameMovieTags';
import { useUserLibraryStore } from '@/features/library/libraryStore';
import ExpandableRow from '@/components/ui/ExpandableRow';

const TOP_GAMES = [...GAME_CATALOG].sort((a, b) => b.rating - a.rating).slice(0, 12);

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHead({ overline, title, color = 'default' }) {
  const colorMap = {
    accent:  { bar: 'bg-accent',     over: 'text-accent'     },
    amber:   { bar: 'bg-amber-500',  over: 'text-amber-400'  },
    violet:  { bar: 'bg-violet-500', over: 'text-violet-400' },
    default: { bar: 'bg-line',       over: 'text-ink-light'  },
  };
  const c = colorMap[color] ?? colorMap.default;
  return (
    <div className="flex items-end justify-between gap-4 mb-5">
      <div>
        <div className="flex items-center gap-2.5 mb-2">
          <div className={`w-0.5 h-5 ${c.bar} rounded-full shrink-0`} />
          <p className={`text-[10px] font-black tracking-[0.2em] uppercase ${c.over}`}>{overline}</p>
        </div>
        <h2 className="title-lg">{title}</h2>
      </div>
    </div>
  );
}

// ─── Loading row skeleton ─────────────────────────────────────────────────────

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

// ─── TrendingNow ──────────────────────────────────────────────────────────────

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

    // Games — immediate
    rawgService.getTrending(12)
      .then(results => setGames(results.length ? results : TOP_GAMES))
      .catch(() => setGames(TOP_GAMES))
      .finally(() => setGamesLoading(false));

    // Movies — staggered 300 ms
    setTimeout(() => {
      movieService.getTrending()
        .then(data => setMovies((data.results ?? []).slice(0, 16)))
        .catch(() => setMovies([]))
        .finally(() => setMoviesLoading(false));
    }, 300);

    // Series — staggered 600 ms
    setTimeout(() => {
      tvService.getTrending()
        .then(data => setSeries((data.results ?? []).slice(0, 16)))
        .catch(() => setSeries([]))
        .finally(() => setSeriesLoading(false));
    }, 600);
  }, []);

  return (
    <>
      {/* Trending Games */}
      <section className="pt-14">
        <SectionHead overline="Games" title="Trending Now" color="accent" />
        {gamesLoading ? (
          <RowSkeleton />
        ) : (
          <ExpandableRow
            items={games.map(g => ({ item: g, type: 'game' }))}
            cardWidth="w-44 sm:w-52"
            gap="gap-3"
            onAddToLibrary={(item) => toggleGame(item)}
            libraryCheck={(item) => hasGame(item.id ?? item.rawId)}
          />
        )}
      </section>

      {/* Trending Movies */}
      <section className="pt-14">
        <SectionHead overline="Films" title="Popular This Week" color="amber" />
        {moviesLoading ? (
          <RowSkeleton />
        ) : (
          <ExpandableRow
            items={movies.map(m => ({ item: m, type: 'movie' }))}
            cardWidth="w-44 sm:w-52"
            gap="gap-3"
            onAddToLibrary={(item) => toggleMovie(item)}
            libraryCheck={(item) => hasMovie(item.tmdbId ?? item.id)}
          />
        )}
      </section>

      {/* Trending Series */}
      <section className="pt-14">
        <SectionHead overline="Series" title="Trending on TV" color="violet" />
        {seriesLoading ? (
          <RowSkeleton />
        ) : (
          <ExpandableRow
            items={series.map(s => ({ item: s, type: 'series' }))}
            cardWidth="w-44 sm:w-52"
            gap="gap-3"
            onAddToLibrary={(item) => toggleSeries(item)}
            libraryCheck={(item) => hasSeries(item.tmdbId ?? item.id)}
          />
        )}
      </section>
    </>
  );
}
