import { query } from '../../config/database';

// Devuelve los templates de huella para hacer matching 1:N en el cliente del reloj.
// Sólo usuarios activos con huella enrolada.
export async function getFingerprintRoster() {
  const r = await query(`
    SELECT id, display_name, role, avatar_color, fingerprint_template
    FROM users
    WHERE is_active = true AND fingerprint_template IS NOT NULL
    ORDER BY display_name
  `);
  return r.rows.map((u: any) => ({
    id: u.id,
    display_name: u.display_name,
    role: u.role,
    avatar_color: u.avatar_color,
    template: u.fingerprint_template,
  }));
}

// Inserta un registro de asistencia. El tipo (in/out) se decide del lado del cliente
// del reloj basado en la última marca del empleado, pero validamos en backend que
// sea consistente. Append-only: la tabla rechaza UPDATE/DELETE vía trigger PG.
export async function recordPunch(data: {
  user_id: number;
  type: 'in' | 'out';
  match_score?: number;
  device_info?: string;
}) {
  const last = await query(
    `SELECT type FROM time_attendance WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
    [data.user_id]
  );
  const lastType = last.rows[0]?.type || null;
  // Si la última marca fue del mismo tipo, asumimos error y rechazamos.
  // Esto evita doble-checada accidental por dejar el dedo dos veces.
  if (lastType === data.type) {
    throw new Error(`Ya marcaste ${data.type === 'in' ? 'entrada' : 'salida'}. Tu próxima marca debe ser ${data.type === 'in' ? 'salida' : 'entrada'}.`);
  }
  const r = await query(
    `INSERT INTO time_attendance (user_id, type, match_score, device_info)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, type, recorded_at, match_score`,
    [data.user_id, data.type, data.match_score || null, data.device_info || null]
  );
  return r.rows[0];
}

// Auto-detecta el tipo basado en la última marca del empleado.
export async function autoDetectType(userId: number): Promise<'in' | 'out'> {
  const last = await query(
    `SELECT type FROM time_attendance WHERE user_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
    [userId]
  );
  const lastType = last.rows[0]?.type;
  return lastType === 'in' ? 'out' : 'in';
}

// Listado para super-admin / admin: filtrable por empleado y rango de fechas.
export async function listAttendance(filters: {
  user_id?: number;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const conds: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (filters.user_id) { conds.push(`a.user_id = $${i++}`); vals.push(filters.user_id); }
  if (filters.from) { conds.push(`a.recorded_at >= $${i++}`); vals.push(filters.from); }
  if (filters.to) { conds.push(`a.recorded_at <= $${i++}`); vals.push(filters.to); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const limit = Math.min(filters.limit || 500, 5000);
  const r = await query(`
    SELECT a.id, a.user_id, u.display_name, u.role, u.avatar_color,
           a.type, a.recorded_at, a.match_score, a.device_info
    FROM time_attendance a
    JOIN users u ON u.id = a.user_id
    ${where}
    ORDER BY a.recorded_at DESC
    LIMIT ${limit}
  `, vals);
  return r.rows;
}

// Reporte agregado por empleado: total horas trabajadas, número de marcas, etc.
export async function summary(filters: { from?: string; to?: string }) {
  const conds: string[] = [];
  const vals: any[] = [];
  let i = 1;
  if (filters.from) { conds.push(`a.recorded_at >= $${i++}`); vals.push(filters.from); }
  if (filters.to) { conds.push(`a.recorded_at <= $${i++}`); vals.push(filters.to); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  // Empareja entradas con la siguiente salida (LATERAL join). Suma horas.
  const r = await query(`
    SELECT u.id AS user_id, u.display_name, u.role, u.avatar_color,
           COUNT(a.id) FILTER (WHERE a.type = 'in') AS punches_in,
           COUNT(a.id) FILTER (WHERE a.type = 'out') AS punches_out,
           COALESCE(SUM(EXTRACT(EPOCH FROM (out_match.recorded_at - a.recorded_at)) / 3600.0), 0) AS hours_worked
    FROM users u
    LEFT JOIN time_attendance a ON a.user_id = u.id ${where ? 'AND ' + conds.join(' AND ') : ''}
    LEFT JOIN LATERAL (
      SELECT recorded_at FROM time_attendance
      WHERE user_id = a.user_id AND type = 'out' AND recorded_at > a.recorded_at
      ORDER BY recorded_at ASC LIMIT 1
    ) out_match ON a.type = 'in'
    WHERE u.is_active = true
    GROUP BY u.id, u.display_name, u.role, u.avatar_color
    ORDER BY u.display_name
  `, vals);
  return r.rows;
}
