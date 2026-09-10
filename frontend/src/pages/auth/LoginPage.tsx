import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { authApi } from '../../api/auth';
import { Button } from '../../components/ui/button';
import { useToast } from '../../components/ui/toast';
import { AuthBrandPanel, AuthLogo } from './AuthVisual';

const inputClass =
  'h-12 w-full rounded-xl border border-[#dbe3eb] bg-[#fbfdff] pl-11 pr-4 text-sm text-[#0f2744] placeholder:text-[#9fb0c4] transition-colors focus:border-[#ff6b00]/60 focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/20';

interface ApiErrorShape {
  response?: { status?: number; data?: { message?: string; code?: string } };
  message?: string;
}

export default function LoginPage() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Email address is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    setIsLoading(true);
    try {
      const res = await authApi.login(trimmed, password);
      const payload = res.data?.data;
      if (!payload?.user || !payload?.tokens) {
        throw new Error('Unexpected response from server');
      }
      setAuth(payload.user, payload.tokens);
      toast.success('Signed in successfully. Redirecting...');
      const roles = (payload.user.roles || []).map((r) => r.toLowerCase().trim());
      if (roles.includes('admin') || roles.includes('super_admin')) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const e = err as ApiErrorShape;
      const message =
        e.response?.data?.code === 'ACCOUNT_INACTIVE'
          ? 'This account is not active. Contact your administrator.'
          : e.response?.data?.message ||
            (!e?.response
              ? 'Unable to connect to the server. Please try again.'
              : 'Something went wrong. Please try again.');
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fff7ed_0%,#f8fafc_45%,#fff3e8_100%)] p-3 text-[#08264d] sm:p-6 lg:p-10">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1240px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_70px_-24px_rgba(8,38,77,0.28)] sm:min-h-[calc(100vh-3rem)] lg:min-h-[740px]">
        <AuthBrandPanel mode="login" />
        <section className="flex w-full flex-col justify-center bg-white px-6 py-10 sm:px-12 lg:w-[45%] lg:px-14">
          <div className="mx-auto w-full max-w-[390px]">
            <AuthLogo />
            <div className="mb-8 mt-10 lg:mt-0">
              <h2 className="text-[30px] font-bold tracking-[-0.03em] text-[#08264d]">Welcome Back</h2>
              <p className="mt-2 text-sm text-[#718096]">Sign in with your account credentials</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#3e5370]">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#91a0b2]" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#3e5370]">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#91a0b2]" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className={inputClass}
                  />
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button
                id="login-submit"
                type="submit"
                className="h-12 w-full rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#ff9500] text-[15px] font-bold text-white shadow-[0_16px_32px_-12px_rgba(255,107,0,0.55)] transition-all hover:from-[#ff7a1a] hover:to-[#ffa11a] hover:shadow-[0_18px_38px_-10px_rgba(255,107,0,0.65)]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Sign up link */}
            <p className="mt-7 text-center text-sm text-[#718096]">
              Don&apos;t have an account?{' '}
              <Link to="/register" className="font-bold text-[#ff6b00] transition-colors hover:text-[#d95700]">
                Sign Up
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}