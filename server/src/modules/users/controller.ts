import { Request, Response } from 'express';
import * as service from './service';

export async function getAll(req: Request, res: Response) {
  const users = await service.getAll();
  res.json(users);
}

export async function getById(req: Request, res: Response) {
  const user = await service.getById(+req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(user);
}

export async function create(req: Request, res: Response) {
  try {
    const user = await service.create(req.body);
    res.status(201).json(user);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'El nombre de usuario ya existe' });
    res.status(500).json({ error: err.message });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const user = await service.update(+req.params.id, req.body);
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function remove(req: Request, res: Response) {
  await service.remove(+req.params.id);
  res.json({ ok: true });
}
