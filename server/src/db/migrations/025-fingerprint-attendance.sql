-- Huella digital + reloj checador (append-only, no editable)

ALTER TABLE users ADD COLUMN IF NOT EXISTS fingerprint_template TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fingerprint_enrolled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS time_attendance (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type VARCHAR(10) NOT NULL CHECK (type IN ('in', 'out')),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  match_score INT,
  device_info VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_user ON time_attendance(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_recorded ON time_attendance(recorded_at DESC);

-- Bloqueo a nivel BD: time_attendance es append-only.
-- Ni super-admin ni admin pueden editar o borrar registros via la app.
CREATE OR REPLACE FUNCTION block_attendance_modification() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'time_attendance es append-only: no se permite UPDATE ni DELETE';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_attendance_update ON time_attendance;
CREATE TRIGGER trg_block_attendance_update
  BEFORE UPDATE OR DELETE ON time_attendance
  FOR EACH ROW EXECUTE FUNCTION block_attendance_modification();
