import { Request, Response } from 'express';
import * as service from './service';

export async function getCurrent(_req: Request, res: Response) {
  const register = await service.getOpen();
  if (!register) return res.json(null);
  const movements = await service.getMovements(register.id);
  res.json({ ...register, movements });
}

export async function open(req: Request, res: Response) {
  try {
    const register = await service.open(req.user!.userId, req.body.opening_amount);
    res.status(201).json(register);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function close(req: Request, res: Response) {
  try {
    const register = await service.close(req.user!.userId, req.body.actual_amount, req.body.notes);
    res.json(register);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function addMovement(req: Request, res: Response) {
  try {
    const register = await service.getOpen();
    if (!register) return res.status(400).json({ error: 'No hay caja abierta' });
    const movement = await service.addMovement(register.id, req.user!.userId, req.body);
    res.status(201).json(movement);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getHistory(_req: Request, res: Response) {
  res.json(await service.getHistory());
}

export async function corteX(_req: Request, res: Response) {
  try {
    const result = await service.corteX();
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function corteZ(req: Request, res: Response) {
  try {
    const result = await service.corteZ(req.user!.userId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getPendingTips(_req: Request, res: Response) {
  try {
    res.json(await service.getPendingTips());
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function payTip(req: Request, res: Response) {
  try {
    const { waiter_id, amount } = req.body;
    const movement = await service.payTip(req.user!.userId, Number(waiter_id), Number(amount));
    res.status(201).json(movement);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
