import { Request, Response } from 'express';
import * as service from './service';

export async function getAll(_req: Request, res: Response) {
  res.json(await service.getAll());
}

export async function getById(req: Request, res: Response) {
  const group = await service.getById(+req.params.id);
  if (!group) return res.status(404).json({ error: 'Grupo no encontrado' });
  res.json(group);
}

export async function create(req: Request, res: Response) {
  const group = await service.create(req.body);
  res.status(201).json(group);
}

export async function update(req: Request, res: Response) {
  const group = await service.update(+req.params.id, req.body);
  res.json(group);
}

export async function remove(req: Request, res: Response) {
  await service.remove(+req.params.id);
  res.json({ ok: true });
}
