import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Field } from '../../components/ui/field';
import { Input } from '../../components/ui/input';

// Demo: org ID would normally come from org lookup
const DEMO_ORG_ID = '000000000000000000000001';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateForm(form: { firstName: string; lastName: string; email: string; password: string; confirmPassword: string }): string | null {
  if (!form.firstName.trim()) return 'First name is required';
  if (!form.lastName.trim()) return 'Last name is required';
  if (!form.email.trim()) return 'Email address is required';
  if (!EMAIL_REGEX.test(form.email.trim())) return 'Please enter a valid email address';
  if (!form.password) return 'Password is required';
  if (form.password.length < 8) return 'Password must be at least 8 characters';
  if (form.password !== form.confirmPassword) return 'Passwords do not match';
  return null;
}

function getApiErrorMessage(err: unknown): string {
  const e = err as {
    response?: { status?: number; data?: { message?: string } };
    request?: unknown;
    message?: string;
  };

  const backendMessage = e?.response?.data?.message;
  if (backendMessage && typeof backendMessage === 'string') return backendMessage;

  if (e?.response) {
    switch (e.response.status) {
      case 400:
        return 'Invalid registration data. Please check your details and try again.';
      case 409:
        return 'An account with this email already exists.';
      case 422:
        return 'Validation failed. Please check your details and try again.';
      case 503:
        return 'Service temporarily unavailable. Please try again shortly.';
      default:
        return 'Something went wrong on our side. Please try again later.';
    }
  }

  if (e?.request) return 'Unable to reach the server. Check your connection and try again.';

  return 'Registration failed. Please try again.';
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', organizationId: DEMO_ORG_ID });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const validationError = validateForm(form);
    if (validationError) {
      setError(validationError);
      setSuccess('');
      return;
    }

    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        organizationId: form.organizationId,
      });
      setSuccess('Account created — taking you to your dashboard');
      setTimeout(() => navigate('/dashboard'), 900);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-strong animate-fade-in-up relative overflow-hidden rounded-3xl p-7 shadow-pop sm:p-8">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-[60px]" />
      <div className="relative">
      <div className="mb-8">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Create your account</h2>
        <p className="mt-1 text-sm text-muted-foreground">Start using the workspace in under a minute</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" id="register-form">
        <div className="grid grid-cols-2 gap-3">
          {(['firstName', 'lastName'] as const).map((field) => (
            <Field key={field} label={field === 'firstName' ? 'First name' : 'Last name'}>
              <Input
                id={field}
                name={field}
                type="text"
                value={form[field]}
                onChange={handleChange}
                required
                autoComplete={field === 'firstName' ? 'given-name' : 'family-name'}
                placeholder={field === 'firstName' ? 'John' : 'Doe'}
              />
            </Field>
          ))}
        </div>

        <Field label="Email address" hint="Use your work email for the best results">
          <Input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            required
            autoComplete="email"
            placeholder="you@company.com"
          />
        </Field>

        <Field label="Password" hint="At least 8 characters">
          <Input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            required
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </Field>

        <Field label="Confirm password">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            autoComplete="new-password"
            placeholder="••••••••"
          />
        </Field>

        {error && (
          <div role="alert" className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {success && (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-success/25 bg-success/10 px-3 py-2 text-xs text-success">
            <CheckCircle2 className="h-4 w-4" /> {success}
          </div>
        )}

        <Button id="register-submit" type="submit" className="w-full" size="lg" disabled={isLoading}>
          {isLoading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              Creating account…
            </>
          ) : (
            <>
              Create account <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
      </div>
    </div>
  );
}