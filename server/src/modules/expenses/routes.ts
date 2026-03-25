import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { expenseTypeSchema, expenseSchema } from './schema';
import * as ctrl from './controller';

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'manager', 'cashier'));
router.get('/types', ctrl.getTypes);
router.post('/types', validate(expenseTypeSchema), ctrl.createType);
router.get('/', ctrl.getExpenses);
router.get('/summary', ctrl.getSummary);
router.post('/', validate(expenseSchema), ctrl.create);

export default router;
