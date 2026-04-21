import { Request, Response } from 'express';
import * as authService from './service';

export async function login(req: Request, res: Response) {
  try {
    const { username, pin } = req.body;
    const result = await authService.authenticateByUsername(username, pin, req.tenantId);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}

export async function pinLogin(req: Request, res: Response) {
  try {
    const { userId, pin } = req.body;
    const result = await authService.authenticateByPin(userId, pin, req.tenantId);
    res.json(result);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
}

export async function getUsers(req: Request, res: Response) {
  try {
    const users = await authService.getActiveUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function verifyPin(req: Request, res: Response) {
  try {
    const { userId, pin } = req.body;
    const user = await authService.verifyPin(userId, pin);
    res.json({ valid: true, user });
  } catch (err: any) {
    res.status(401).json({ valid: false, error: err.message });
  }
}

export async function me(req: Request, res: Response) {
  res.json(req.user);
}
