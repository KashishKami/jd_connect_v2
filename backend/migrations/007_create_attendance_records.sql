DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status') THEN
    CREATE TYPE attendance_status AS ENUM ('present', 'half_day', 'absent', 'late', 'leave', 'weekly_off', 'holiday');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_source') THEN
    CREATE TYPE attendance_source AS ENUM ('auto', 'manual', 'correction');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
    CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS attendance_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date     DATE NOT NULL,
  clock_in_at   TIMESTAMPTZ,
  clock_out_at  TIMESTAMPTZ,
  hours_worked  NUMERIC(5,2),
  status        attendance_status NOT NULL DEFAULT 'absent',
  is_late       BOOLEAN NOT NULL DEFAULT false,
  source        attendance_source NOT NULL DEFAULT 'auto',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, work_date)
);

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id          UUID REFERENCES attendance_records(id) ON DELETE CASCADE,
  employee_id            UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date              DATE NOT NULL,
  requested_clock_in_at  TIMESTAMPTZ,
  requested_clock_out_at TIMESTAMPTZ,
  requested_status       attendance_status,
  reason                 TEXT NOT NULL,
  status                 request_status NOT NULL DEFAULT 'pending',
  requested_by           UUID NOT NULL REFERENCES employees(id),
  reviewed_by            UUID REFERENCES employees(id),
  reviewed_at            TIMESTAMPTZ,
  review_notes           TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES attendance_records(id) ON DELETE SET NULL,
  employee_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES users(id),
  action        TEXT NOT NULL,
  before_data   JSONB,
  after_data    JSONB,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
