import { Router } from 'express';
import { authenticate, requireRoles } from '../middleware/auth';
import { adminReportController } from '../controllers/adminReportController';

const router = Router();

router.use(authenticate, requireRoles('admin','super_admin'));

router.get('/overview', adminReportController.overview);
router.get('/list', adminReportController.list);
router.get('/text-preview/:id', adminReportController.textPreview);
router.get('/:id', adminReportController.getOne);
router.post('/:id/approve', adminReportController.approve);
router.post('/:id/reject', adminReportController.reject);
router.get('/:id/download', adminReportController.download);
router.get('/:id/preview', adminReportController.preview);

export default router;
