DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'break_status') THEN
    CREATE TYPE break_status AS ENUM ('active', 'completed', 'exceeded', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
    CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS break_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  break_type_id     UUID NOT NULL REFERENCES break_types(id),
  department_id     UUID REFERENCES departments(id),
  centre_id         UUID REFERENCES centres(id),
  start_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_at            TIMESTAMPTZ,
  duration_minutes  NUMERIC(8,2),
  status            break_status NOT NULL DEFAULT 'active',
  limit_minutes     INTEGER,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS break_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  break_type_id     UUID REFERENCES break_types(id),
  requested_minutes INTEGER NOT NULL,
  reason            TEXT NOT NULL,
  status            request_status NOT NULL DEFAULT 'pending',
  reviewer_id       UUID REFERENCES employees(id),
  reviewed_at       TIMESTAMPTZ,
  review_notes      TEXT,
  break_record_id   UUID REFERENCES break_records(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS break_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  break_record_id UUID REFERENCES break_records(id) ON DELETE CASCADE,
  employee_id     UUID REFERENCES employees(id),
  actor_user_id   UUID REFERENCES users(id),
  action          TEXT NOT NULL,
  before_data     JSONB,
  after_data      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
