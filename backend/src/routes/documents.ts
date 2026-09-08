import { Router } from 'express';
import { documentController } from '../controllers/documentController';
import { authenticate } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { auditMiddleware } from '../middleware/audit';

const router = Router();

router.use(authenticate);

router.post('/', upload.single('file'), auditMiddleware('upload', 'documents'), documentController.uploadDocument);
router.get('/', documentController.getDocuments);
router.get('/:id', documentController.getDocument);
router.delete('/:id', auditMiddleware('delete', 'documents'), documentController.deleteDocument);
router.post('/:id/reprocess', documentController.reprocessDocument);

export default router;
