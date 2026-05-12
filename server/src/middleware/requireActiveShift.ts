import { Request, Response, NextFunction } from 'express';
import { getOpenByUser } from '../modules/shifts/service';
import { query } from '../config/database';

export async function requireActiveShift(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'No autenticado' });
  if (req.user.role === 'admin') return next();

  // Meseros no abren turno propio: solo necesitan que el cajero/admin haya
  // abierto turno en el sistema. Si hay al menos uno abierto, pueden trabajar.
  if (req.user.role === 'waiter') {
    const any = await query("SELECT 1 FROM shifts WHERE status = 'open' LIMIT 1");
    if (any.rows.length === 0) {
      return res.status(403).json({
        error: 'No hay turno abierto. Pide al cajero abrir turno en la caja antes de tomar pedidos.',
        code: 'SHIFT_REQUIRED_GLOBAL',
      });
    }
    return next();
  }

  // Cajero/manager: requieren su propio turno (manejan efectivo).
  const shift = await getOpenByUser(req.user.userId);
  if (!shift) {
    return res.status(403).json({
      error: 'Debes abrir un turno antes de operar',
      code: 'SHIFT_REQUIRED',
    });
  }
  next();
}
