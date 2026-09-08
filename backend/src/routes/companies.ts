import { Router } from 'express';
import { companyController } from '../controllers/companyController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// Read-only universal company knowledge endpooints (search / resolve / get).
router.get('/search', companyController.search);
router.get('/resolve', companyController.resolve);
router.get('/:id', companyController.getById);

export default router;