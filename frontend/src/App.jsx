import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from '@/components/layout/Layout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import ToastContainer from '@/components/ui/Toast';
import { useAuthStore } from '@/features/auth/authStore';
import { useEffect } from 'react';

// ─── Route-level code splitting ───────────────────────────────────────────────

const HomePage             = lazy(() => import('@/features/home/HomePage'));
const MovieDetailPage      = lazy(() => import('@/features/movies/MovieDetailPage'));
const GameDetailPage       = lazy(() => import('@/features/games/GameDetailPage'));
const SeriesDetailPage     = lazy(() => import('@/features/series/SeriesDetailPage'));
const DiscoverPage         = lazy(() => import('@/features/discover/DiscoverPage'));
const FavoritesPage        = lazy(() => import('@/features/favorites/FavoritesPage'));
const RecommendationsPage  = lazy(() => import('@/features/recommendations/RecommendationsPage'));
const ProfilePage          = lazy(() => import('@/features/profile/ProfilePage'));
const PersonPage           = lazy(() => import('@/features/person/PersonPage'));
const SearchPage           = lazy(() => import('@/features/search/SearchPage'));
const LoginPage            = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage         = lazy(() => import('@/features/auth/RegisterPage'));

function RouteSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <Suspense fallback={<RouteSpinner />}>
      <ToastContainer />
      <Routes>
        {/* ── Auth pages (no shell) ──────────────────────────────────────── */}
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* ── App shell ─────────────────────────────────────────────────── */}
        <Route element={<Layout />}>
          {/* Primary destinations */}
          <Route path="/"         element={<HomePage />} />
          <Route path="/discover" element={<DiscoverPage />} />

          {/* Content detail */}
          <Route path="/movie/:id"  element={<MovieDetailPage />} />
          <Route path="/series/:id" element={<SeriesDetailPage />} />
          <Route path="/game/:id"   element={<GameDetailPage />} />
          <Route path="/person/:id" element={<PersonPage />} />
          <Route path="/search"     element={<SearchPage />} />

          {/* Protected */}
          <Route element={<ProtectedRoute />}>
            <Route path="/library"  element={<FavoritesPage />} />
            <Route path="/profile"  element={<ProfilePage />} />
          </Route>

          {/* Legacy redirects — keep external links / bookmarks working */}
          <Route path="/favorites"       element={<Navigate to="/library"  replace />} />
          <Route path="/recommendations" element={<Navigate to="/"         replace />} />
          <Route path="/movies"          element={<Navigate to="/discover" replace />} />

          {/* Protected legacy — redirect after auth check */}
          <Route element={<ProtectedRoute />}>
            <Route path="/for-you" element={<RecommendationsPage />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
