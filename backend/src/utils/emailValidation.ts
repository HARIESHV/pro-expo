import { env } from '../config/env';

/**
 * Validates if the given email belongs to the allowed company domain.
 * @param email The email address to validate.
 * @returns boolean True if the email belongs to the allowed domain, false otherwise.
 */
export function isAllowedCompanyEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const trimmedEmail = email.trim().toLowerCase();
  
  // Basic email format check before extracting domain
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
    return false;
  }

  const parts = trimmedEmail.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const domain = parts[1];
  return domain === env.ALLOWED_EMAIL_DOMAIN;
}
