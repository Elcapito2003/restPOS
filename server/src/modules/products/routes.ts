import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { productSchema } from './schema';
import * as ctrl from './controller';

const router = Router();

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', authorize('admin', 'manager'), validate(productSchema), ctrl.create);
router.put('/:id', authorize('admin', 'manager'), validate(productSchema.partial()), ctrl.update);
router.delete('/:id', authorize('admin', 'manager'), ctrl.remove);

export default router;
