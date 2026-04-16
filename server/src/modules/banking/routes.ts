import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import * as ctrl from './controller';

const router = Router();
router.use(authenticate);

// Manager can request transfers and see supplier accounts
router.post('/request', authorize('admin', 'manager'), ctrl.requestTransfer);
router.get('/supplier-accounts', authorize('admin', 'manager'), ctrl.getSupplierAccounts);

// Admin only — everything else
router.post('/login', authorize('admin'), ctrl.login);
router.get('/balance', authorize('admin'), ctrl.getBalance);
router.get('/beneficiaries', authorize('admin'), ctrl.getBeneficiaries);
router.post('/transfer', authorize('admin'), ctrl.makeTransfer);
router.post('/confirm-transfer', authorize('admin'), ctrl.confirmTransfer);
router.get('/transfers', authorize('admin'), ctrl.getTransfers);
router.get('/requests/pending', authorize('admin'), ctrl.getPendingRequests);
router.post('/requests/:id/approve', authorize('admin'), ctrl.approveRequest);
router.post('/requests/:id/reject', authorize('admin'), ctrl.rejectRequest);

export default router;
