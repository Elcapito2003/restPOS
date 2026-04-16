import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import * as ctrl from './controller';

const router = Router();
router.use(authenticate);
router.use(authorize('admin', 'manager'));

router.get('/auth-url', ctrl.getAuthUrl);
router.post('/auth', ctrl.exchangeCode);
router.get('/status', ctrl.getStatus);
router.get('/search', ctrl.search);
router.get('/products/:id', ctrl.getProduct);
router.post('/orders', ctrl.createOrder);
router.get('/orders', ctrl.getOrders);
router.get('/orders/:id', ctrl.getOrderDetail);

// Browser automation
router.get('/browser/status', ctrl.browserStatus);
router.post('/browser/login', ctrl.browserLogin);
router.get('/browser/search', ctrl.browserSearch);
router.post('/browser/buy', ctrl.browserBuy);
router.post('/browser/add-to-cart', ctrl.browserAddToCart);
router.get('/browser/cart', ctrl.browserGetCart);
router.post('/browser/checkout', ctrl.browserCheckout);
router.get('/purchases', ctrl.getLocalPurchases);
router.patch('/purchases/:id', ctrl.updatePurchaseStatus);

// ML purchase requests (from chatbot/employees)
router.get('/requests', ctrl.getRequests);
router.post('/requests', ctrl.createRequest);
router.patch('/requests/:id', ctrl.updateRequest);
router.delete('/requests/:id', ctrl.cancelRequest);

export default router;
