import { Router } from 'express';
import { auditController } from '../controllers/auditController';
import { authenticate, requireRoles } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRoles('super_admin'));
router.get('/', auditController.getLogs);

export default router;
