import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { businessIntelligenceController } from '../controllers/businessIntelligenceController';

const router = Router();

router.use(authenticate);

router.get('/overview', businessIntelligenceController.getOverview);

export default router;
