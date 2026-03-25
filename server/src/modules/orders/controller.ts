import { Request, Response } from 'express';
import * as service from './service';

export async function getActive(_req: Request, res: Response) {
  res.json(await service.getActive());
}

export async function getById(req: Request, res: Response) {
  const order = await service.getById(+req.params.id);
  if (!order) return res.status(404).json({ error: 'Orden no encontrada' });
  res.json(order);
}

export async function getByTable(req: Request, res: Response) {
  const order = await service.getByTable(+req.params.tableId);
  if (!order) return res.status(404).json({ error: 'No hay orden activa en esta mesa' });
  res.json(order);
}

export async function create(req: Request, res: Response) {
  try {
    const order = await service.create(req.user!.userId, req.body);
    res.status(201).json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function addItem(req: Request, res: Response) {
  try {
    const order = await service.addItem(+req.params.id, req.body);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updateItem(req: Request, res: Response) {
  try {
    const order = await service.updateItem(+req.params.id, +req.params.itemId, req.body);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function removeItem(req: Request, res: Response) {
  const order = await service.removeItem(+req.params.id, +req.params.itemId);
  res.json(order);
}

export async function sendToKitchen(req: Request, res: Response) {
  const order = await service.sendToKitchen(+req.params.id);
  res.json(order);
}

export async function setDiscount(req: Request, res: Response) {
  const order = await service.setDiscount(+req.params.id, req.body.discount_percent, req.body.preset_id, req.body.authorized_by);
  res.json(order);
}

export async function cancel(req: Request, res: Response) {
  try {
    const order = await service.cancelOrder(+req.params.id);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getKitchenOrders(_req: Request, res: Response) {
  res.json(await service.getKitchenOrders());
}

export async function markItemReady(req: Request, res: Response) {
  await service.markItemReady(+req.params.itemId);
  res.json({ ok: true });
}

export async function markItemPreparing(req: Request, res: Response) {
  await service.markItemPreparing(+req.params.itemId);
  res.json({ ok: true });
}

export async function cancelItem(req: Request, res: Response) {
  try {
    const order = await service.cancelItem(+req.params.id, +req.params.itemId, req.body.reason, req.user!.userId);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function transferItems(req: Request, res: Response) {
  try {
    const result = await service.transferItems(+req.params.id, req.body.target_order_id, req.body.item_ids);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function mergeOrders(req: Request, res: Response) {
  try {
    const order = await service.mergeOrders(+req.params.id, req.body.target_order_id);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function changeWaiter(req: Request, res: Response) {
  const order = await service.changeWaiter(+req.params.id, req.body.waiter_id);
  res.json(order);
}

export async function changeTable(req: Request, res: Response) {
  try {
    const order = await service.changeTable(+req.params.id, req.body.table_id);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function setTip(req: Request, res: Response) {
  const order = await service.setTip(+req.params.id, req.body.amount);
  res.json(order);
}

export async function setObservations(req: Request, res: Response) {
  const order = await service.setObservations(+req.params.id, req.body.notes);
  res.json(order);
}

export async function setGuestCount(req: Request, res: Response) {
  const order = await service.setGuestCount(+req.params.id, req.body.guest_count);
  res.json(order);
}

export async function getCancellationReasons(_req: Request, res: Response) {
  res.json(await service.getCancellationReasons());
}
