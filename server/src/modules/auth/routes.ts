import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimiter';
import { loginSchema, pinLoginSchema } from './schema';
import * as ctrl from './controller';

const router = Router();

router.get('/users', ctrl.getUsers);
router.post('/login', authLimiter, validate(loginSchema), ctrl.login);
router.post('/pin-login', authLimiter, validate(pinLoginSchema), ctrl.pinLogin);
router.post('/verify-pin', authLimiter, validate(pinLoginSchema), ctrl.verifyPin);
router.get('/me', authenticate, ctrl.me);

export default router;
