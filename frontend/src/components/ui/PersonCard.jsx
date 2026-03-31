import { Link } from 'react-router-dom';

export default function PersonCard({ person }) {
  return (
    <Link to={`/person/${person.id}`} className="group block shrink-0 w-28">
      <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-surface-high">
        {person.profileUrl ? (
          <img
            src={person.profileUrl}
            alt={person.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl text-ink-faint select-none">◎</span>
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-[13px] font-medium text-ink leading-tight truncate">{person.name}</p>
        {person.department && (
          <p className="text-xs text-ink-light mt-0.5">{person.department}</p>
        )}
        {person.knownFor?.length > 0 && (
          <p className="text-[11px] text-ink-light mt-0.5 leading-tight line-clamp-2">
            {person.knownFor.join(', ')}
          </p>
        )}
      </div>
    </Link>
  );
}
