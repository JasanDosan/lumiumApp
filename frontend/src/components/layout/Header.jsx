import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { useState } from 'react';

export default function Header() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLinkClass = ({ isActive }) =>
    `text-sm transition-colors duration-150 ${
      isActive ? 'text-ink font-medium' : 'text-ink-mid hover:text-ink'
    }`;

  const handleLogout = () => {
    logout();
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-canvas/95 backdrop-blur-md border-b border-line">
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between h-14">

          {/* Logo → home */}
          <Link to="/" className="flex items-center">
            <span className="text-sm font-semibold tracking-[0.14em] uppercase text-ink">
              Pellicola
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7">
            <NavLink to="/" end className={navLinkClass}>Home</NavLink>
            <NavLink to="/movies" className={navLinkClass}>Platforms</NavLink>
            {isAuthenticated && (
              <>
                <NavLink to="/favorites" className={navLinkClass}>Collection</NavLink>
                <NavLink to="/recommendations" className={navLinkClass}>For You</NavLink>
              </>
            )}
          </nav>

          {/* Auth */}
          <div className="hidden md:flex items-center gap-5">
            <Link to="/search" className="text-ink-light hover:text-ink transition-colors" aria-label="Search">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </Link>
            {isAuthenticated ? (
              <NavLink to="/profile" className={navLinkClass}>
                {user?.name?.split(' ')[0]}
              </NavLink>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm text-ink-mid hover:text-ink transition-colors"
                >
                  Sign in
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="text-sm bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-full font-medium transition-colors"
                >
                  Get started
                </button>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden text-ink-mid hover:text-ink p-1 transition-colors"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-canvas border-t border-line px-5 py-5 flex flex-col gap-4 animate-fade-in">
          <NavLink to="/" end className={navLinkClass} onClick={() => setMenuOpen(false)}>Home</NavLink>
          <NavLink to="/search" className={navLinkClass} onClick={() => setMenuOpen(false)}>Search</NavLink>
          <NavLink to="/movies" className={navLinkClass} onClick={() => setMenuOpen(false)}>Platforms</NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/favorites" className={navLinkClass} onClick={() => setMenuOpen(false)}>Collection</NavLink>
              <NavLink to="/recommendations" className={navLinkClass} onClick={() => setMenuOpen(false)}>For You</NavLink>
              <NavLink to="/profile" className={navLinkClass} onClick={() => setMenuOpen(false)}>Profile</NavLink>
            </>
          )}
          <div className="border-t border-line pt-4">
            {isAuthenticated ? (
              <button className="text-sm text-ink-mid hover:text-ink transition-colors" onClick={handleLogout}>
                Sign out
              </button>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => { navigate('/login'); setMenuOpen(false); }}
                  className="text-sm text-ink-mid hover:text-ink transition-colors">Sign in</button>
                <button onClick={() => { navigate('/register'); setMenuOpen(false); }}
                  className="text-sm bg-accent hover:bg-accent-hover text-white px-4 py-1.5 rounded-full font-medium transition-colors">Get started</button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
