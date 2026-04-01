import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import HomePage from '@/features/home/HomePage';
import MovieDetailPage from '@/features/movies/MovieDetailPage';
import FavoritesPage from '@/features/favorites/FavoritesPage';
import RecommendationsPage from '@/features/recommendations/RecommendationsPage';
import ProfilePage from '@/features/profile/ProfilePage';
import PersonPage from '@/features/person/PersonPage';
import SearchPage from '@/features/search/SearchPage';
import MoviesPage from '@/features/movies/MoviesPage';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import { useAuthStore } from '@/features/auth/authStore';
import { useEffect } from 'react';

export default function App() {
  const { initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<Layout />}>
        <Route path="/"          element={<HomePage />} />
        {/* /discover is now part of Home — redirect for any existing links */}
        <Route path="/discover"  element={<Navigate to="/" replace />} />

        <Route path="/movie/:id"  element={<MovieDetailPage />} />
        <Route path="/game/:id"   element={<Navigate to="/" replace />} />
        <Route path="/person/:id" element={<PersonPage />} />
        <Route path="/search"     element={<SearchPage />} />
        <Route path="/movies"     element={<MoviesPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/favorites"       element={<FavoritesPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/profile"         element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
