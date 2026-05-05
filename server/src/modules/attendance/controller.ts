import { Request, Response, NextFunction } from 'express';
import * as svc from './service';

export async function getRoster(_req: Request, res: Response, next: NextFunction) {
  try { res.json(await svc.getFingerprintRoster()); } catch (e) { next(e); }
}

export async function punch(req: Request, res: Response, next: NextFunction) {
  try {
    const { user_id, type, match_score, device_info } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id requerido' });
    const finalType = type || (await svc.autoDetectType(user_id));
    const row = await svc.recordPunch({ user_id, type: finalType, match_score, device_info });
    res.json(row);
  } catch (e: any) {
    if (e.message?.includes('Ya marcaste')) return res.status(409).json({ error: e.message });
    next(e);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await svc.listAttendance({
      user_id: req.query.user_id ? Number(req.query.user_id) : undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json(rows);
  } catch (e) { next(e); }
}

export async function summary(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await svc.summary({
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    }));
  } catch (e) { next(e); }
}

export async function exportCsv(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await svc.listAttendance({
      user_id: req.query.user_id ? Number(req.query.user_id) : undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      limit: 10000,
    });
    const header = 'id,user_id,empleado,rol,tipo,fecha_hora,score\n';
    const body = rows.map((r: any) =>
      `${r.id},${r.user_id},"${(r.display_name || '').replace(/"/g, '""')}",${r.role},${r.type},${new Date(r.recorded_at).toISOString()},${r.match_score || ''}`
    ).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="asistencia-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(header + body);
  } catch (e) { next(e); }
}
