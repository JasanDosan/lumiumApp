import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { personService } from '@/services/personService';
import MovieRow from '@/features/movies/MovieRow';
import SectionWrapper from '@/components/ui/SectionWrapper';

export default function PersonPage() {
  const { id } = useParams();
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    setPerson(null);
    personService.getPerson(id)
      .then(data => setPerson(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PersonSkeleton />;
  if (!person) return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <p className="text-ink-light text-sm">Person not found.</p>
    </div>
  );

  const bioText = person.biography || '';
  const bioCutOff = 400;
  const bioTrimmed = bioText.length > bioCutOff && !bioExpanded
    ? bioText.slice(0, bioCutOff).trimEnd() + '…'
    : bioText;

  const age = person.birthday
    ? Math.floor((Date.now() - new Date(person.birthday).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-10">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex gap-6 sm:gap-10 mb-10">
          {/* Photo */}
          <div className="shrink-0">
            <div className="w-28 sm:w-36 aspect-[2/3] rounded-lg overflow-hidden bg-neutral-100">
              {person.profileUrl ? (
                <img
                  src={person.profileUrl}
                  alt={person.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-4xl text-ink-faint">◎</span>
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-1">
            {person.department && (
              <p className="section-label mb-2">{person.department}</p>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold text-ink leading-tight mb-3">
              {person.name}
            </h1>

            {/* Meta pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {person.birthday && (
                <span className="text-xs bg-neutral-100 text-ink-mid px-3 py-1 rounded-full border border-line">
                  b. {person.birthday}{age ? ` (${age})` : ''}
                </span>
              )}
              {person.placeOfBirth && (
                <span className="text-xs bg-neutral-100 text-ink-mid px-3 py-1 rounded-full border border-line truncate max-w-[200px]">
                  {person.placeOfBirth}
                </span>
              )}
            </div>

            {/* Bio */}
            {bioText && (
              <div>
                <p className="text-sm text-ink-mid leading-relaxed">{bioTrimmed}</p>
                {bioText.length > bioCutOff && (
                  <button
                    onClick={() => setBioExpanded(v => !v)}
                    className="mt-1.5 text-xs text-ink-light hover:text-ink transition-colors"
                  >
                    {bioExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Discover their films ──────────────────────────────────── */}
        <div className="mb-4 pb-4 border-b border-line">
          <Link
            to={`/?person=${person.id}&personName=${encodeURIComponent(person.name)}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink border border-line px-4 py-2 rounded-full hover:bg-neutral-50 transition-colors"
          >
            Browse all films with {person.name.split(' ')[0]}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* ── Film sections ─────────────────────────────────────────── */}
        <div className="space-y-12 mt-10">
          {person.cast.length > 0 && (
            <SectionWrapper label="As actor" title="Known for">
              <MovieRow movies={person.cast} />
            </SectionWrapper>
          )}
          {person.directed.length > 0 && (
            <SectionWrapper label="As director" title="Directed">
              <MovieRow movies={person.directed} />
            </SectionWrapper>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonSkeleton() {
  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12 py-10">
        <div className="flex gap-8 mb-10">
          <div className="skeleton w-28 sm:w-36 aspect-[2/3] rounded-lg shrink-0" />
          <div className="flex-1 space-y-3 pt-1">
            <div className="skeleton h-3 w-16 rounded" />
            <div className="skeleton h-8 w-56 rounded" />
            <div className="skeleton h-3 w-32 rounded" />
            <div className="skeleton h-3 w-full rounded mt-4" />
            <div className="skeleton h-3 w-5/6 rounded" />
            <div className="skeleton h-3 w-4/6 rounded" />
          </div>
        </div>
        <div className="skeleton h-3 w-24 rounded mb-2" />
        <div className="flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shrink-0 w-28">
              <div className="skeleton aspect-[2/3] rounded-md w-full" />
              <div className="skeleton h-3 w-20 mt-2 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
