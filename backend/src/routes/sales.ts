import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { salesController } from '../controllers/salesController';

const router = Router();

router.use(authenticate);

// GET /api/sales — paginated, filterable sales records
router.get('/', salesController.list);

// GET /api/sales/summary — revenue + deal aggregates
router.get('/summary', salesController.summary);

export default router;