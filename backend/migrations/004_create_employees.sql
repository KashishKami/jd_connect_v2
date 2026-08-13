DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'employment_status') THEN
    CREATE TYPE employment_status AS ENUM ('active', 'suspended', 'resigned', 'terminated', 'absconded');
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS employee_code_seq START 1;

CREATE TABLE IF NOT EXISTS employees (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id          UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  rocketchat_user_id    TEXT UNIQUE,
  rc_provisioned        BOOLEAN NOT NULL DEFAULT false,
  employee_code         TEXT UNIQUE NOT NULL
                          DEFAULT ('JD' || lpad(nextval('employee_code_seq')::text, 4, '0')),
  full_name             TEXT NOT NULL,
  email                 TEXT UNIQUE NOT NULL,
  mobile                TEXT,
  department_id         UUID REFERENCES departments(id),
  role_id               UUID REFERENCES roles(id),
  team_leader_id        UUID REFERENCES employees(id),
  manager_id            UUID REFERENCES employees(id),
  centre_id             UUID REFERENCES centres(id),
  shift_id              UUID REFERENCES shifts(id),
  designation           TEXT,
  joining_date          DATE,
  employment_status     employment_status NOT NULL DEFAULT 'active',
  profile_photo_url     TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
