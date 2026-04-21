/**
 * One-shot: sync current active suppliers' phone numbers to OpenClaw allowlist.
 * Usage: npx tsx src/scripts/sync-openclaw-allowlist.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { syncAllowlistFromSuppliers } from '../modules/suppliers/openclawSync';

async function main() {
  console.log('Syncing suppliers → OpenClaw allowlist...\n');
  const res = await syncAllowlistFromSuppliers();
  console.log(`Suppliers with valid phone: ${res.supplierCount}`);
  console.log(`Total allowFrom entries now: ${res.allowFromCount}`);
  if (res.added.length) console.log(`Added:\n  ${res.added.join('\n  ')}`);
  if (res.removed.length) console.log(`Removed:\n  ${res.removed.join('\n  ')}`);
  if (!res.added.length && !res.removed.length) console.log('Already in sync, no changes.');
  console.log('\nOpenClaw hot-reload should pick up changes within seconds.');
  process.exit(0);
}

main().catch(err => { console.error('Sync failed:', err); process.exit(1); });
