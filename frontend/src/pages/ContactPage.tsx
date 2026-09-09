import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowRight,
  Mail,
  Clock,
  ShieldCheck,
  Gauge,
  MessageSquare,
  Network,
  Menu,
  X,
  Send,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input, Textarea } from '../components/ui/input';
import { Label, Field } from '../components/ui/field';
import { useAuth } from '../auth/useAuth';
import { sendContact } from '../api/contact';
import { cn } from '../utils/cn';

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  email: z.string().trim().email('Please enter a valid email address').max(254, 'Email is too long'),
  subject: z.string().trim().min(1, 'Subject is required').max(150, 'Subject must be at most 150 characters'),
  message: z.string().trim().min(1, 'Message is required').max(5000, 'Message must be at most 5000 characters'),
});

type ContactFormData = z.infer<typeof contactSchema>;

const NAV_LINKS: Array<[string, string, boolean]> = [
  ['/#home', 'Home', false],
  ['/#features', 'Features', false],
  ['/#about', 'About', false],
  ['/contact', 'Contact', true],
];

export default function ContactPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', subject: '', message: '' },
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const primary = isAuthenticated
    ? { label: 'Open workspace', to: '/dashboard' }
    : { label: 'Get started free', to: '/register' };

  const onSubmit = async (data: ContactFormData) => {
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const res = await sendContact(data);
      if (res.success) {
        setSubmitSuccess(res.message || "Your message has been sent successfully. We'll get back to you soon.");
        reset();
      } else {
        setSubmitError(res.message || 'Unable to send your message right now. Please try again later.');
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } }; message?: string };
      const serverMsg = axiosErr?.response?.data?.message;
      // Don't expose raw backend errors — show friendly fallback
      if (serverMsg && typeof serverMsg === 'string' && serverMsg.length < 200) {
        // Allow friendly validation messages, otherwise map to generic
        if (serverMsg.includes('Too many')) {
          setSubmitError(serverMsg);
        } else if (axiosErr?.response?.data?.errors) {
          setSubmitError('Please check your input and try again.');
        } else {
          setSubmitError('Unable to send your message right now. Please try again later.');
        }
      } else {
        setSubmitError('Unable to send your message right now. Please try again later.');
      }
    }
  };

  const handleNavClick = (href: string, isRoute: boolean, e: React.MouseEvent) => {
    if (isRoute) {
      // Let react-router handle /contact etc. Avoid reload if already on that route.
      return;
    }
    // Hash links: if on contact page, navigate to / + hash
    e.preventDefault();
    if (href.startsWith('/#')) {
      navigate('/');
      setTimeout(() => {
        const id = href.replace('/#', '');
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    }
    setMobileOpen(false);
  };

  return (
    <div className="landing-theme relative min-h-screen overflow-x-hidden bg-background font-sans text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-gradient-to-b from-blue-50/70 via-white to-white" />
      <div className="pointer-events-none absolute -left-40 top-24 -z-10 h-96 w-96 rounded-full bg-orange-100/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-56 -z-10 h-96 w-96 rounded-full bg-blue-100/60 blur-3xl" />

      {/* Header — same styling as LandingPage, with Contact active + mobile menu */}
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
        <div
          className={cn(
            'mx-auto flex h-12 max-w-6xl items-center gap-3 rounded-full border border-[#e6edf3] bg-white/85 px-3 pl-4 backdrop-blur-xl transition-shadow duration-300 sm:px-4',
            scrolled ? 'shadow-[0_16px_40px_-16px_rgba(11,37,69,0.22)]' : 'shadow-[0_1px_2px_rgba(16,24,40,0.04)]'
          )}
        >
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              navigate('/');
            }}
            className="flex items-center gap-2.5"
            aria-label="Enterprise Intelligence Platform home"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ff6b00] shadow-[0_8px_16px_-8px_rgba(255,107,0,0.7)]">
              <Network className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="hidden text-[15px] font-bold tracking-tight text-[#0b2545] sm:block">Enterprise Intelligence</span>
            <span className="text-[15px] font-bold tracking-tight text-[#0b2545] sm:hidden">EIP</span>
          </button>

          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Site">
            {NAV_LINKS.map(([href, label, isRoute]) =>
              isRoute ? (
                <Link
                  key={href}
                  to={href}
                  aria-current={location.pathname === href ? 'page' : undefined}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                    location.pathname === href
                      ? 'bg-orange-50 text-[#ff6b00]'
                      : 'text-[#52637a] hover:bg-orange-50 hover:text-[#0b2545]'
                  )}
                >
                  {label}
                </Link>
              ) : (
                <a
                  key={href}
                  href={href}
                  onClick={(e) => handleNavClick(href, false, e)}
                  className="rounded-full px-3 py-1.5 text-[13px] font-medium text-[#52637a] transition-colors hover:bg-orange-50 hover:text-[#0b2545]"
                >
                  {label}
                </a>
              )
            )}
          </nav>

          <div className="flex-1" />

          {isAuthenticated ? (
            <Button size="sm" onClick={() => navigate('/dashboard')} className="hidden sm:inline-flex">
              Open workspace <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="hidden sm:inline-flex">
                Login
              </Button>
              <Button size="sm" onClick={() => navigate('/register')} className="hidden sm:inline-flex">
                Sign Up <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e6edf3] bg-white text-[#0b2545] shadow-sm lg:hidden"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="mx-auto mt-2 max-w-6xl rounded-2xl border border-[#e6edf3] bg-white p-2 shadow-[0_16px_40px_-16px_rgba(11,37,69,0.22)] lg:hidden">
            <nav className="flex flex-col gap-1 p-1" aria-label="Mobile">
              {NAV_LINKS.map(([href, label, isRoute]) =>
                isRoute ? (
                  <Link
                    key={href}
                    to={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors',
                      location.pathname === href ? 'bg-orange-50 text-[#ff6b00]' : 'text-[#0b2545] hover:bg-orange-50'
                    )}
                  >
                    {label}
                  </Link>
                ) : (
                  <a
                    key={href}
                    href={href}
                    onClick={(e) => handleNavClick(href, false, e)}
                    className="rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#0b2545] hover:bg-orange-50"
                  >
                    {label}
                  </a>
                )
              )}
              <div className="my-1 border-t border-[#eef2f6]" />
              {isAuthenticated ? (
                <Button onClick={() => navigate('/dashboard')} className="w-full justify-center">
                  Open workspace <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate('/login')} className="flex-1">
                    Login
                  </Button>
                  <Button onClick={() => navigate('/register')} className="flex-1">
                    Sign Up <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff6b00]">
            <span className="h-1 w-1 rounded-full bg-[#ff6b00]" />
            Contact us
            <span className="h-1 w-1 rounded-full bg-[#ff6b00]" />
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.02em] text-[#0b2545] sm:text-4xl">
            We&apos;d love to hear from you
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[#52637a]">
            Questions, feedback, or need help getting started? Send us a message and our team will get back to you shortly.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-5">
          {/* Info card */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-[#e6edf3] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-7">
              <h2 className="text-[16px] font-bold tracking-tight text-[#0b2545]">Get in touch</h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#52637a]">
                Fill out the form and our team will respond within one business day. For urgent matters, use the details below.
              </p>
              <div className="mt-6 space-y-4">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#ff6b00]">
                    <Mail className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a99ac]">Email</p>
                    <a href="mailto:support@enterprise-intelligence.com" className="text-[13.5px] font-medium text-[#0b2545] hover:text-[#ff6b00]">
                      support@enterprise-intelligence.com
                    </a>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Clock className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a99ac]">Response time</p>
                    <p className="text-[13.5px] text-[#0b2545]">Within 24 hours on business days</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 rounded-xl bg-gradient-to-br from-[#0b2545] to-[#123a6b] p-4 text-white">
                <p className="text-[13px] font-semibold">Already have an account?</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-blue-100/80">
                  Sign in to access your workspace, dashboards, and support history.
                </p>
                <Button
                  size="sm"
                  className="mt-3 bg-[#ff6b00] hover:bg-[#e85f00] w-full"
                  onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
                >
                  {isAuthenticated ? 'Go to workspace' : 'Login'} <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Form card */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-[#e6edf3] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-7">
              <h2 className="text-[16px] font-bold tracking-tight text-[#0b2545]">Send us a message</h2>
              <p className="mt-1 text-[13px] text-[#6b7d94]">All fields are required. We&apos;ll never share your email with anyone else.</p>

              {submitSuccess && (
                <div
                  role="status"
                  className="mt-5 flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <p className="text-[13.5px] leading-relaxed text-emerald-800">{submitSuccess}</p>
                </div>
              )}
              {submitError && (
                <div role="alert" className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <p className="text-[13.5px] leading-relaxed text-red-700">{submitError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name" error={errors.name?.message}>
                    <Label htmlFor="contact-name" className="sr-only">
                      Name
                    </Label>
                    <Input
                      id="contact-name"
                      autoComplete="name"
                      placeholder="Your full name"
                      {...register('name')}
                      aria-invalid={!!errors.name}
                      className={cn(errors.name && 'border-red-300 focus-visible:ring-red-200')}
                    />
                  </Field>
                  <Field label="Email" error={errors.email?.message}>
                    <Label htmlFor="contact-email" className="sr-only">
                      Email
                    </Label>
                    <Input
                      id="contact-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      {...register('email')}
                      aria-invalid={!!errors.email}
                      className={cn(errors.email && 'border-red-300 focus-visible:ring-red-200')}
                    />
                  </Field>
                </div>

                <Field label="Subject" error={errors.subject?.message}>
                  <Label htmlFor="contact-subject" className="sr-only">
                    Subject
                  </Label>
                  <Input
                    id="contact-subject"
                    placeholder="How can we help?"
                    {...register('subject')}
                    aria-invalid={!!errors.subject}
                    className={cn(errors.subject && 'border-red-300 focus-visible:ring-red-200')}
                  />
                </Field>

                <Field label="Message" error={errors.message?.message}>
                  <Label htmlFor="contact-message" className="sr-only">
                    Message
                  </Label>
                  <Textarea
                    id="contact-message"
                    placeholder="Tell us more about your inquiry..."
                    rows={6}
                    {...register('message')}
                    aria-invalid={!!errors.message}
                    className={cn('min-h-[140px]', errors.message && 'border-red-300 focus-visible:ring-red-200')}
                  />
                  <p className="mt-1 text-right text-[11px] text-[#8a99ac]">{/* hint */}</p>
                </Field>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-11 w-full rounded-xl text-[14px] font-semibold shadow-[0_10px_20px_-12px_rgba(255,107,0,0.9)]"
                >
                  {isSubmitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send Message
                    </>
                  )}
                </Button>
                <p className="text-center text-[11.5px] text-[#8a99ac]">
                  By sending, you agree to our terms and privacy policy. We typically reply within 24 hours.
                </p>
              </form>
            </div>
          </div>
        </div>
      </main>

      {/* Footer — same as LandingPage */}
      <footer className="border-t border-[#eef2f6] bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff6b00]">
                  <Network className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="block text-[14px] font-bold tracking-tight text-[#0b2545]">Enterprise Intelligence</span>
                  <span className="block text-[10.5px] text-[#718096]">Data-Driven Decisions</span>
                </div>
              </div>
              <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-[#6b7d94]">
                Powerful analytics and real-time insights to help you grow, optimize, and lead — everything backed by evidence.
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b2545]">Platform</p>
              <nav className="mt-3 flex flex-col items-start gap-2 text-[13px] text-[#52637a]" aria-label="Platform">
                <button onClick={() => navigate('/dashboard')} className="transition-colors hover:text-[#ff6b00]">
                  Home Dashboard
                </button>
                <button onClick={() => navigate('/business-intelligence')} className="transition-colors hover:text-[#ff6b00]">
                  Business Intelligence
                </button>
                <button onClick={() => navigate('/analytics')} className="transition-colors hover:text-[#ff6b00]">
                  Analytics
                </button>
                <button onClick={() => navigate('/reports')} className="transition-colors hover:text-[#ff6b00]">
                  Reports
                </button>
              </nav>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0b2545]">Resources</p>
              <nav className="mt-3 flex flex-col items-start gap-2 text-[13px] text-[#52637a]" aria-label="Resources">
                <button onClick={() => navigate('/documents')} className="transition-colors hover:text-[#ff6b00]">
                  Data Sources
                </button>
                <button onClick={() => navigate('/chat')} className="transition-colors hover:text-[#ff6b00]">
                  AI Insights
                </button>
                <button onClick={() => navigate('/contact')} className="font-semibold text-[#ff6b00]">
                  Contact
                </button>
              </nav>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-[#eef2f6] pt-6 sm:flex-row">
            <p className="text-[11.5px] text-[#8a99ac]">© {new Date().getFullYear()} Enterprise Intelligence Platform. Built for teams that move fast.</p>
            <div className="flex items-center gap-4 text-[11.5px] text-[#8a99ac]">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Enterprise secure
              </span>
              <span className="flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5 text-blue-500" /> 99.9% uptime
              </span>
              <span className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-orange-500" /> Support
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
