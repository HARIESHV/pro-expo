import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { ragController } from '../controllers/ragController';

const router = Router();

router.use(authenticate);

// GET /api/rag/search?q=...&limit=...&departments=a,b — hybrid retrieval + sources
router.get('/search', ragController.hybridSearch);

// POST /api/rag/query { query } — evidence-backed answer + sources
router.post('/query', ragController.query);

export default router;