import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import * as ctrl from './controller';

const router = Router();

router.use(authenticate);
router.use(authorize('admin', 'manager', 'cashier'));

// Reports
router.get('/daily', ctrl.daily);
router.get('/period', ctrl.byPeriod);
router.get('/waiter', ctrl.byWaiter);
router.get('/category', ctrl.byCategory);
router.get('/product', ctrl.byProduct);
router.get('/hourly', ctrl.byHour);
router.get('/cancellations', ctrl.cancellations);
router.get('/discounts', ctrl.discounts);

// Consultas
router.get('/open-checks', ctrl.openChecks);
router.get('/paid-checks', ctrl.paidChecks);
router.get('/cancelled-checks', ctrl.cancelledChecks);

export default router;
