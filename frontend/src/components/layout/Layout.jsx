import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import { useEffect } from 'react';
import { useFavoritesStore } from '@/features/favorites/favoritesStore';
import { useAuthStore } from '@/features/auth/authStore';

export default function Layout() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { init } = useFavoritesStore();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  useEffect(() => {
    init();
  }, [isAuthenticated, init]);

  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      <main className="pt-14">
        <Outlet />
      </main>
    </div>
  );
}
