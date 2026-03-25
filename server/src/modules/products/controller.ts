import { Request, Response } from 'express';
import * as service from './service';

export async function getAll(req: Request, res: Response) {
  const categoryId = req.query.category_id ? +req.query.category_id : undefined;
  const showAll = req.query.all === 'true';
  res.json(await service.getAll(categoryId, showAll));
}

export async function getById(req: Request, res: Response) {
  const product = await service.getWithModifiers(+req.params.id);
  if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(product);
}

export async function create(req: Request, res: Response) {
  const product = await service.create(req.body);
  res.status(201).json(product);
}

export async function update(req: Request, res: Response) {
  const product = await service.update(+req.params.id, req.body);
  res.json(product);
}

export async function remove(req: Request, res: Response) {
  await service.remove(+req.params.id);
  res.json({ ok: true });
}
