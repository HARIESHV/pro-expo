import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { auditMiddleware } from '../middleware/audit';
import { validate, registerSchema, loginSchema } from '../middleware/validate';

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

router.post('/refresh', authController.refresh);
router.post('/logout', authenticate, auditMiddleware('logout', 'auth'), authController.logout);
router.get('/me', authenticate, authController.me);

export default router;