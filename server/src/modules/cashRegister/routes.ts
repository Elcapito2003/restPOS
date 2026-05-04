import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { openRegisterSchema, closeRegisterSchema, movementSchema } from './schema';
import * as ctrl from './controller';

const router = Router();

router.use(authenticate);
router.get('/current', ctrl.getCurrent);
router.get('/history', authorize('admin', 'manager'), ctrl.getHistory);
router.get('/corte-x', authorize('admin', 'manager', 'cashier'), ctrl.corteX);
router.post('/corte-z', authorize('admin', 'manager'), ctrl.corteZ);
router.post('/open', authorize('admin', 'manager', 'cashier'), validate(openRegisterSchema), ctrl.open);
router.post('/close', authorize('admin', 'manager', 'cashier'), validate(closeRegisterSchema), ctrl.close);
router.post('/movement', authorize('admin', 'manager', 'cashier'), validate(movementSchema), ctrl.addMovement);
router.get('/tips/pending', authorize('admin', 'manager', 'cashier'), ctrl.getPendingTips);
router.post('/tips/pay', authorize('admin', 'manager', 'cashier'), ctrl.payTip);

export default router;
