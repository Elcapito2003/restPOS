import { Request, Response } from 'express';
import * as service from './service';

export async function getOpen(_req: Request, res: Response) {
  res.json(await service.getOpen());
}

export async function getMine(req: Request, res: Response) {
  const shift = await service.getOpenByUser(req.user!.userId);
  res.json(shift);
}

export async function open(req: Request, res: Response) {
  try {
    const userId = req.body.user_id || req.user!.userId;
    const shift = await service.open(userId, {
      starting_cash: req.body.starting_cash,
      notes: req.body.notes,
    });
    res.status(201).json(shift);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function close(req: Request, res: Response) {
  try {
    const shift = await service.close(req.user!.userId);
    res.json(shift);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getHistory(_req: Request, res: Response) {
  res.json(await service.getHistory());
}
