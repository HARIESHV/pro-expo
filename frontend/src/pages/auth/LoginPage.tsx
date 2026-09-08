import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../components/ui/toast';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Invalid credentials';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-strong animate-fade-in-up relative overflow-hidden rounded-3xl p-7 shadow-pop sm:p-8" data-theme={theme}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-[60px]" />
      <div className="relative">
      <div className="mb-8">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Welcome back</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to your workspace</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" id="login-form">
        <Field label="Email address">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@company.com"
          />
        </Field>

        <Field label="Password">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" className="h-3.5 w-3.5 rounded border-border bg-card accent-primary" />
            Remember me
          </label>
          <a href="#" onClick={(e) => e.preventDefault()} className="text-xs text-primary hover:underline">
            Forgot password?
          </a>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <Button id="login-submit" type="submit" className="w-full" size="lg" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              Signing in…
            </>
          ) : (
            <>
              Sign in <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{' '}
        <Link to="/register" className="font-medium text-primary hover:underline">
          Create account
        </Link>
      </p>
      </div>
    </div>
  );
}