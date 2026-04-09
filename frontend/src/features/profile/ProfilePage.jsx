import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLibraryStore } from '@/features/library/libraryStore';
import { useAuthStore } from '@/features/auth/authStore';
import { movieService } from '@/services/movieService';
import { useSteamStore } from '@/features/steam/useSteamStore';
import { toast } from '@/stores/toastStore';
import MovieRow from '@/features/movies/MovieRow';
import SectionWrapper from '@/components/ui/SectionWrapper';

// Compute top genres from favorites array
function computeTopGenres(favorites, allGenres) {
  const counts = {};
  favorites.forEach(f => {
    (f.genreIds || []).forEach(id => {
      counts[id] = (counts[id] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, count]) => ({
      id: Number(id),
      name: allGenres.find(g => g.id === Number(id))?.name ?? 'Other',
      count,
    }));
}

// Compute decade distribution
function computeDecades(favorites) {
  const counts = {};
  favorites.forEach(f => {
    if (!f.releaseDate) return;
    const decade = Math.floor(new Date(f.releaseDate).getFullYear() / 10) * 10;
    counts[decade] = (counts[decade] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([decade, count]) => ({ decade: Number(decade), count }));
}

// ─── Steam connect section ────────────────────────────────────────────────────

function SteamSection() {
  const { status, error, lastSyncAt, lastSteamId, lastImported, lastTotal, importLibrary, reset } =
    useSteamStore();
  const { games } = useLibraryStore();

  const [input, setInput]   = useState(lastSteamId ?? '');
  const [dirty, setDirty]   = useState(false);

  const steamGames     = games.filter(g => g.source === 'steam');
  const hasConnected   = !!lastSyncAt;
  const isLoading      = status === 'loading';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;
    reset();
    try {
      const result = await importLibrary(val);
      setDirty(false);
      if (result.imported > 0) {
        toast(`Imported ${result.imported} game${result.imported !== 1 ? 's' : ''} from Steam`);
      } else {
        toast('Library is up to date — no new games to import');
      }
    } catch {
      // error state is set in useSteamStore — no additional handling needed
    }
  };

  const syncLabel = isLoading
    ? 'Importing…'
    : hasConnected && !dirty
      ? 'Sync again'
      : 'Import games';

  return (
    <section>
      <div className="mb-5">
        <p className="section-label mb-1">Steam</p>
        <h2 className="text-lg font-semibold text-ink">Connect Steam library</h2>
        <p className="text-sm text-ink-light mt-1 max-w-prose">
          Import your owned Steam games into your Lumium library. Your Steam profile must be public.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5 max-w-lg">
        <input
          type="text"
          value={input}
          onChange={e => { setInput(e.target.value); setDirty(true); }}
          placeholder="Steam profile URL or SteamID64"
          disabled={isLoading}
          className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-line bg-surface
                     text-ink placeholder:text-ink-light
                     focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/60
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold bg-ink text-white
                     hover:bg-ink/80 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors flex items-center gap-2"
        >
          {isLoading && (
            <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
          )}
          {syncLabel}
        </button>
      </form>

      {/* Error state */}
      {status === 'error' && error && (
        <p className="mt-3 text-sm text-red-500">{error}</p>
      )}

      {/* Last sync status */}
      {hasConnected && status !== 'error' && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-light">
          <span>
            Last synced{' '}
            {new Date(lastSyncAt).toLocaleString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </span>
          {lastTotal != null && (
            <span>
              {lastImported} new · {steamGames.length} total Steam game{steamGames.length !== 1 ? 's' : ''} in library
            </span>
          )}
        </div>
      )}

      {/* Steam games count badge */}
      {steamGames.length > 0 && (
        <div className="mt-5 inline-flex items-center gap-2.5 px-4 py-2 rounded-xl
                        border border-line bg-surface text-sm">
          <span className="text-base">🎮</span>
          <span className="font-semibold text-ink">{steamGames.length}</span>
          <span className="text-ink-light">Steam game{steamGames.length !== 1 ? 's' : ''} imported</span>
          <Link
            to="/library"
            className="ml-1 text-xs text-accent hover:text-accent-hover transition-colors font-medium"
          >
            View in library →
          </Link>
        </div>
      )}
    </section>
  );
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, logout } = useAuthStore();
  const { movies: favorites } = useLibraryStore();

  const [allGenres, setAllGenres]     = useState([]);
  const [recs, setRecs]               = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);

  useEffect(() => {
    movieService.getGenres().then(data => setAllGenres(data.genres || []));

    if (favorites.length >= 2) {
      setRecsLoading(true);
      movieService.getRecommendations()
        .then(data => setRecs(data.results?.slice(0, 12) || []))
        .catch(console.error)
        .finally(() => setRecsLoading(false));
    }
  }, []); // eslint-disable-line

  const topGenres = computeTopGenres(favorites, allGenres);
  const decades   = computeDecades(favorites);
  const topDecade = decades[0];

  const favMovies = favorites.map(f => ({
    tmdbId:      f.tmdbId,
    title:       f.title,
    posterPath:  f.posterPath,
    rating:      f.rating,
    releaseDate: f.releaseDate,
  }));

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-10">

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between mb-10 pb-8 border-b border-line">
          <div>
            <p className="section-label mb-2">Profile</p>
            <h1 className="text-2xl font-semibold text-ink">{user?.name}</h1>
            <p className="text-sm text-ink-light mt-0.5">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="text-sm text-ink-light hover:text-ink transition-colors mt-1"
          >
            Sign out
          </button>
        </div>

        {/* ── Stats ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
          {/* Total films */}
          <div className="bg-surface border border-line rounded-2xl p-5">
            <p className="section-label mb-2">Collection</p>
            <p className="text-3xl font-semibold text-ink tabular-nums">{favorites.length}</p>
            <p className="text-xs text-ink-light mt-0.5">film{favorites.length !== 1 ? 's' : ''} saved</p>
          </div>

          {/* Top genre */}
          {topGenres[0] ? (
            <div className="bg-surface border border-line rounded-2xl p-5">
              <p className="section-label mb-2">Top genre</p>
              <p className="text-xl font-semibold text-ink leading-tight truncate">{topGenres[0].name}</p>
              <p className="text-xs text-ink-light mt-0.5">{topGenres[0].count} film{topGenres[0].count !== 1 ? 's' : ''}</p>
            </div>
          ) : (
            <div className="bg-surface border border-line rounded-2xl p-5">
              <p className="section-label mb-2">Top genre</p>
              <p className="text-sm text-ink-light mt-1">Add films to see</p>
            </div>
          )}

          {/* Favourite era */}
          {topDecade ? (
            <div className="bg-surface border border-line rounded-2xl p-5">
              <p className="section-label mb-2">Favourite era</p>
              <p className="text-3xl font-semibold text-ink tabular-nums">{topDecade.decade}s</p>
              <p className="text-xs text-ink-light mt-0.5">{topDecade.count} film{topDecade.count !== 1 ? 's' : ''}</p>
            </div>
          ) : (
            <div className="bg-surface border border-line rounded-2xl p-5">
              <p className="section-label mb-2">Favourite era</p>
              <p className="text-sm text-ink-light mt-1">Add films to see</p>
            </div>
          )}

          {/* Recommendations available */}
          <div className="bg-surface border border-line rounded-2xl p-5">
            <p className="section-label mb-2">Picks ready</p>
            {favorites.length >= 2 ? (
              <>
                <p className="text-3xl font-semibold text-ink tabular-nums">{recs.length || '—'}</p>
                <Link
                  to="/for-you"
                  className="text-xs text-ink-light hover:text-ink transition-colors mt-0.5 inline-block"
                >
                  View all →
                </Link>
              </>
            ) : (
              <p className="text-sm text-ink-light mt-1">
                Save {2 - favorites.length} more film{2 - favorites.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {/* ── Sections ───────────────────────────────────────────── */}
        <div className="space-y-6">

          {/* Steam integration */}
          <SteamSection />

          <div className="border-t border-line" />

          {/* Collection */}
          {favMovies.length > 0 && (
            <SectionWrapper label="Your library" title="Saved films" seeAllTo="/favorites">
              <MovieRow movies={favMovies} />
            </SectionWrapper>
          )}

          {/* Recommendations */}
          {(recs.length > 0 || recsLoading) && (
            <SectionWrapper label="For you" title="Recommended" seeAllTo="/for-you">
              <MovieRow movies={recs} isLoading={recsLoading} showScore />
            </SectionWrapper>
          )}

          {/* Taste profile — genre breakdown */}
          {topGenres.length > 0 && (
            <section>
              <div className="mb-5">
                <p className="section-label mb-1">Taste profile</p>
                <h2 className="text-lg font-semibold text-ink">Your genres</h2>
              </div>

              <div className="space-y-2">
                {topGenres.map((g, i) => {
                  const pct = Math.round((g.count / favorites.length) * 100);
                  return (
                    <div key={g.id} className="flex items-center gap-4">
                      <span className="w-4 text-xs text-ink-light tabular-nums">#{i + 1}</span>
                      <div className="flex-1 flex items-center gap-3">
                        <span className="text-sm font-medium text-ink w-28 truncate">{g.name}</span>
                        <div className="flex-1 h-1.5 bg-surface-high rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent/50 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-ink-light w-6 text-right">{g.count}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Decade breakdown */}
          {decades.length > 0 && (
            <section>
              <div className="mb-5">
                <p className="section-label mb-1">By era</p>
                <h2 className="text-lg font-semibold text-ink">Decade breakdown</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {decades.map(d => (
                  <div key={d.decade}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-line rounded-full">
                    <span className="text-sm font-medium text-ink">{d.decade}s</span>
                    <span className="text-xs text-ink-light">{d.count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {favorites.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-ink-light mb-4">
                Your profile will fill in as you save films.
              </p>
              <Link
                to="/"
                className="text-sm bg-accent text-white px-5 py-2.5 rounded-full font-medium hover:bg-accent-hover transition-colors"
              >
                Start discovering
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
