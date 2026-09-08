import { Router } from 'express';
import { searchController } from '../controllers/searchController';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('universal_search'), searchController.universalSearch);

export default router;
