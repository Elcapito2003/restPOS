import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { createPresetSchema, updatePresetSchema } from './schema';
import * as ctrl from './controller';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.getAll);
router.post('/', authorize('admin', 'manager'), validate(createPresetSchema), ctrl.create);
router.put('/:id', authorize('admin', 'manager'), validate(updatePresetSchema), ctrl.update);
router.delete('/:id', authorize('admin', 'manager'), ctrl.deactivate);

export default router;
