import { Router } from 'express';
import { authenticate, requireRoles } from '../middleware/auth';
import { adminMemberController } from '../controllers/adminMemberController';

const router = Router();

router.use(authenticate, requireRoles('admin','super_admin'));

router.get('/stats', adminMemberController.stats);
router.get('/list', adminMemberController.list);

export default router;
