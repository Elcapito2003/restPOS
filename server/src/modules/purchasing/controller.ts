import { Request, Response } from 'express';
import * as service from './service';
import { getOpenClawStatus } from './openclaw';

export async function getOrders(req: Request, res: Response) {
  const status = req.query.status as string | undefined;
  res.json(await service.getOrders(status));
}

export async function getOrderById(req: Request, res: Response) {
  const order = await service.getOrderById(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(order);
}

export async function createOrder(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const order = await service.createOrder(userId, req.body);
  res.status(201).json(order);
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = req.body;
  const order = await service.updateOrderStatus(Number(req.params.id), status);
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(order);
}

export async function cancelOrder(req: Request, res: Response) {
  const order = await service.cancelOrder(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(order);
}

export async function getMessages(req: Request, res: Response) {
  res.json(await service.getMessages(Number(req.params.id)));
}

export async function getConversation(req: Request, res: Response) {
  res.json(await service.getConversation(Number(req.params.supplierId)));
}

export async function sendOrderMessage(req: Request, res: Response) {
  try {
    const msg = await service.sendOrderMessage(Number(req.params.id), req.body.message);
    res.json(msg);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const order = await service.getOrderById(Number(req.params.id));
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' });
    const msg = await service.sendFreeMessage(order.id, order.supplier_id, req.body.message);
    res.json(msg);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

/** Webhook called by OpenClaw when an incoming WhatsApp message arrives */
export async function incomingWebhook(req: Request, res: Response) {
  const { phone, message, wa_message_id } = req.body;
  const msg = await service.receiveMessage(phone, message, wa_message_id);
  res.json(msg);
}

export async function openclawStatus(_req: Request, res: Response) {
  res.json(await getOpenClawStatus());
}

// ─── Reception & Payment ───

export async function getOrdersForReception(_req: Request, res: Response) {
  res.json(await service.getOrdersForReception());
}

export async function getOrdersPendingPayment(_req: Request, res: Response) {
  res.json(await service.getOrdersPendingPayment());
}

export async function getOrdersHistory(req: Request, res: Response) {
  const limit = Number(req.query.limit) || 50;
  res.json(await service.getOrdersHistory(limit));
}

export async function receiveOrder(req: Request, res: Response) {
  try {
    const order = await service.receiveOrder(Number(req.params.id), req.body);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function payOrder(req: Request, res: Response) {
  try {
    const order = await service.payOrder(Number(req.params.id), req.body);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
