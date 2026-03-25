import { Request, Response } from 'express';
import * as service from './service';

export async function getTypes(_req: Request, res: Response) {
  res.json(await service.getTypes());
}

export async function createType(req: Request, res: Response) {
  res.status(201).json(await service.createType(req.body));
}

export async function getExpenses(req: Request, res: Response) {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos' });
  res.json(await service.getExpenses(start as string, end as string));
}

export async function create(req: Request, res: Response) {
  const expense = await service.create(req.user!.userId, req.body);
  res.status(201).json(expense);
}

export async function getSummary(req: Request, res: Response) {
  const { start, end } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos' });
  res.json(await service.getSummary(start as string, end as string));
}
