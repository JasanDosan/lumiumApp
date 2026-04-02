import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import { useEffect } from 'react';
import { useUserLibraryStore } from '@/features/library/libraryStore';
import { useAuthStore } from '@/features/auth/authStore';

export default function Layout() {
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();
  const { fetchLibrary } = useUserLibraryStore();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  // Fetch authoritative library from backend whenever auth state changes
  useEffect(() => {
    fetchLibrary().catch(() => {});
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
