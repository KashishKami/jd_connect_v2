-- Rename and retype cross-system key column
ALTER TABLE employees
  DROP COLUMN IF EXISTS rocketchat_user_id;

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS zulip_user_id INTEGER UNIQUE;

-- Rename provisioning flag
ALTER TABLE employees
  RENAME COLUMN rc_provisioned TO zulip_provisioned;

-- Update index
DROP INDEX IF EXISTS idx_employees_rc_user;
CREATE INDEX IF NOT EXISTS idx_employees_zulip_user ON employees(zulip_user_id);
