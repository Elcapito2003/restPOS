import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { createUserSchema, updateUserSchema } from './schema';
import * as ctrl from './controller';

const router = Router();

router.use(authenticate);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', authorize('admin'), validate(createUserSchema), ctrl.create);
router.put('/:id', authorize('admin'), validate(updateUserSchema), ctrl.update);
router.delete('/:id', authorize('admin'), ctrl.remove);

export default router;
