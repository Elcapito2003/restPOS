import { Request, Response, NextFunction } from 'express';
import { getOpenByUser } from '../modules/shifts/service';

export async function requireActiveShift(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role === 'admin') return next();

  const shift = await getOpenByUser(req.user.userId);
  if (!shift) {
    return res.status(403).json({
      error: 'Debes abrir un turno antes de operar',
      code: 'SHIFT_REQUIRED',
    });
  }
  next();
}
