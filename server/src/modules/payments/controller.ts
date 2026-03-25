import { Request, Response } from 'express';
import * as service from './service';

export async function processPayment(req: Request, res: Response) {
  try {
    const result = await service.processPayment(req.user!.userId, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function processSplitPayment(req: Request, res: Response) {
  try {
    const result = await service.processSplitPayment(req.user!.userId, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function getByOrder(req: Request, res: Response) {
  res.json(await service.getByOrder(+req.params.orderId));
}

export async function voidPayment(req: Request, res: Response) {
  try {
    await service.voidPayment(+req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
