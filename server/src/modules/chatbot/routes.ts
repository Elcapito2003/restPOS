import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as ctrl from './controller';

const router = Router();

router.use(authenticate);

router.post('/message', ctrl.sendMessage);
router.get('/history', ctrl.getHistory);
router.delete('/memory', ctrl.clearMemory);

export default router;
