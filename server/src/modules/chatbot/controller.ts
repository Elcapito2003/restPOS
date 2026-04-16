import { Request, Response } from 'express';
import * as service from './service';

export async function sendMessage(req: Request, res: Response) {
  try {
    const userId = (req as any).user.userId;
    const sessionId = `user:${userId}`;
    const { message } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío' });
    }

    const response = await service.processMessage(sessionId, 'internal', message.trim());
    res.json({ response });
  } catch (err: any) {
    console.error('[chatbot] error:', err.message);
    res.status(500).json({ error: err.message });
  }
}

export async function getHistory(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const sessionId = `user:${userId}`;
  const limit = Number(req.query.limit) || 50;
  const messages = await service.getConversationHistory(sessionId, limit);
  res.json(messages);
}

export async function clearMemory(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const sessionId = `user:${userId}`;
  const result = await service.clearMemory(sessionId);
  res.json(result);
}
