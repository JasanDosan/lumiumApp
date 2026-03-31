import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './authStore';
import Input from '@/components/ui/Input';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [form, setForm] = useState({ email: '', password: '' });
  const from = location.state?.from?.pathname || '/';

  const handleChange = (e) => {
    clearError();
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await login(form);
    if (ok) navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-5">
      <div className="w-full max-w-sm animate-fade-in">

        <div className="mb-10 text-center">
          <Link to="/" className="inline-block mb-6">
            <span className="text-sm font-semibold tracking-[0.15em] uppercase text-ink">Pellicola</span>
          </Link>
          <h1 className="text-xl font-semibold text-ink">Welcome back</h1>
          <p className="text-sm text-ink-light mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red bg-red-soft border border-red/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
          <Input
            label="Password"
            type="password"
            name="password"
            value={form.password}
            onChange={handleChange}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-full bg-accent text-white text-sm font-medium
                       hover:bg-accent-hover transition-colors disabled:opacity-40
                       flex items-center justify-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
            Sign in
          </button>
        </form>

        <p className="text-center text-sm text-ink-light mt-8">
          No account?{' '}
          <Link to="/register" className="text-ink hover:underline font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
