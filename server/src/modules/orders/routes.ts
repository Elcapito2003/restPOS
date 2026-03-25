import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { createOrderSchema, addItemSchema, updateItemSchema, discountSchema } from './schema';
import * as ctrl from './controller';

const router = Router();

router.use(authenticate);

router.get('/', ctrl.getActive);
router.get('/kitchen', ctrl.getKitchenOrders);
router.get('/meta/cancellation-reasons', ctrl.getCancellationReasons);
router.get('/table/:tableId', ctrl.getByTable);
router.get('/:id', ctrl.getById);
router.post('/', validate(createOrderSchema), ctrl.create);
router.post('/:id/items', validate(addItemSchema), ctrl.addItem);
router.put('/:id/items/:itemId', validate(updateItemSchema), ctrl.updateItem);
router.delete('/:id/items/:itemId', ctrl.removeItem);
router.post('/:id/send', ctrl.sendToKitchen);
router.patch('/:id/discount', authorize('admin', 'manager', 'cashier'), validate(discountSchema), ctrl.setDiscount);
router.post('/:id/cancel', authorize('admin', 'manager'), ctrl.cancel);
router.patch('/items/:itemId/ready', ctrl.markItemReady);
router.patch('/items/:itemId/preparing', ctrl.markItemPreparing);
router.post('/:id/items/:itemId/cancel', ctrl.cancelItem);
router.post('/:id/transfer-items', ctrl.transferItems);
router.post('/:id/merge', ctrl.mergeOrders);
router.patch('/:id/waiter', ctrl.changeWaiter);
router.patch('/:id/table', ctrl.changeTable);
router.patch('/:id/tip', ctrl.setTip);
router.patch('/:id/observations', ctrl.setObservations);
router.patch('/:id/guests', ctrl.setGuestCount);

export default router;
