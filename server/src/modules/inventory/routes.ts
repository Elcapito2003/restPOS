import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { inventoryItemSchema, inventoryItemUpdateSchema, itemSupplierSchema, movementSchema, purchaseSchema } from './schema';
import * as ctrl from './controller';

const router = Router();
router.use(authenticate);

// Items CRUD (admin/manager)
router.get('/items', ctrl.getItems);
router.get('/items/:id', ctrl.getItemById);
router.post('/items', authorize('admin', 'manager'), validate(inventoryItemSchema), ctrl.createItem);
router.put('/items/:id', authorize('admin', 'manager'), validate(inventoryItemUpdateSchema), ctrl.updateItem);
router.delete('/items/:id', authorize('admin', 'manager'), ctrl.removeItem);

// Item-Supplier links
router.get('/items/:id/suppliers', ctrl.getItemSuppliers);
router.post('/item-suppliers', authorize('admin', 'manager'), validate(itemSupplierSchema), ctrl.linkSupplier);
router.delete('/items/:itemId/suppliers/:supplierId', authorize('admin', 'manager'), ctrl.unlinkSupplier);

// Movements
router.get('/movements', ctrl.getMovements);
router.post('/movements', validate(movementSchema), ctrl.createMovement);

// Purchases
router.get('/purchases', ctrl.getPurchases);
router.post('/purchases', validate(purchaseSchema), ctrl.createPurchase);

// Presentations (admin/manager CRUD, any auth user can receive)
router.get('/presentations', ctrl.getPresentations);
router.get('/items/:id/presentations', ctrl.getPresentations);
router.post('/presentations', authorize('admin', 'manager'), ctrl.createPresentation);
router.put('/presentations/:id', authorize('admin', 'manager'), ctrl.updatePresentation);
router.delete('/presentations/:id', authorize('admin', 'manager'), ctrl.removePresentation);
router.post('/receive-by-presentation', ctrl.receiveByPresentation);

// Alerts
router.get('/low-stock', ctrl.getLowStock);

export default router;
