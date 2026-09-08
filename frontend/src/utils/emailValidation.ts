/**
 * Validates if the given email belongs to the allowed company domain.
 * This is a frontend check for UX. The backend will enforce this strictly.
 * @param email The email address to validate.
 * @returns boolean True if the email belongs to the allowed domain, false otherwise.
 */
export function isAllowedCompanyEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const trimmedEmail = email.trim().toLowerCase();
  
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
    return false;
  }

  const parts = trimmedEmail.split('@');
  if (parts.length !== 2) {
    return false;
  }

  const domain = parts[1];
  // Normally driven by env in frontend as well, but defaulting to company.com per requirements
  const allowedDomain = import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || 'company.com';
  
  return domain === allowedDomain;
}
