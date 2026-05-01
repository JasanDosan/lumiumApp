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
  const {
    status, error, lastSyncAt, lastSteamId, lastImported, lastTotal,
    importLibrary, syncLibrary, syncRecent, recentGames, recentStatus, reset,
  } = useSteamStore();
  const { user } = useAuthStore();
  const { games } = useLibraryStore();

  const [input, setInput] = useState(lastSteamId ?? '');
  const [dirty, setDirty] = useState(false);

  // Is this user connected via Steam OpenID?
  const steamConnected = !!user?.steam?.connected;
  const steamGames     = games.filter(g => g.source === 'steam');
  const hasConnected   = !!lastSyncAt;
  const isLoading      = status === 'loading';

  // ── One-click sync when OpenID is connected ───────────────────────────────
  const handleOneClickSync = async () => {
    reset();
    try {
      const result = await syncLibrary();
      if (result.imported > 0) {
        toast(`Imported ${result.imported} game${result.imported !== 1 ? 's' : ''} from Steam`);
      } else {
        toast('Library is up to date — no new games to import');
      }
    } catch { /* error state set in store */ }
  };

  const handleSyncRecent = async () => {
    try {
      const result = await syncRecent();
      const n = result?.count ?? 0;
      toast(n > 0 ? `Synced ${n} recently played game${n !== 1 ? 's' : ''}` : 'No recent activity found');
    } catch { /* error state set in store */ }
  };

  // ── Manual form submit (fallback for non-OpenID flow) ────────────────────
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
    } catch { /* error state set in store */ }
  };

  const syncLabel = isLoading
    ? 'Importing…'
    : hasConnected && !dirty ? 'Sync again' : 'Import games';

  return (
    <section className="space-y-6">
      <div>
        <p className="section-label mb-1">Steam</p>
        <h2 className="text-lg font-semibold text-ink">Steam library</h2>
        <p className="text-sm text-ink-light mt-1 max-w-prose">
          Import your owned Steam games into Lumium. Your Steam profile must be set to public.
        </p>
      </div>

      {/* ── Connected via OpenID: one-click sync ─────────────────────────── */}
      {steamConnected ? (
        <div className="space-y-3">
          {/* Connection badge */}
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full
                          border border-line/60 bg-surface text-xs">
            {user.steam.avatarUrl && (
              <img
                src={user.steam.avatarUrl}
                alt={user.steam.personaName}
                className="w-4 h-4 rounded-full object-cover shrink-0"
              />
            )}
            <span className="font-medium text-ink">{user.steam.personaName || user.steam.steamId}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
          </div>

          {/* One-click actions */}
          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={handleOneClickSync}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                         bg-ink text-white hover:bg-ink/80 disabled:opacity-40
                         disabled:cursor-not-allowed transition-colors"
            >
              {isLoading && (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {isLoading ? 'Syncing…' : hasConnected ? 'Sync library' : 'Import library'}
            </button>
            <button
              onClick={handleSyncRecent}
              disabled={recentStatus === 'loading'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                         border border-line text-ink-mid hover:text-ink hover:border-ink/40
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {recentStatus === 'loading' && (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-ink-mid border-t-transparent animate-spin" />
              )}
              {recentStatus === 'loading' ? 'Syncing…' : 'Sync recent games'}
            </button>
          </div>

          {/* Recent games list */}
          {recentGames.length > 0 && (
            <div>
              <p className="text-[10px] font-black tracking-[0.18em] uppercase text-ink-light mb-3">
                Recently played
              </p>
              <div className="flex flex-wrap gap-2">
                {recentGames.slice(0, 10).map(g => (
                  <div
                    key={g.appId}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-line
                               bg-surface text-xs"
                  >
                    {g.iconUrl && (
                      <img src={g.iconUrl} alt={g.name} className="w-4 h-4 rounded shrink-0" />
                    )}
                    <span className="text-ink font-medium truncate max-w-[120px]">{g.name}</span>
                    {g.playtime2Weeks > 0 && (
                      <span className="text-ink-light tabular-nums shrink-0">
                        {g.playtime2Weeks >= 60
                          ? `${(g.playtime2Weeks / 60).toFixed(1)}h`
                          : `${g.playtime2Weeks}m`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ── Not connected via OpenID: manual input form ───────────────────── */
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
      )}

      {/* Error state */}
      {status === 'error' && error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Last sync metadata */}
      {hasConnected && status !== 'error' && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-light">
          <span>
            Last synced{' '}
            {new Date(lastSyncAt).toLocaleString(undefined, {
              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </span>
          {lastTotal != null && (
            <span>
              {lastImported} new · {steamGames.length} total in library
            </span>
          )}
        </div>
      )}

      {/* Steam games count badge */}
      {steamGames.length > 0 && (
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl
                        border border-line bg-surface text-sm">
          <span className="text-base">🎮</span>
          <span className="font-semibold text-ink">{steamGames.length}</span>
          <span className="text-ink-light">game{steamGames.length !== 1 ? 's' : ''} imported from Steam</span>
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
