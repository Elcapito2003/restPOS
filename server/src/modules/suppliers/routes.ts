import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { supplierSchema, supplierUpdateSchema } from './schema';
import * as ctrl from './controller';

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'manager'));

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', validate(supplierSchema), ctrl.create);
router.put('/:id', validate(supplierUpdateSchema), ctrl.update);
router.delete('/:id', ctrl.remove);
router.get('/:id/items', ctrl.getSupplierItems);

export default router;
