import { Request, Response } from 'express';
import * as service from './service';

export async function getAll(_req: Request, res: Response) {
  res.json(await service.getAll());
}

export async function getTree(_req: Request, res: Response) {
  res.json(await service.getTree());
}

export async function getById(req: Request, res: Response) {
  const cat = await service.getById(+req.params.id);
  if (!cat) return res.status(404).json({ error: 'Categoría no encontrada' });
  res.json(cat);
}

export async function create(req: Request, res: Response) {
  const cat = await service.create(req.body);
  res.status(201).json(cat);
}

export async function update(req: Request, res: Response) {
  const cat = await service.update(+req.params.id, req.body);
  res.json(cat);
}

export async function remove(req: Request, res: Response) {
  await service.remove(+req.params.id);
  res.json({ ok: true });
}
