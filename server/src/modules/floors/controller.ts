import { Request, Response } from 'express';
import * as service from './service';

export async function getFloors(_req: Request, res: Response) {
  res.json(await service.getAllFloors());
}

export async function createFloor(req: Request, res: Response) {
  res.status(201).json(await service.createFloor(req.body));
}

export async function updateFloor(req: Request, res: Response) {
  const floor = await service.updateFloor(+req.params.id, req.body);
  res.json(floor);
}

export async function deleteFloor(req: Request, res: Response) {
  await service.deleteFloor(+req.params.id);
  res.json({ ok: true });
}

export async function getTables(req: Request, res: Response) {
  res.json(await service.getTablesByFloor(+req.params.floorId));
}

export async function createTable(req: Request, res: Response) {
  res.status(201).json(await service.createTable(req.body));
}

export async function updateTable(req: Request, res: Response) {
  const table = await service.updateTable(+req.params.id, req.body);
  res.json(table);
}

export async function deleteTable(req: Request, res: Response) {
  await service.deleteTable(+req.params.id);
  res.json({ ok: true });
}

export async function setStatus(req: Request, res: Response) {
  const table = await service.setTableStatus(+req.params.id, req.body.status);
  res.json(table);
}

export async function transfer(req: Request, res: Response) {
  try {
    await service.transferTable(+req.params.id, req.body.target_table_id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
}
