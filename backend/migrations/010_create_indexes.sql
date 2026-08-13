CREATE INDEX IF NOT EXISTS idx_employees_auth_user ON employees(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_rc_user ON employees(rocketchat_user_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager ON employees(manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_tl ON employees(team_leader_id);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON employee_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON attendance_records(employee_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(work_date);
CREATE INDEX IF NOT EXISTS idx_att_audit_emp ON attendance_audit_logs(employee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_break_records_emp ON break_records(employee_id, start_at DESC);
CREATE INDEX IF NOT EXISTS idx_break_records_active ON break_records(status) WHERE status = 'active';
