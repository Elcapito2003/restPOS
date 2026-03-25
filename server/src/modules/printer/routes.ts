import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import * as ctrl from './controller';

const router = Router();

router.use(authenticate);
router.get('/status', ctrl.status);
router.post('/test/:target', ctrl.test);
router.post('/comanda/:orderId', ctrl.printComanda);
router.post('/receipt/:orderId', ctrl.printReceipt);

export default router;
