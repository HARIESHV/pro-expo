import { Router } from 'express';
import { reportController } from '../controllers/reportController';
import { authenticate, requirePermission } from '../middleware/auth';
import { auditMiddleware } from '../middleware/audit';

const router = Router();

router.use(authenticate);

// Primary generate and get endpoints
router.post('/generate', requirePermission('reports.generate'), auditMiddleware('generate_report', 'reports'), reportController.generateReport);
router.post('/', requirePermission('reports.generate'), auditMiddleware('generate_report', 'reports'), reportController.generateReport);
router.get('/', requirePermission('reports.view'), reportController.getReports);
router.get('/:id', requirePermission('reports.view'), reportController.getReport);
router.delete('/:id', requirePermission('reports.delete'), auditMiddleware('delete_report', 'reports'), reportController.deleteReport);
router.post('/:id/export', requirePermission('reports.export'), auditMiddleware('export_report', 'reports'), reportController.exportReport);

// Direct regeneration and dedicated file downloads
router.post('/:id/regenerate', requirePermission('reports.generate'), auditMiddleware('regenerate_report', 'reports'), reportController.regenerateReport);
router.get('/:id/pdf', requirePermission('reports.export'), auditMiddleware('export_report', 'reports'), reportController.exportPdf);
router.get('/:id/excel', requirePermission('reports.export'), auditMiddleware('export_report', 'reports'), reportController.exportExcel);
router.get('/:id/docx', requirePermission('reports.export'), auditMiddleware('export_report', 'reports'), reportController.exportDocx);
router.get('/:id/csv', requirePermission('reports.export'), auditMiddleware('export_report', 'reports'), reportController.exportCsv);

export default router;
