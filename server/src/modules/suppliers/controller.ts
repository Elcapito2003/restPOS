import { Request, Response } from 'express';
import * as service from './service';

export async function getAll(_req: Request, res: Response) {
  res.json(await service.getAll());
}

export async function getById(req: Request, res: Response) {
  const supplier = await service.getById(Number(req.params.id));
  if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });
  res.json(supplier);
}

export async function create(req: Request, res: Response) {
  const supplier = await service.create(req.body);
  res.status(201).json(supplier);
}

export async function update(req: Request, res: Response) {
  const supplier = await service.update(Number(req.params.id), req.body);
  if (!supplier) return res.status(404).json({ error: 'Proveedor no encontrado' });
  res.json(supplier);
}

export async function remove(req: Request, res: Response) {
  await service.remove(Number(req.params.id));
  res.json({ success: true });
}

export async function getSupplierItems(req: Request, res: Response) {
  res.json(await service.getSupplierItems(Number(req.params.id)));
}
