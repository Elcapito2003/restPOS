import fs from 'fs/promises';
import path from 'path';
import { query } from '../../config/database';

const CONFIG_PATH = process.env.OPENCLAW_CONFIG_PATH || '/root/.openclaw/openclaw.json';
const TRACKING_PATH = path.join(path.dirname(CONFIG_PATH), 'restpos-managed-numbers.json');

export function toE164Mx(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 13 && digits.startsWith('521')) return '+' + digits;
  if (digits.length === 12 && digits.startsWith('52')) return '+521' + digits.slice(2);
  if (digits.length === 10) return '+521' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+52' + digits;
  return null;
}

interface SyncResult {
  supplierCount: number;
  allowFromCount: number;
  added: string[];
  removed: string[];
}

export async function syncAllowlistFromSuppliers(): Promise<SyncResult> {
  const result = await query(
    `SELECT whatsapp, phone FROM suppliers WHERE is_active = true AND (whatsapp IS NOT NULL OR phone IS NOT NULL)`
  );

  const supplierNumbers = Array.from(new Set(
    result.rows
      .map(r => toE164Mx(r.whatsapp || r.phone))
      .filter((n): n is string => !!n)
  ));

  const configRaw = await fs.readFile(CONFIG_PATH, 'utf-8');
  const config = JSON.parse(configRaw);
  const existing: string[] = config.channels?.whatsapp?.allowFrom ?? [];

  let previouslyManaged: string[] = [];
  try {
    previouslyManaged = JSON.parse(await fs.readFile(TRACKING_PATH, 'utf-8'));
  } catch {
    // first run
  }
  const managedSet = new Set(previouslyManaged);

  const staticFromUser = existing.filter(n => !managedSet.has(n));
  const newAllowFrom = Array.from(new Set([...staticFromUser, ...supplierNumbers]));

  const added = supplierNumbers.filter(n => !existing.includes(n));
  const removed = previouslyManaged.filter(n => !supplierNumbers.includes(n));

  if (added.length === 0 && removed.length === 0) {
    return { supplierCount: supplierNumbers.length, allowFromCount: existing.length, added: [], removed: [] };
  }

  config.channels = config.channels ?? {};
  config.channels.whatsapp = config.channels.whatsapp ?? {};
  config.channels.whatsapp.allowFrom = newAllowFrom;

  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  await fs.writeFile(TRACKING_PATH, JSON.stringify(supplierNumbers, null, 2), 'utf-8');

  return {
    supplierCount: supplierNumbers.length,
    allowFromCount: newAllowFrom.length,
    added,
    removed,
  };
}

export async function syncAllowlistSafe(): Promise<void> {
  try {
    const res = await syncAllowlistFromSuppliers();
    if (res.added.length || res.removed.length) {
      console.log(`[openclaw-sync] +${res.added.length} -${res.removed.length} (total ${res.allowFromCount})`);
    }
  } catch (err: any) {
    console.warn(`[openclaw-sync] failed: ${err.message}`);
  }
}
