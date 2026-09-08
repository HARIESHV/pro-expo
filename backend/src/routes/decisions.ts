import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { decisionController } from '../controllers/decisionController';

const router = Router();

router.use(authenticate);

router.get('/insights', decisionController.insights);
router.get('/', decisionController.list);
router.post('/', decisionController.create);
router.post('/evaluate', decisionController.evaluate);
router.post('/recommendations', decisionController.recommendations);
router.get('/:id', decisionController.getOne);
router.put('/:id', decisionController.update);
router.delete('/:id', decisionController.remove);

export default router;