import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/authStore';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<{ confirm?: string; server?: string }>({});

  const registerMutation = useMutation({
    mutationFn: ({ username, email, password }: { username: string; email: string; password: string }) =>
      authService.register({ username, email, password }),
    onSuccess: (data) => {
      setAuth(data.token, data.user);
      navigate('/');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setErrors({ server: err.response?.data?.message ?? 'Registration failed. Please try again.' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (form.password !== form.confirm) next.confirm = 'Passwords do not match.';
    if (Object.keys(next).length) { setErrors(next); return; }
    setErrors({});
    registerMutation.mutate({ username: form.username, email: form.email, password: form.password });
  };

  const field = (key: keyof typeof form, label: string, type: string, placeholder: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="block text-sm text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        className="input"
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        required
        {...extra}
      />
    </div>
  );

  return (
    <div className="flex items-center justify-center min-h-[80vh] px-4">
      <div className="card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">♟</div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-gray-400 text-sm mt-1">Start your chess journey</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {field('username', 'Username', 'text', 'chessmaster99', { autoComplete: 'username', minLength: 3, maxLength: 32 })}
          {field('email', 'Email', 'email', 'you@example.com', { autoComplete: 'email' })}
          {field('password', 'Password', 'password', 'Min 8 characters', { autoComplete: 'new-password', minLength: 8 })}

          <div>
            <label className="block text-sm text-gray-400 mb-1">Confirm Password</label>
            <input
              type="password"
              className={`input ${
                errors.confirm ? 'border-red-500 focus:border-red-500' : ''
              }`}
              placeholder="Repeat your password"
              value={form.confirm}
              onChange={(e) => { setForm({ ...form, confirm: e.target.value }); setErrors((p) => ({ ...p, confirm: undefined })); }}
              autoComplete="new-password"
              required
            />
            {errors.confirm && (
              <p className="text-xs text-red-400 mt-1">{errors.confirm}</p>
            )}
          </div>

          {errors.server && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm">{errors.server}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="btn-primary w-full"
          >
            {registerMutation.isPending ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
