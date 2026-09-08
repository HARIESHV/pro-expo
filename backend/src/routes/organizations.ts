import { Router } from 'express';
import { organizationController } from '../controllers/organizationController';
import { authenticate, requirePermission } from '../middleware/auth';
import { auditMiddleware } from '../middleware/audit';

const router = Router();

router.use(authenticate);

router.get('/current', requirePermission('users.manage'), organizationController.getCurrentOrganization);
router.get('/current/members', requirePermission('users.manage'), organizationController.getOrganizationMembers);
router.put('/current/settings', requirePermission('users.manage'), auditMiddleware('update_organization_settings', 'organizations'), organizationController.updateOrganizationSettings);

export default router;
