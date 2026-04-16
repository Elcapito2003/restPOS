import { db, type SyncOperation } from './db';

let tempIdCounter = -1;

export function nextTempId(): number {
  return tempIdCounter--;
}

export function genIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueue(op: Omit<SyncOperation, 'id' | 'status' | 'createdAt' | 'idempotencyKey'>): Promise<number> {
  const id = await db.syncQueue.add({
    ...op,
    status: 'pending',
    createdAt: Date.now(),
    idempotencyKey: genIdempotencyKey(),
  });
  return id as number;
}

export async function getPendingCount(): Promise<number> {
  return db.syncQueue.where('status').equals('pending').count();
}

export async function getPendingOps(): Promise<SyncOperation[]> {
  return db.syncQueue.where('status').equals('pending').sortBy('createdAt');
}

export async function markSynced(id: number, serverResponse?: any): Promise<void> {
  await db.syncQueue.update(id, { status: 'synced', error: undefined });
}

export async function markFailed(id: number, error: string): Promise<void> {
  await db.syncQueue.update(id, { status: 'failed', error });
}

export async function clearSynced(): Promise<void> {
  await db.syncQueue.where('status').equals('synced').delete();
}
