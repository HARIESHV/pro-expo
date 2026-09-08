import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { customerController } from '../controllers/customerController';

const router = Router();

router.use(authenticate);

// GET /api/customers — paginated, filterable customer records
router.get('/', customerController.list);

// GET /api/customers/summary — customer counts by status
router.get('/summary', customerController.summary);

export default router;