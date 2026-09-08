import { Router } from 'express';
import { queryController } from '../controllers/queryController';
import { authenticate } from '../middleware/auth';
import { auditMiddleware } from '../middleware/audit';

const router = Router();

router.use(authenticate);

router.get('/', queryController.getQueries);
router.get('/:id', queryController.getQuery);
router.delete('/:id', auditMiddleware('delete_query', 'queries'), queryController.deleteQuery);

export default router;
