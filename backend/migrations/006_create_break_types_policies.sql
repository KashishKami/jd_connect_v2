CREATE TABLE IF NOT EXISTS break_types (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                    TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  description            TEXT,
  default_limit_minutes  INTEGER,
  tl_alert_minutes       INTEGER,
  manager_alert_minutes  INTEGER,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS break_policies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  break_type_id         UUID NOT NULL REFERENCES break_types(id) ON DELETE CASCADE,
  centre_id             UUID REFERENCES centres(id) ON DELETE CASCADE,
  department_id         UUID REFERENCES departments(id) ON DELETE CASCADE,
  limit_minutes         INTEGER,
  tl_alert_minutes      INTEGER,
  manager_alert_minutes INTEGER,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (break_type_id, centre_id, department_id)
);
