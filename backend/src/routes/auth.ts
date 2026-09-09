import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { auditMiddleware } from '../middleware/audit';
import { validate, registerSchema, loginSchema, sendOtpSchema, verifyOtpSchema } from '../middleware/validate';

const router = Router();

router.post(
  '/register',
  validate(registerSchema, 'Invalid registration data'),
  auditMiddleware('register', 'auth'),
  authController.register
);
router.post(
  '/login',
  validate(loginSchema, 'Invalid login data'),
  auditMiddleware('login', 'auth'),
  authController.login
);

// Gmail OTP sign-in (user authentication only — SMTP is never used for admins,
// Resend stays exclusive to the Contact page).
router.post(
  '/send-otp',
  validate(sendOtpSchema, 'Invalid sign-in request'),
  auditMiddleware('send_otp', 'auth'),
  authController.sendOtp
);
router.post(
  '/verify-otp',
  validate(verifyOtpSchema, 'Invalid OTP verification request'),
  auditMiddleware('verify_otp', 'auth'),
  authController.verifyOtp
);

router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, auditMiddleware('logout', 'auth'), authController.logout);
router.get('/me', authenticate, authController.me);

export default router;