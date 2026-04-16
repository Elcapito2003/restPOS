import { Request, Response } from 'express';
import * as service from './service';
import * as browser from './browser';
import { query } from '../../config/database';

function handleError(res: Response, err: any) {
  const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Error';
  res.status(err.response?.status || 500).json({ error: msg });
}

export async function getAuthUrl(_req: Request, res: Response) {
  res.json({ url: service.getAuthUrl() });
}

export async function exchangeCode(req: Request, res: Response) {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code requerido' });
  try {
    const result = await service.exchangeCode(code);
    res.json(result);
  } catch (err: any) { handleError(res, err); }
}

export async function getStatus(_req: Request, res: Response) {
  res.json(await service.getStatus());
}

export async function search(req: Request, res: Response) {
  const q = req.query.q as string;
  const limit = Number(req.query.limit) || 20;
  const offset = Number(req.query.offset) || 0;
  if (!q) return res.status(400).json({ error: 'q requerido' });
  try {
    res.json(await service.searchProducts(q, limit, offset));
  } catch (err: any) { handleError(res, err); }
}

export async function getProduct(req: Request, res: Response) {
  try {
    res.json(await service.getProduct(req.params.id));
  } catch (err: any) { handleError(res, err); }
}

export async function createOrder(req: Request, res: Response) {
  const { item_id, quantity } = req.body;
  if (!item_id || !quantity) return res.status(400).json({ error: 'item_id y quantity requeridos' });
  try {
    res.json(await service.createOrder(item_id, quantity));
  } catch (err: any) { handleError(res, err); }
}

export async function getOrders(req: Request, res: Response) {
  const limit = Number(req.query.limit) || 20;
  const offset = Number(req.query.offset) || 0;
  try {
    res.json(await service.getMyOrders(limit, offset));
  } catch (err: any) { handleError(res, err); }
}

export async function getOrderDetail(req: Request, res: Response) {
  try {
    res.json(await service.getOrderDetail(Number(req.params.id)));
  } catch (err: any) { handleError(res, err); }
}

// ─── Browser automation ───

export async function browserStatus(_req: Request, res: Response) {
  try {
    const loggedIn = await browser.isLoggedIn();
    res.json({ loggedIn });
  } catch (err: any) { handleError(res, err); }
}

export async function browserLogin(_req: Request, res: Response) {
  try {
    res.json(await browser.openLogin());
  } catch (err: any) { handleError(res, err); }
}

export async function browserSearch(req: Request, res: Response) {
  const q = req.query.q as string;
  if (!q) return res.status(400).json({ error: 'q requerido' });
  try {
    const results = await browser.searchProducts(q);
    res.json({ results, total: results.length });
  } catch (err: any) { handleError(res, err); }
}

export async function browserBuy(req: Request, res: Response) {
  const { url, quantity, title, price } = req.body;
  if (!url) return res.status(400).json({ error: 'url requerido' });
  try {
    const result = await browser.buyProduct(url, quantity || 1);

    // Save purchase to DB whenever the buy flow runs (purchased or checkout)
    if (result.status === 'purchased' || result.status === 'checkout') {
      const userId = req.user?.userId;
      const totalAmount = price ? price * (quantity || 1) : 0;
      await query(
        `INSERT INTO ml_purchases (ml_order_id, product_title, product_url, quantity, unit_price, total, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          (result as any).ml_order_id || null,
          title || 'Producto MercadoLibre',
          url,
          quantity || 1,
          price || 0,
          totalAmount,
          result.status === 'purchased' ? 'paid' : 'pending',
          userId,
        ]
      );
    }

    res.json(result);
  } catch (err: any) { handleError(res, err); }
}

export async function browserAddToCart(req: Request, res: Response) {
  const { url, quantity } = req.body;
  if (!url) return res.status(400).json({ error: 'url requerido' });
  try {
    res.json(await browser.addToCart(url, quantity || 1));
  } catch (err: any) { handleError(res, err); }
}

export async function browserGetCart(_req: Request, res: Response) {
  try {
    res.json(await browser.getCart());
  } catch (err: any) { handleError(res, err); }
}

export async function browserCheckout(_req: Request, res: Response) {
  try {
    res.json(await browser.checkoutCart());
  } catch (err: any) { handleError(res, err); }
}

// ─── Local purchases ───

export async function getLocalPurchases(_req: Request, res: Response) {
  try {
    const result = await query(
      `SELECT p.*, u.display_name as created_by_name
       FROM ml_purchases p
       LEFT JOIN users u ON u.id = p.created_by
       ORDER BY p.created_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) { handleError(res, err); }
}

export async function updatePurchaseStatus(req: Request, res: Response) {
  const { status, shipping_status, tracking_number } = req.body;
  try {
    const result = await query(
      `UPDATE ml_purchases SET status = COALESCE($2, status),
       shipping_status = COALESCE($3, shipping_status),
       tracking_number = COALESCE($4, tracking_number),
       updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, status || null, shipping_status || null, tracking_number || null]
    );
    res.json(result.rows[0]);
  } catch (err: any) { handleError(res, err); }
}

// ─── ML Purchase Requests ───

export async function getRequests(_req: Request, res: Response) {
  try {
    const result = await query(
      `SELECT * FROM ml_requests ORDER BY
        CASE status WHEN 'pending' THEN 0 WHEN 'searching' THEN 1 ELSE 2 END,
        CASE priority WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
        created_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) { handleError(res, err); }
}

export async function createRequest(req: Request, res: Response) {
  const { product_description, quantity, max_price, priority, notes, requested_by, search_query } = req.body;
  if (!product_description) return res.status(400).json({ error: 'product_description requerido' });
  try {
    const result = await query(
      `INSERT INTO ml_requests (product_description, quantity, max_price, priority, notes, requested_by, search_query)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [product_description, quantity || 1, max_price || null, priority || 'normal', notes || null, requested_by || null, search_query || product_description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) { handleError(res, err); }
}

export async function updateRequest(req: Request, res: Response) {
  const { status, purchased_title, purchased_url, purchased_price } = req.body;
  try {
    const result = await query(
      `UPDATE ml_requests SET
        status = COALESCE($2, status),
        purchased_title = COALESCE($3, purchased_title),
        purchased_url = COALESCE($4, purchased_url),
        purchased_price = COALESCE($5, purchased_price),
        processed_at = CASE WHEN $2 IN ('purchased', 'cancelled') THEN NOW() ELSE processed_at END
       WHERE id = $1 RETURNING *`,
      [req.params.id, status || null, purchased_title || null, purchased_url || null, purchased_price || null]
    );
    res.json(result.rows[0]);
  } catch (err: any) { handleError(res, err); }
}

export async function cancelRequest(req: Request, res: Response) {
  try {
    const result = await query(
      `UPDATE ml_requests SET status = 'cancelled', processed_at = NOW() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err: any) { handleError(res, err); }
}
