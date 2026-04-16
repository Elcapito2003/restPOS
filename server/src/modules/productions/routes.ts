import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { productionSchema, executeSchema } from './schema';
import * as ctrl from './controller';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/logs', ctrl.getLogs);
router.get('/:id', ctrl.getById);
router.post('/', authorize('admin', 'manager'), validate(productionSchema), ctrl.create);
router.put('/:id', authorize('admin', 'manager'), ctrl.update);
router.delete('/:id', authorize('admin', 'manager'), ctrl.remove);
router.post('/:id/execute', authorize('admin', 'manager'), validate(executeSchema), ctrl.execute);

export default router;
