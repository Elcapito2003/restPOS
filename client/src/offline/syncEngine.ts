import api from '../config/api';
import { db } from './db';
import { getPendingOps, markSynced, markFailed, clearSynced } from './syncQueue';

type ProgressCallback = (remaining: number) => void;

// Map temp IDs to server IDs during sync
const tempToServerIds = new Map<string, number>();

/**
 * Replay all pending sync operations sequentially.
 * Called when connectivity is restored.
 */
export async function replayQueue(onProgress?: ProgressCallback): Promise<void> {
  const ops = await getPendingOps();
  if (ops.length === 0) return;

  console.log(`[sync] replaying ${ops.length} pending operations...`);
  let remaining = ops.length;
  onProgress?.(remaining);

  for (const op of ops) {
    try {
      // Resolve temp IDs in the endpoint and payload
      let endpoint = op.endpoint;
      let payload = { ...op.payload };

      // Replace temp order ID in endpoint
      if (op.dependsOnTempId) {
        const serverId = tempToServerIds.get(op.dependsOnTempId);
        if (serverId) {
          endpoint = endpoint.replace(op.dependsOnTempId, String(serverId));
          if (payload.order_id && payload.order_id < 0) {
            payload.order_id = serverId;
          }
        } else {
          // Dependency not yet synced — skip and mark failed
          await markFailed(op.id!, 'Dependency not synced');
          remaining--;
          onProgress?.(remaining);
          continue;
        }
      }

      // Execute the API call
      let response: any;
      switch (op.method) {
        case 'POST':
          response = await api.post(endpoint, payload, {
            headers: { 'X-Idempotency-Key': op.idempotencyKey },
          });
          break;
        case 'PUT':
          response = await api.put(endpoint, payload);
          break;
        case 'DELETE':
          response = await api.delete(endpoint);
          break;
        case 'PATCH':
          response = await api.patch(endpoint, payload);
          break;
      }

      // Map temp ID to server ID
      if (op.tempId && response?.data?.id) {
        tempToServerIds.set(op.tempId, response.data.id);
      }

      await markSynced(op.id!);
      console.log(`[sync] ${op.operation} OK`);
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Unknown error';
      console.error(`[sync] ${op.operation} FAILED:`, msg);
      await markFailed(op.id!, msg);
    }

    remaining--;
    onProgress?.(remaining);
  }

  // Clean up synced operations
  await clearSynced();

  // Clean up local offline data that was synced
  await db.orders.where('_offline').equals(1).delete();
  await db.orderItems.where('_offline').equals(1).delete();
  await db.payments.where('_offline').equals(1).delete();

  tempToServerIds.clear();
  console.log('[sync] replay complete');
}
