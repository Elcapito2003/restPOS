import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import * as ctrl from './controller';

const router = Router();
router.use(authenticate);

// Disponible para todos los autenticados — el reloj checador necesita poder
// leer la lista de huellas y marcar entrada/salida.
router.get('/roster', ctrl.getRoster);
router.post('/punch', ctrl.punch);

// Listado y reportes: sólo admin/super_admin (manager también para nómina).
router.get('/', authorize('admin', 'manager'), ctrl.list);
router.get('/summary', authorize('admin', 'manager'), ctrl.summary);
router.get('/export', authorize('admin', 'manager'), ctrl.exportCsv);

export default router;
