import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { paymentSchema, splitPaymentSchema } from './schema';
import * as ctrl from './controller';

const router = Router();

router.use(authenticate);
router.post('/', authorize('admin', 'manager', 'cashier'), validate(paymentSchema), ctrl.processPayment);
router.post('/split', authorize('admin', 'manager', 'cashier'), validate(splitPaymentSchema), ctrl.processSplitPayment);
router.get('/order/:orderId', ctrl.getByOrder);
router.delete('/:id', authorize('admin', 'manager'), ctrl.voidPayment);

export default router;
