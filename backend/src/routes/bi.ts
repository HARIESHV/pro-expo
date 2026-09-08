import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { businessIntelligenceController as bi } from '../controllers/businessIntelligenceController';

const router = Router();

router.use(authenticate);

router.get('/profile', bi.getProfile);
router.get('/validation', bi.getValidation);
router.get('/summary', bi.getSummary);
router.get('/revenue', bi.getRevenue);
router.get('/sales', bi.getSales);
router.get('/customers', bi.getCustomers);
router.get('/finance', bi.getFinance);
router.get('/operations', bi.getOperations);
router.get('/past', bi.getPast);
router.get('/present', bi.getPresent);
router.get('/future', bi.getFuture);
router.get('/forecast', bi.getForecast);
router.get('/anomalies', bi.getAnomalies);
router.get('/comparison', bi.getComparison);
router.get('/analysis', bi.getAnalysis);
router.get('/recommendations', bi.getRecommendations);

export default router;