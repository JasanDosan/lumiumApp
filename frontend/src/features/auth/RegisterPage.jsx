import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from './authStore';
import Input from '@/components/ui/Input';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState({});

  const handleChange = (e) => {
    clearError();
    setFieldErrors(fe => ({ ...fe, [e.target.name]: undefined }));
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const validate = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.email.includes('@')) errors.email = 'Enter a valid email';
    if (form.password.length < 8) errors.password = 'Min. 8 characters';
    if (form.password !== form.confirm) errors.confirm = 'Passwords do not match';
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length) return setFieldErrors(errors);
    const ok = await register({ name: form.name, email: form.email, password: form.password });
    if (ok) navigate('/');
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm animate-fade-in">

        <div className="mb-10 text-center">
          <Link to="/" className="inline-block mb-6">
            <span className="text-sm font-semibold tracking-[0.15em] uppercase text-ink">Pellicola</span>
          </Link>
          <h1 className="text-xl font-semibold text-ink">Create your account</h1>
          <p className="text-sm text-ink-light mt-1">Start discovering great films</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red bg-red-soft border border-red/20 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <Input label="Full name" name="name" value={form.name} onChange={handleChange}
            placeholder="Jane Doe" error={fieldErrors.name} autoComplete="name" required />
          <Input label="Email" type="email" name="email" value={form.email} onChange={handleChange}
            placeholder="you@example.com" error={fieldErrors.email} autoComplete="email" required />
          <Input label="Password" type="password" name="password" value={form.password} onChange={handleChange}
            placeholder="Min. 8 characters" error={fieldErrors.password} autoComplete="new-password" required />
          <Input label="Confirm password" type="password" name="confirm" value={form.confirm} onChange={handleChange}
            placeholder="••••••••" error={fieldErrors.confirm} autoComplete="new-password" required />

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-full bg-ink text-white text-sm font-medium
                       hover:bg-ink/80 transition-colors disabled:opacity-40
                       flex items-center justify-center gap-2"
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
            Create account
          </button>
        </form>

        <p className="text-center text-sm text-ink-light mt-8">
          Already have an account?{' '}
          <Link to="/login" className="text-ink hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
