import { Request, Response } from 'express';
import * as service from './service';

export async function status(_req: Request, res: Response) {
  res.json(await service.getStatus());
}

export async function test(req: Request, res: Response) {
  const target = req.params.target;
  if (!['kitchen', 'bar', 'cashier'].includes(target)) {
    return res.status(400).json({ error: 'Destino inválido' });
  }
  res.json(await service.testPrinter(target));
}

export async function printComanda(req: Request, res: Response) {
  try {
    const results = await service.printComanda(+req.params.orderId);
    res.json(results);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}

export async function printReceipt(req: Request, res: Response) {
  try {
    const result = await service.printReceipt(+req.params.orderId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
