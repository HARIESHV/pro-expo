import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/dashboard', analyticsController.getDashboardMetrics);
router.get('/sales-trend', analyticsController.getSalesTrend);
router.get('/customers', analyticsController.getCustomerAnalytics);

export default router;
