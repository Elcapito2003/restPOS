import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { clientSchema } from './schema';
import * as ctrl from './controller';

const router = Router();
router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/search', ctrl.search);
router.get('/:id', ctrl.getById);
router.post('/', authorize('admin', 'manager', 'cashier'), validate(clientSchema), ctrl.create);
router.put('/:id', authorize('admin', 'manager', 'cashier'), validate(clientSchema.partial()), ctrl.update);
router.delete('/:id', authorize('admin', 'manager'), ctrl.remove);

export default router;
