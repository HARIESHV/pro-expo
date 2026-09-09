import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { reportUpload } from '../middleware/reportUpload';
import { employeeReportController } from '../controllers/employeeReportController';

const router = Router();

router.use(authenticate);

router.post('/submit', reportUpload.single('file'), employeeReportController.submit);
router.get('/my', employeeReportController.myReports);
router.get('/:id', employeeReportController.getOne);
router.get('/:id/download', employeeReportController.download);
router.get('/:id/preview', employeeReportController.preview);

export default router;
