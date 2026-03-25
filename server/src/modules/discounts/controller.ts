import { Request, Response } from 'express';
import * as service from './service';

export async function getAll(req: Request, res: Response) {
  const presets = req.query.active === 'true' ? await service.getActive() : await service.getAll();
  res.json(presets);
}

export async function create(req: Request, res: Response) {
  try {
    const preset = await service.create(req.body, req.user!.userId);
    res.status(201).json(preset);
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un descuento con ese código' });
    }
    res.status(400).json({ error: err.message });
  }
}

export async function update(req: Request, res: Response) {
  try {
    const preset = await service.update(+req.params.id, req.body);
    if (!preset) return res.status(404).json({ error: 'Descuento no encontrado' });
    res.json(preset);
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Ya existe un descuento con ese código' });
    }
    res.status(400).json({ error: err.message });
  }
}

export async function deactivate(req: Request, res: Response) {
  const preset = await service.deactivate(+req.params.id);
  if (!preset) return res.status(404).json({ error: 'Descuento no encontrado' });
  res.json(preset);
}
