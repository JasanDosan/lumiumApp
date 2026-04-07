import { Link } from 'react-router-dom';
import { useUserLibraryStore } from '@/features/library/libraryStore';
import LibraryCard from '@/features/favorites/LibraryCard';
import DragRow from '@/components/ui/DragRow';

export default function RecentlySaved() {
  const library = useUserLibraryStore(s => s.library);

  const recent = [...library]
    .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
    .slice(0, 8);

  if (!recent.length) return null;

  return (
    <section className="pt-14">
      <div className="flex items-end justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-0.5 h-5 bg-accent rounded-full shrink-0" />
            <p className="text-[10px] font-black tracking-[0.2em] uppercase text-accent">Your Library</p>
          </div>
          <h2 className="title-lg">Recently Saved</h2>
        </div>
        <Link
          to="/library"
          className="shrink-0 text-xs text-ink-light hover:text-ink transition-colors"
        >
          View all →
        </Link>
      </div>
      <DragRow gap="gap-3">
        {recent.map(item => (
          <div key={item.id} className="shrink-0 w-32 sm:w-36 pointer-events-auto">
            <LibraryCard item={item} />
          </div>
        ))}
      </DragRow>
    </section>
  );
}
