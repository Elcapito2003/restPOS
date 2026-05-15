import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import * as ctrl from './controller';

const router = Router();
router.use(authenticate);

// Diagnóstico del server (admin/manager).
router.get('/', authorize('admin', 'manager'), ctrl.getDiagnostics);
router.get('/client-errors', authorize('admin', 'manager'), ctrl.getClientErrors);

// Reporte de problema desde cliente (cualquier usuario logueado puede reportar).
router.post('/report', ctrl.reportProblem);

export default router;
