import { Router } from 'express';
import { knowledgeGraphController } from '../controllers/knowledgeGraphController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', knowledgeGraphController.getGraph);
router.get('/breakdown', knowledgeGraphController.getGraphBreakdown);
router.get('/search', knowledgeGraphController.searchEntities);
router.get('/entity/:id', knowledgeGraphController.getEntityNeighbors);
router.get('/evaluate', knowledgeGraphController.evaluateGraph);

export default router;
