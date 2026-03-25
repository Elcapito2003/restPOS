import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { validate } from '../../middleware/validate';
import { floorSchema, tableSchema, tableStatusSchema, transferSchema } from './schema';
import * as ctrl from './controller';

const router = Router();

router.use(authenticate);

// Floors
router.get('/', ctrl.getFloors);
router.post('/', authorize('admin', 'manager'), validate(floorSchema), ctrl.createFloor);
router.put('/:id', authorize('admin', 'manager'), validate(floorSchema.partial()), ctrl.updateFloor);
router.delete('/:id', authorize('admin', 'manager'), ctrl.deleteFloor);

// Tables
router.get('/:floorId/tables', ctrl.getTables);
router.post('/tables', authorize('admin', 'manager'), validate(tableSchema), ctrl.createTable);
router.put('/tables/:id', ctrl.updateTable);
router.delete('/tables/:id', authorize('admin', 'manager'), ctrl.deleteTable);
router.patch('/tables/:id/status', validate(tableStatusSchema), ctrl.setStatus);
router.post('/tables/:id/transfer', validate(transferSchema), ctrl.transfer);

export default router;
