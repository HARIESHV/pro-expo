import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { isAllowedCompanyEmail } from '../utils/emailValidation';

export const registerSchema = z.object({
  firstName: z
    .string({ required_error: 'First name is required', invalid_type_error: 'First name must be text' })
    .trim()
    .min(1, 'First name is required')
    .max(50, 'First name must be at most 50 characters'),
  lastName: z
    .string({ required_error: 'Last name is required', invalid_type_error: 'Last name must be text' })
    .trim()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be at most 50 characters'),
  email: z
    .string({ required_error: 'Email address is required', invalid_type_error: 'Email address must be text' })
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address')
    .max(254, 'Email address is too long')
    .refine(isAllowedCompanyEmail, 'Only company.com email addresses are allowed.'),
  password: z
    .string({ required_error: 'Password is required', invalid_type_error: 'Password must be text' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  organizationId: z.string().trim().min(1).optional(),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email address is required' })
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address')
    .refine(isAllowedCompanyEmail, 'Only company.com email addresses are allowed.'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export function validate(schema: z.ZodObject<z.ZodRawShape>, message = 'Invalid request data') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors: Record<string, string[]> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_';
        if (!errors[key]) errors[key] = [];
        errors[key].push(issue.message);
      }
      res.status(400).json({
        success: false,
        message,
        code: 'VALIDATION_ERROR',
        errors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
