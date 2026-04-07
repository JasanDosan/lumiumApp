import { useEffect, useState, useRef } from 'react';
import { movieService } from '@/services/movieService';
import MovieRow from './MovieRow';

// ─── Region detection ─────────────────────────────────────────────────────────

const SUPPORTED_REGIONS = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'ES', name: 'Spain' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CO', name: 'Colombia' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'IT', name: 'Italy' },
  { code: 'BR', name: 'Brazil' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'IN', name: 'India' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'PT', name: 'Portugal' },
  { code: 'SE', name: 'Sweden' },
];

const LS_KEY = 'pm_region';

function detectRegion() {
  const saved = localStorage.getItem(LS_KEY);
  if (saved && SUPPORTED_REGIONS.some(r => r.code === saved)) return saved;

  const locale = navigator.language || navigator.languages?.[0] || 'en-US';
  const parts = locale.split('-');
  const code = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : null;
  if (code && SUPPORTED_REGIONS.some(r => r.code === code)) return code;

  // Language-to-country fallback
  const langMap = {
    es: 'ES', fr: 'FR', de: 'DE', it: 'IT', pt: 'BR',
    ja: 'JP', ko: 'KR', nl: 'NL', sv: 'SE',
  };
  return langMap[parts[0]] || 'US';
}

// ─── ProviderSection ──────────────────────────────────────────────────────────

function ProviderSection({ provider, region }) {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    movieService
      .discover({
        with_watch_providers: String(provider.id),
        watch_region: region,
        sort_by: 'popularity.desc',
      })
      .then(data => {
        if (!cancelled) setMovies((data.results || []).slice(0, 16));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [provider.id, region]);

  if (!loading && movies.length === 0) return null;

  return (
    <section>
      {/* Provider header */}
      <div className="flex items-center gap-3 mb-4">
        {provider.logoUrl && (
          <img
            src={provider.logoUrl}
            alt={provider.name}
            className="w-8 h-8 rounded-lg object-contain bg-surface border border-line"
          />
        )}
        <div>
          <p className="section-label leading-none mb-0.5">Streaming now</p>
          <h2 className="text-base font-bold text-ink leading-none">{provider.name}</h2>
        </div>
      </div>
      <MovieRow movies={movies} isLoading={loading} />
    </section>
  );
}

// ─── MoviesPage ───────────────────────────────────────────────────────────────

const MAX_PROVIDERS = 8;

export default function MoviesPage() {
  const [region, setRegion]         = useState(detectRegion);
  const [providers, setProviders]   = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [error, setError]           = useState(null);
  const fetchedRef = useRef(false);
  const prevRegion = useRef(region);

  // Load providers when region changes
  useEffect(() => {
    // Skip first render if fetchedRef already used; always reset on region change
    if (fetchedRef.current && prevRegion.current === region) return;
    fetchedRef.current = true;
    prevRegion.current = region;

    setLoadingProviders(true);
    setProviders([]);
    setError(null);

    movieService
      .getProviders(region)
      .then(data => setProviders((data.providers || []).slice(0, MAX_PROVIDERS)))
      .catch(() => setError('Could not load streaming providers.'))
      .finally(() => setLoadingProviders(false));
  }, [region]);

  const handleRegionChange = (e) => {
    const code = e.target.value;
    localStorage.setItem(LS_KEY, code);
    setRegion(code);
  };

  const regionLabel = SUPPORTED_REGIONS.find(r => r.code === region)?.name || region;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 pb-20 pt-8">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
          <div>
            <p className="section-label mb-2">Streaming</p>
            <h1 className="text-3xl font-bold text-ink">Where to Watch</h1>
            <p className="text-sm text-ink-light mt-1.5">
              What&apos;s available to stream in <span className="text-ink font-medium">{regionLabel}</span>
            </p>
          </div>

          {/* Region selector */}
          <div className="flex items-center gap-2 shrink-0">
            <svg className="w-4 h-4 text-ink-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"
              />
            </svg>
            <select
              value={region}
              onChange={handleRegionChange}
              className="text-sm border border-line rounded-full px-3 py-2 bg-surface text-ink-mid
                         focus:outline-none focus:border-line/60 cursor-pointer"
            >
              {SUPPORTED_REGIONS.map(r => (
                <option key={r.code} value={r.code}>{r.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-ink-light italic">{error}</p>
        )}

        {/* Providers skeleton */}
        {loadingProviders && (
          <div className="space-y-14">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="skeleton w-8 h-8 rounded-lg" />
                  <div className="space-y-1.5">
                    <div className="skeleton h-2.5 w-16 rounded" />
                    <div className="skeleton h-3.5 w-28 rounded" />
                  </div>
                </div>
                <div className="flex gap-4 overflow-hidden">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <div key={j} className="shrink-0 w-32">
                      <div className="skeleton aspect-[2/3] rounded-md" />
                      <div className="skeleton h-3 w-20 mt-2 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Provider sections — loaded sequentially via individual useEffect per section */}
        {!loadingProviders && !error && providers.length > 0 && (
          <div className="space-y-14">
            {providers.map(provider => (
              <ProviderSection
                key={`${provider.id}-${region}`}
                provider={provider}
                region={region}
              />
            ))}
          </div>
        )}

        {!loadingProviders && !error && providers.length === 0 && (
          <p className="text-sm text-ink-light italic">
            No streaming providers found for {regionLabel}.
          </p>
        )}
      </div>
    </div>
  );
}
