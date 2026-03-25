import { Request, Response } from 'express';
import * as service from './service';

export async function getAll(_req: Request, res: Response) {
  res.json(await service.getAll());
}

export async function getById(req: Request, res: Response) {
  const client = await service.getById(+req.params.id);
  if (!client) return res.status(404).json({ error: 'Cliente no encontrado' });
  res.json(client);
}

export async function search(req: Request, res: Response) {
  const term = req.query.q as string;
  if (!term) return res.json([]);
  res.json(await service.search(term));
}

export async function create(req: Request, res: Response) {
  const client = await service.create(req.body);
  res.status(201).json(client);
}

export async function update(req: Request, res: Response) {
  const client = await service.update(+req.params.id, req.body);
  res.json(client);
}

export async function remove(req: Request, res: Response) {
  await service.remove(+req.params.id);
  res.json({ ok: true });
}
