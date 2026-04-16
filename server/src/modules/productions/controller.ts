import { Request, Response } from 'express';
import * as service from './service';

export async function getAll(_req: Request, res: Response) {
  res.json(await service.getAll());
}

export async function getById(req: Request, res: Response) {
  const prod = await service.getById(Number(req.params.id));
  if (!prod) return res.status(404).json({ error: 'Producción no encontrada' });
  res.json(prod);
}

export async function create(req: Request, res: Response) {
  try {
    const prod = await service.create(req.body);
    res.status(201).json(prod);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const prod = await service.update(Number(req.params.id), req.body);
    res.json(prod);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function remove(req: Request, res: Response) {
  await service.remove(Number(req.params.id));
  res.json({ message: 'Producción desactivada' });
}

export async function execute(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const result = await service.execute(userId, Number(req.params.id), req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getLogs(_req: Request, res: Response) {
  const limit = Number(_req.query.limit) || 50;
  res.json(await service.getLogs(limit));
}
