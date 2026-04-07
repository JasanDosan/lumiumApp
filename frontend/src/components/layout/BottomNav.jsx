import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';

const TABS = [
  {
    to:    '/',
    end:   true,
    label: 'For You',
    icon:  (active) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor"
        strokeWidth={active ? 0 : 1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
  {
    to:    '/discover',
    end:   false,
    label: 'Discover',
    icon:  (active) => (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803a7.5 7.5 0 0010.607 0z" />
        {active && (
          <circle cx="10.5" cy="10.5" r="4.5" fill="currentColor" fillOpacity="0.25" />
        )}
      </svg>
    ),
  },
  {
    to:       '/library',
    end:      false,
    label:    'Library',
    protected: true,
    icon:  (active) => (
      <svg className="w-5 h-5" fill={active ? 'currentColor' : 'none'} stroke="currentColor"
        strokeWidth={active ? 0 : 1.75} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-canvas/95 backdrop-blur-md border-t border-line
                    safe-area-pb flex">
      {TABS.map(tab => {
        if (tab.protected && !isAuthenticated) {
          return (
            <button
              key={tab.to}
              onClick={() => navigate('/login')}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-ink-light
                         hover:text-ink transition-colors"
            >
              {tab.icon(false)}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        }

        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
                isActive ? 'text-accent' : 'text-ink-light hover:text-ink'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {tab.icon(isActive)}
                <span className="text-[10px] font-medium">{tab.label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
