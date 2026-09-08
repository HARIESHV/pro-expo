import { Router } from 'express';
import { riskController } from '../controllers/riskController';
import { authenticate } from '../middleware/auth';
import { auditMiddleware } from '../middleware/audit';

const router = Router();

router.use(authenticate);

router.get('/', riskController.getRisks);
router.get('/summary', riskController.getRiskSummary);
router.post('/recalculate', auditMiddleware('recalculate_risks', 'risks'), riskController.recalculate);
router.get('/report', riskController.getRiskReport);
router.put('/:id', auditMiddleware('update_risk', 'risks'), riskController.updateRisk);
router.delete('/:id', auditMiddleware('delete_risk', 'risks'), riskController.deleteRisk);

export default router;
