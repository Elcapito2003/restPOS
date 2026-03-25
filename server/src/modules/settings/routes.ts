import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/role';
import { query } from '../../config/database';

const router = Router();

router.use(authenticate);

router.get('/', async (_req, res) => {
  const result = await query('SELECT * FROM settings ORDER BY key');
  const settings: Record<string, string> = {};
  for (const row of result.rows) settings[row.key] = row.value;
  res.json(settings);
});

router.put('/', authorize('admin'), async (req, res) => {
  const entries = Object.entries(req.body) as [string, string][];
  for (const [key, value] of entries) {
    await query(
      'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
      [key, value]
    );
  }
  res.json({ ok: true });
});

export default router;
