import { Request, Response } from 'express';
import * as browser from './browser';
import { query } from '../../config/database';

function handleError(res: Response, err: any) {
  res.status(500).json({ error: err.message || 'Error' });
}

export async function login(req: Request, res: Response) {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token requerido' });
  try {
    res.json(await browser.login(token));
  } catch (err: any) { handleError(res, err); }
}

export async function getBalance(_req: Request, res: Response) {
  try {
    res.json(await browser.getBalance());
  } catch (err: any) { handleError(res, err); }
}

export async function getBeneficiaries(_req: Request, res: Response) {
  try {
    res.json(await browser.getBeneficiaries());
  } catch (err: any) { handleError(res, err); }
}

export async function makeTransfer(req: Request, res: Response) {
  const { beneficiary, amount, concept, token, supplier_id } = req.body;
  if (!beneficiary || !amount) {
    return res.status(400).json({ error: 'beneficiary y amount requeridos' });
  }

  try {
    const result = await browser.makeTransfer({ beneficiary, amount, concept: concept || 'Pago proveedor', token });

    // Save transfer record
    const userId = req.user?.userId;
    await query(
      `INSERT INTO transfers (supplier_id, beneficiary, amount, concept, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [supplier_id || null, beneficiary, amount, concept || 'Pago proveedor', result.status, userId]
    );

    res.json(result);
  } catch (err: any) { handleError(res, err); }
}

export async function getTransfers(_req: Request, res: Response) {
  try {
    const result = await query(
      `SELECT t.*, u.display_name as created_by_name, s.name as supplier_name
       FROM transfers t
       LEFT JOIN users u ON u.id = t.created_by
       LEFT JOIN suppliers s ON s.id = t.supplier_id
       ORDER BY t.created_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) { handleError(res, err); }
}

export async function confirmTransfer(req: Request, res: Response) {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token requerido' });
  try {
    res.json(await browser.confirmTransfer(token));
  } catch (err: any) { handleError(res, err); }
}

// ─── Transfer requests (manager) ───

export async function requestTransfer(req: Request, res: Response) {
  const { supplier_id, beneficiary, amount, concept, note } = req.body;
  if (!amount || !beneficiary) return res.status(400).json({ error: 'beneficiary y amount requeridos' });
  try {
    const userId = req.user?.userId;
    const result = await query(
      `INSERT INTO transfers (supplier_id, beneficiary, amount, concept, request_note, status, requested_by, requested_at)
       VALUES ($1, $2, $3, $4, $5, 'requested', $6, NOW()) RETURNING *`,
      [supplier_id || null, beneficiary, amount, concept || 'Pago proveedor', note || null, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { handleError(res, err); }
}

export async function getPendingRequests(_req: Request, res: Response) {
  try {
    const result = await query(
      `SELECT t.*, u.display_name as requested_by_name, s.name as supplier_name,
              s.bank_name, s.clabe, s.account_number
       FROM transfers t
       LEFT JOIN users u ON u.id = t.requested_by
       LEFT JOIN suppliers s ON s.id = t.supplier_id
       WHERE t.status = 'requested'
       ORDER BY t.requested_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) { handleError(res, err); }
}

export async function approveRequest(req: Request, res: Response) {
  const { token } = req.body;
  const requestId = Number(req.params.id);
  try {
    // Get the request
    const reqResult = await query('SELECT * FROM transfers WHERE id = $1 AND status = $2', [requestId, 'requested']);
    if (!reqResult.rows[0]) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const transfer = reqResult.rows[0];

    // Execute the transfer via browser
    const result = await browser.makeTransfer({
      beneficiary: transfer.beneficiary,
      amount: Number(transfer.amount),
      concept: transfer.concept || 'Pago proveedor',
      token: token || '',
    });

    // Update the request
    const userId = req.user?.userId;
    const newStatus = result.status === 'completed' ? 'completed' : result.status === 'error' ? 'error' : 'pending';
    await query(
      `UPDATE transfers SET status = $1, approved_by = $2, approved_at = NOW(), created_by = $2 WHERE id = $3`,
      [newStatus, userId, requestId]
    );

    res.json(result);
  } catch (err: any) { handleError(res, err); }
}

export async function rejectRequest(req: Request, res: Response) {
  const requestId = Number(req.params.id);
  try {
    await query('UPDATE transfers SET status = $1 WHERE id = $2 AND status = $3', ['rejected', requestId, 'requested']);
    res.json({ success: true });
  } catch (err: any) { handleError(res, err); }
}

export async function getSupplierAccounts(_req: Request, res: Response) {
  try {
    const result = await query(
      `SELECT id, name, bank_name, account_number, clabe, whatsapp
       FROM suppliers WHERE is_active = true AND (clabe IS NOT NULL OR account_number IS NOT NULL)
       ORDER BY name`
    );
    res.json(result.rows);
  } catch (err: any) { handleError(res, err); }
}
