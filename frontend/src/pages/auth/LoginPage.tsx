import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ChevronLeft, KeyRound, Mail } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { authApi } from '../../api/auth';
import { Button } from '../../components/ui/button';
import { useToast } from '../../components/ui/toast';
import { AuthBrandPanel, AuthLogo } from './AuthVisual';

const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
const GMAIL_ERROR_MESSAGE = 'Please use a valid Gmail address ending with @gmail.com.';

const inputClass =
  'h-12 w-full rounded-xl border border-[#dbe3eb] bg-[#fbfdff] pl-11 pr-4 text-sm text-[#0f2744] placeholder:text-[#9fb0c4] transition-colors focus:border-[#ff6b00]/60 focus:outline-none focus:ring-2 focus:ring-[#ff6b00]/20';

interface ApiErrorShape {
  response?: { status?: number; data?: { message?: string; code?: string } };
  message?: string;
}

function mapCode(code: string | undefined): string | null {
  switch (code) {
    case 'INVALID_EMAIL':
      return GMAIL_ERROR_MESSAGE;
    case 'INVALID_OTP':
      return 'Invalid OTP. Please check the code and try again.';
    case 'OTP_EXPIRED':
      return 'This OTP has expired. Please request a new code.';
    case 'OTP_USED':
      return 'This OTP has already been used. Please request a new one.';
    case 'OTP_MAX_ATTEMPTS':
      return 'Too many incorrect attempts. Please request a new code.';
    case 'ACCOUNT_INACTIVE':
      return 'This account is not active. Contact your administrator.';
    case 'OTP_NOT_CONFIGURED':
      return 'The sign-in email service is not configured yet. Please try again later.';
    case 'EMAIL_SEND_FAILED':
      return 'Email sending failed. Please check the address and try again.';
    case 'DATABASE_UNAVAILABLE':
      return 'The database is temporarily unavailable. Please try again shortly.';
    default:
      return null;
  }
}

function getApiErrorMessage(err: unknown): string {
  const e = err as ApiErrorShape;
  if (!e?.response) {
    if ((e?.message || '').toLowerCase().includes('timeout')) {
      return 'The server took too long to respond. Please try again.';
    }
    return 'Unable to connect to the server. Please try again.';
  }
  const mapped = mapCode(e.response.data?.code);
  if (mapped) return mapped;
  return e.response.data?.message || 'Something went wrong. Please try again.';
}

type Step = 'email' | 'otp';

export default function LoginPage() {
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const otpInputRef = useRef<HTMLInputElement>(null);

  const handleSendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Email address is required');
      return;
    }
    if (!GMAIL_REGEX.test(trimmed)) {
      setError(GMAIL_ERROR_MESSAGE);
      return;
    }
    setIsLoading(true);
    try {
      await authApi.sendOtp(trimmed);
      setEmail(trimmed);
      setOtp('');
      setNotice('OTP sent successfully. Check your Gmail inbox.');
      toast.success('OTP sent successfully. Check your Gmail inbox.');
      setStep('otp');
      requestAnimationFrame(() => otpInputRef.current?.focus());
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');
    setIsLoading(true);
    try {
      await authApi.sendOtp(email);
      setOtp('');
      setNotice('A new OTP has been sent successfully. Check your Gmail inbox.');
      toast.success('A new OTP was sent to your Gmail inbox.');
      requestAnimationFrame(() => otpInputRef.current?.focus());
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!/^\d{6}$/.test(otp.trim())) {
      setError('OTP must be exactly 6 digits.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await authApi.verifyOtp(email, otp.trim());
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
      const message = getApiErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fff7ed_0%,#f8fafc_45%,#fff3e8_100%)] p-3 text-[#08264d] sm:p-6 lg:p-10">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1240px] overflow-hidden rounded-[28px] bg-white shadow-[0_24px_70px_-24px_rgba(8,38,77,0.28)] sm:min-h-[calc(100vh-3rem)] lg:min-h-[740px]">
        <AuthBrandPanel mode="login" />
        <section className="flex w-full flex-col justify-center bg-white px-6 py-10 sm:px-12 lg:w-[45%] lg:px-14">
          <div className="mx-auto w-full max-w-[390px]">
            <AuthLogo />
            <div className="mb-8 mt-10 lg:mt-0">
              {step === 'email' ? (
                <>
                  <h2 className="text-[30px] font-bold tracking-[-0.03em] text-[#08264d]">Welcome Back</h2>
                  <p className="mt-2 text-sm text-[#718096]">Sign in with your Gmail address — no password needed</p>
                </>
              ) : (
                <>
                  <h2 className="text-[30px] font-bold tracking-[-0.03em] text-[#08264d]">Check Your Inbox</h2>
                  <p className="mt-2 text-sm text-[#718096]">
                    Enter the 6-digit code we sent to{' '}
                    <span className="font-semibold text-[#0f2744]">{email}</span>
                  </p>
                </>
              )}
            </div>

            {step === 'email' ? (
              <form onSubmit={handleSendOtp} className="space-y-5" id="login-form">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#3e5370]">
                    Gmail Address
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
                      placeholder="you@gmail.com"
                      className={inputClass}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-[#9aa7b5]">Only valid @gmail.com addresses can sign in.</p>
                </div>

                {error && (
                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                  </div>
                )}
                {notice && (
                  <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {notice}
                  </div>
                )}

                <Button
                  id="send-otp"
                  type="submit"
                  className="h-12 w-full rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#ff9500] text-[15px] font-bold text-white shadow-[0_16px_32px_-12px_rgba(255,107,0,0.55)] transition-all hover:from-[#ff7a1a] hover:to-[#ffa11a] hover:shadow-[0_18px_38px_-10px_rgba(255,107,0,0.65)]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Sending code...
                    </>
                  ) : (
                    <>
                      Send OTP <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-5" id="otp-form">
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div>
                    <label htmlFor="otp" className="mb-1.5 block text-sm font-medium text-[#3e5370]">
                      Verification Code
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#91a0b2]" />
                      <input
                        id="otp"
                        ref={otpInputRef}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => handleOtpChange(e.target.value)}
                        placeholder="••••••"
                        className={`${inputClass} pr-8 text-center text-lg font-bold tracking-[0.5em]`}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-[#9aa7b5]">The code expires in 5 minutes.</p>
                  </div>

                  {error && (
                    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                      {error}
                    </div>
                  )}
                  {notice && (
                    <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      {notice}
                    </div>
                  )}

                  <Button
                    id="verify-otp"
                    type="submit"
                    className="h-12 w-full rounded-xl bg-gradient-to-r from-[#ff6b00] to-[#ff9500] text-[15px] font-bold text-white shadow-[0_16px_32px_-12px_rgba(255,107,0,0.55)] transition-all hover:from-[#ff7a1a] hover:to-[#ffa11a] hover:shadow-[0_18px_38px_-10px_rgba(255,107,0,0.65)]"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify &amp; Sign In <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('email');
                      setError('');
                      setNotice('');
                    }}
                    className="inline-flex items-center gap-1 font-medium text-[#ff6b00] transition-colors hover:text-[#d95700]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Use a different email
                  </button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isLoading}
                    className="font-medium text-[#ff6b00] transition-colors hover:text-[#d95700] disabled:opacity-60"
                  >
                    Resend OTP
                  </button>
                </div>
              </div>
            )}

            {/* OR divider */}
            <div className="relative my-7 flex items-center justify-center">
              <div className="absolute w-full border-t border-[#e6ebf0]" />
              <span className="relative bg-white px-3 text-xs font-semibold tracking-wide text-[#9aa7b5]">OR</span>
            </div>

            {/* Sign up link */}
            <p className="text-center text-sm text-[#718096]">
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