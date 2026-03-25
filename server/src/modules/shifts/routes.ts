import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { openShiftSchema } from './schema';
import * as ctrl from './controller';

const router = Router();
router.use(authenticate);
router.get('/', ctrl.getOpen);
router.get('/mine', ctrl.getMine);
router.get('/history', ctrl.getHistory);
router.post('/open', validate(openShiftSchema), ctrl.open);
router.post('/close', ctrl.close);

export default router;
