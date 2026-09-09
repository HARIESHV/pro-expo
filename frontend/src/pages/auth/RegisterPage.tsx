import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { AuthBrandPanel, AuthLogo } from './AuthVisual';
import { authApi } from '../../api/auth';
import { useAuth } from '../../auth/useAuth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
const GMAIL_ERROR_MESSAGE = 'Please use a valid Gmail address ending with @gmail.com.';

interface FormState {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

function validateFields(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.fullName.trim()) {
    errors.fullName = 'Full name is required';
  } else {
    const nameParts = form.fullName.trim().split(/\s+/);
    if (nameParts.length < 2) errors.fullName = 'Please enter your full name (first and last name)';
    else if (nameParts.length > 5) errors.fullName = 'Please enter a valid full name';
  }
  if (!form.email.trim()) {
    errors.email = 'Email address is required';
  } else if (!EMAIL_REGEX.test(form.email.trim())) {
    errors.email = 'Please enter a valid email address';
  } else if (!GMAIL_REGEX.test(form.email.trim())) {
    errors.email = GMAIL_ERROR_MESSAGE;
  }
  if (!form.password) {
    errors.password = 'Password is required';
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  if (!form.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password';
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }
  return errors;
}

function hasErrors(errors: Record<string, string>): boolean {
  return Object.keys(errors).length > 0;
}

function getApiErrorMessage(err: unknown): string {
  const response = err as { response?: { status?: number; data?: unknown }; request?: unknown; message?: string };
  const serverReturned = !!response?.response;

  // Network-level failures: request never reached an API body (Vite proxy down,
  // backend crashed/restarting, CORS, timeout). Report the truth instead of a
  // misleading generic failure.
  if (!serverReturned) {
    if ((response?.message || '').toLowerCase().includes('timeout')) {
      return 'The server took too long to respond. Please try again.';
    }
    return 'Unable to connect to the server. Please try again.';
  }

  const data = response.response?.data;

  // Non-object bodies (e.g. a reverse-proxy HTML error page, gateway 502/504)
  // mean the request never reached the API. The backend always answers in JSON,
  // so this is an infrastructure fault — say so accurately.
  if (typeof data !== 'object' || data === null) {
    return 'Unable to connect to the server. Please try again.';
  }

  const errorData = data as { message?: string; code?: string; errors?: Record<string,string[]> };

  // Map server error codes to exact, user-safe messages.
  if (errorData.code) {
    switch (errorData.code) {
      case 'EMAIL_EXISTS':
        return 'This email is already registered.';
      case 'INVALID_EMAIL':
        return 'Please enter a valid email address.';
      case 'DATABASE_UNAVAILABLE':
        return 'Database is temporarily unavailable. Please try again shortly.';
      default:
        break;
    }
  }

  if (errorData.message) {
    if (errorData.message.includes('Database is temporarily unavailable')) return 'Database is temporarily unavailable. Please try again shortly.';
    return errorData.message;
  }

  // 422/400 field errors from zod validation middleware
  const errors = errorData.errors;
  if (errors) {
    for (const key of Object.keys(errors)) {
      const arr = errors[key];
      if (arr && arr.length) {
        const first = arr[0];
        if (key === 'email') return first;
      }
    }
    const firstKey = Object.keys(errors)[0];
    if (firstKey && errors[firstKey]?.[0]) return errors[firstKey][0];
  }

  return 'The server returned an unexpected error. Please try again.';
}

const inputClass =
  'h-12 w-full rounded-xl border border-[#dbe3eb] bg-[#fbfdff] pl-11 pr-4 text-sm text-[#0f2744] placeholder:text-[#9fb0c4] transition-colors focus:border-[#ff6b00]/60 focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/20';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [form, setForm] = useState<FormState>({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    // Clear a field's inline error as the user edits it
    if (fieldErrors[event.target.name]) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[event.target.name];
        return next;
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isLoading) return;
    const errors = validateFields(form);
    setFieldErrors(errors);
    if (hasErrors(errors)) {
      setError('Please fix the highlighted fields to continue.');
      setSuccess('');
      return;
    }
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      const nameParts = form.fullName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || firstName;
      const res = await authApi.register({
        firstName,
        lastName,
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      const payload = res?.data?.data;
      if (!payload?.user || !payload?.tokens) {
        throw new Error('Unexpected response from server');
      }
      setAuth(payload.user, payload.tokens);
      setSuccess('Account created successfully. Redirecting to your dashboard...');
      setTimeout(() => navigate('/dashboard', { replace: true }), 900);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eaf7ff_0%,#f8fbfd_45%,#eefbf8_100%)] p-3 text-[#08264d] sm:p-6 lg:p-10">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1240px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_70px_-24px_rgba(8,38,77,0.28)] sm:min-h-[calc(100vh-3rem)] lg:min-h-[740px]">
        <AuthBrandPanel mode="register" />
        <section className="flex w-full flex-col justify-center bg-white px-6 py-10 sm:px-12 lg:w-[45%] lg:px-14">
          <div className="mx-auto w-full max-w-[390px]">
            <AuthLogo dark={false} />
            <div className="mb-7 mt-10 lg:mt-0">
              <h2 className="text-[30px] font-bold tracking-[-0.03em] text-[#08264d]">Get Started</h2>
              <p className="mt-2 text-sm text-[#718096]">Create your account to continue</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5" id="register-form">
              {/* Full Name */}
              <div>
                <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-[#3e5370]">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#91a0b2]" />
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    value={form.fullName}
                    onChange={handleChange}
                    required
                    autoComplete="name"
                    placeholder="Enter your name"
                    aria-invalid={!!fieldErrors.fullName}
                    className={`${inputClass} ${fieldErrors.fullName ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : ''}`}
                  />
                </div>
                {fieldErrors.fullName && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.fullName}</p>}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#3e5370]">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#91a0b2]" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                    placeholder="Enter your email address"
                    aria-invalid={!!fieldErrors.email}
                    className={`${inputClass} ${fieldErrors.email ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : ''}`}
                  />
                </div>
                {fieldErrors.email && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#3e5370]">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#91a0b2]" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    className={`h-12 w-full rounded-xl border border-[#dbe3eb] bg-[#fbfdff] pl-11 pr-12 text-sm text-[#0f2744] placeholder:text-[#9fb0c4] transition-colors focus:border-[#ff6b00]/60 focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/20 ${fieldErrors.password ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#91a0b2] hover:text-[#08264d]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
                {fieldErrors.password && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.password}</p>}
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-[#3e5370]">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#91a0b2]" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    className={`h-12 w-full rounded-xl border border-[#dbe3eb] bg-[#fbfdff] pl-11 pr-12 text-sm text-[#0f2744] placeholder:text-[#9fb0c4] transition-colors focus:border-[#ff6b00]/60 focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/20 ${fieldErrors.confirmPassword ? 'border-red-400 focus:border-red-400 focus:ring-red-200' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#91a0b2] hover:text-[#08264d]"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
                {fieldErrors.confirmPassword && <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.confirmPassword}</p>}
              </div>

              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
              {success && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{success}</div>}

              {/* Submit */}
              <Button
                id="register-submit"
                type="submit"
                className="h-12 w-full rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#ff9500] text-[15px] font-bold text-white shadow-[0_16px_32px_-12px_rgba(255,107,0,0.55)] transition-all hover:from-[#ff7a1a] hover:to-[#ffa11a] hover:shadow-[0_18px_38px_-10px_rgba(255,107,0,0.65)]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Sign Up <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* OR divider */}
            <div className="relative my-7 flex items-center justify-center">
              <div className="absolute w-full border-t border-[#e6ebf0]" />
              <span className="relative bg-white px-3 text-xs font-semibold tracking-wide text-[#9aa7b5]">OR</span>
            </div>

            {/* Login link */}
            <p className="text-center text-sm text-[#718096]">
              Already have an account? <Link to="/login" className="font-bold text-[#ff6b00] hover:text-[#d95700]">Login</Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}