import { Request, Response } from 'express';
import * as service from './service';

// Items
export async function getItems(_req: Request, res: Response) {
  res.json(await service.getItems());
}

export async function getItemById(req: Request, res: Response) {
  const item = await service.getItemById(Number(req.params.id));
  if (!item) return res.status(404).json({ error: 'Insumo no encontrado' });
  res.json(item);
}

export async function createItem(req: Request, res: Response) {
  res.status(201).json(await service.createItem(req.body));
}

export async function updateItem(req: Request, res: Response) {
  const item = await service.updateItem(Number(req.params.id), req.body);
  if (!item) return res.status(404).json({ error: 'Insumo no encontrado' });
  res.json(item);
}

export async function removeItem(req: Request, res: Response) {
  await service.removeItem(Number(req.params.id));
  res.json({ success: true });
}

// Item-Supplier
export async function getItemSuppliers(req: Request, res: Response) {
  res.json(await service.getItemSuppliers(Number(req.params.id)));
}

export async function linkSupplier(req: Request, res: Response) {
  res.status(201).json(await service.linkSupplier(req.body));
}

export async function unlinkSupplier(req: Request, res: Response) {
  await service.unlinkSupplier(Number(req.params.itemId), Number(req.params.supplierId));
  res.json({ success: true });
}

// Movements
export async function getMovements(req: Request, res: Response) {
  const itemId = req.query.item_id ? Number(req.query.item_id) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  res.json(await service.getMovements(itemId, limit));
}

export async function createMovement(req: Request, res: Response) {
  res.status(201).json(await service.createMovement(req.user!.userId, req.body));
}

// Purchases
export async function getPurchases(req: Request, res: Response) {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos' });
  res.json(await service.getPurchases(start as string, end as string));
}

export async function createPurchase(req: Request, res: Response) {
  res.status(201).json(await service.createPurchase(req.user!.userId, req.body));
}

// Presentations
export async function getPresentations(req: Request, res: Response) {
  if (req.params.id) {
    res.json(await service.getPresentations(Number(req.params.id)));
  } else {
    res.json(await service.getAllPresentations());
  }
}

export async function createPresentation(req: Request, res: Response) {
  try {
    res.status(201).json(await service.createPresentation(req.body));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function updatePresentation(req: Request, res: Response) {
  const result = await service.updatePresentation(Number(req.params.id), req.body);
  res.json(result);
}

export async function removePresentation(req: Request, res: Response) {
  await service.removePresentation(Number(req.params.id));
  res.json({ success: true });
}

export async function receiveByPresentation(req: Request, res: Response) {
  try {
    const result = await service.receiveByPresentation(req.user!.userId, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

// Low stock
export async function getLowStock(_req: Request, res: Response) {
  res.json(await service.getLowStock());
}
