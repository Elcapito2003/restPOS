import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { createOrderSchema, sendMessageSchema, incomingWebhookSchema } from './schema';
import * as ctrl from './controller';

const router = Router();

// Webhook from OpenClaw — secured by token
router.post('/webhook/incoming', (req, res, next) => {
  const token = req.headers['x-agent-key'] || req.query.key;
  if (token !== require('../../config/env').env.openclawToken) return res.status(403).json({ error: 'Forbidden' });
  next();
}, validate(incomingWebhookSchema), ctrl.incomingWebhook);

// OpenClaw status (any authenticated user)
router.get('/openclaw-status', authenticate, ctrl.openclawStatus);

// All other routes: admin/manager only
router.use(authenticate);
router.use(authorize('admin', 'manager'));

router.get('/orders', ctrl.getOrders);
router.get('/orders/:id', ctrl.getOrderById);
router.post('/orders', validate(createOrderSchema), ctrl.createOrder);
router.patch('/orders/:id/status', ctrl.updateStatus);
router.delete('/orders/:id', ctrl.cancelOrder);

router.get('/orders/:id/messages', ctrl.getMessages);
router.post('/orders/:id/send', ctrl.sendOrderMessage);
router.post('/orders/:id/message', validate(sendMessageSchema), ctrl.sendMessage);

router.get('/conversation/:supplierId', ctrl.getConversation);

// Reception & Payment
router.get('/reception', ctrl.getOrdersForReception);
router.get('/reception/pending-payment', ctrl.getOrdersPendingPayment);
router.get('/reception/history', ctrl.getOrdersHistory);
router.post('/orders/:id/receive', ctrl.receiveOrder);
router.post('/orders/:id/pay', ctrl.payOrder);

export default router;
