import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import BottomNav from './BottomNav';
import ErrorBoundary from './ErrorBoundary';
import { useEffect } from 'react';

export default function Layout() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      {/* pt-14 = header height; pb-16 on mobile = bottom nav height */}
      <main className="pt-14 pb-16 md:pb-0">
        <ErrorBoundary>
          {/* key re-triggers the fade-up animation on every navigation */}
          <div key={location.key} className="animate-fade-up">
            <Outlet />
          </div>
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  );
}
