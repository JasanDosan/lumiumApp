import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import { useEffect } from 'react';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';
import { useLibraryStore } from '@/features/library/libraryStore';
import { useAuthStore } from '@/features/auth/authStore';

export default function Layout() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { init } = useFavoritesStore();
  const { addMovie } = useLibraryStore();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  // Load favorites from backend, then sync into libraryStore so they
  // immediately drive recommendations without the user re-saving each one.
  useEffect(() => {
    init().then(() => {
      const { favorites } = useFavoritesStore.getState();
      favorites.forEach(m => addMovie(m));
    }).catch(() => {});
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      <main className="pt-14">
        <Outlet />
      </main>
    </div>
  );
}
