import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { recipeSchema } from './schema';
import * as ctrl from './controller';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/:productId', ctrl.getRecipe);
router.put('/:productId', authorize('admin', 'manager'), validate(recipeSchema), ctrl.setRecipe);

export default router;
