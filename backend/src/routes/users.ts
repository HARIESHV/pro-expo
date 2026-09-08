import { Router } from 'express';
import { userController } from '../controllers/userController';
import { authenticate, requireRoles } from '../middleware/auth';
import { auditMiddleware } from '../middleware/audit';

const router = Router();

router.use(authenticate);

router.get('/', requireRoles('super_admin', 'hr'), userController.getUsers);
router.get('/:id', userController.getUser);
router.put('/:id', requireRoles('super_admin'), auditMiddleware('update', 'users'), userController.updateUser);
router.delete('/:id', requireRoles('super_admin'), auditMiddleware('deactivate', 'users'), userController.deleteUser);

export default router;
