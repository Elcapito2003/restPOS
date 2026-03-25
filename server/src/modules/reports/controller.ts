import { Request, Response } from 'express';
import * as service from './service';

export async function daily(req: Request, res: Response) {
  const date = req.query.date as string | undefined;
  res.json(await service.getDailySummary(date));
}

export async function byPeriod(req: Request, res: Response) {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos' });
  res.json(await service.getSalesByPeriod(start as string, end as string));
}

export async function byWaiter(req: Request, res: Response) {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos' });
  res.json(await service.getSalesByWaiter(start as string, end as string));
}

export async function byCategory(req: Request, res: Response) {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos' });
  res.json(await service.getSalesByCategory(start as string, end as string));
}

export async function byProduct(req: Request, res: Response) {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos' });
  res.json(await service.getSalesByProduct(start as string, end as string));
}

export async function byHour(req: Request, res: Response) {
  const date = req.query.date as string | undefined;
  res.json(await service.getSalesByHour(date));
}

export async function cancellations(req: Request, res: Response) {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos' });
  res.json(await service.getCancellations(start as string, end as string));
}

export async function discounts(req: Request, res: Response) {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos' });
  res.json(await service.getDiscounts(start as string, end as string));
}

export async function openChecks(_req: Request, res: Response) {
  res.json(await service.getOpenChecks());
}

export async function paidChecks(req: Request, res: Response) {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos' });
  res.json(await service.getPaidChecks(start as string, end as string));
}

export async function cancelledChecks(req: Request, res: Response) {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos' });
  res.json(await service.getCancelledChecks(start as string, end as string));
}
