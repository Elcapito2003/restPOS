ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS reference VARCHAR(200);
ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS authorized_by INT REFERENCES users(id);
