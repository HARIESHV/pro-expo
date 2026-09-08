import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { businessIntelligenceController } from '../controllers/businessIntelligenceController';

const router = Router();

router.use(authenticate);

// Legacy org-level BI overview (vertex metrics over internal sales records).
router.get('/overview', businessIntelligenceController.getOverview);

// Real-world company analysis: Long Company vs Short Company workflow.
router.post('/analyze', businessIntelligenceController.analyze);
router.post('/refresh', businessIntelligenceController.refresh);
router.get('/latest', businessIntelligenceController.getLatest);

export default router;
