-- 014_expand_permissions.sql
-- Expand permissions taxonomy to full fine-grained set and re-seed role_permissions

INSERT INTO permissions (key, description) VALUES
  ('portal.attendance',            'Access the Attendance Console page'),
  ('portal.employees',             'Access the Employees Management page'),
  ('portal.attendance_audit',      'Access the Attendance Audit page'),
  ('portal.breaks_audit',          'Access the Breaks Audit page'),
  ('portal.permissions',           'Access the Permissions Management page'),
  ('employees.view',               'View employee list and basic fields'),
  ('employees.view.sensitive',     'View sensitive employee fields'),
  ('employees.create',             'Create new employees'),
  ('employees.edit',               'Edit existing employee fields'),
  ('employees.edit.role',          'Change an employee role'),
  ('employees.edit.status',        'Change employment status'),
  ('employees.delete',             'Soft-delete / terminate employee record'),
  ('employees.filter.by_role',     'Use role filter on employees page'),
  ('employees.filter.by_department','Use department filter on employees page'),
  ('employees.filter.by_status',   'Use status filter on employees page'),
  ('attendance.view_own',          'View own attendance records'),
  ('attendance.view_team',         'View team attendance records'),
  ('attendance.view_all',          'View all employees attendance records'),
  ('attendance.correct',           'Submit attendance corrections'),
  ('breaks.view_own',              'View own break records'),
  ('breaks.view_team',             'View team break records'),
  ('breaks.view_all',              'View all employees break records'),
  ('hr.reset_password',            'Reset any employee password'),
  ('hr.manage_roles',              'Assign/change employee roles'),
  ('permissions.view',             'View the permissions matrix'),
  ('permissions.manage',           'Edit role-permission assignments')
ON CONFLICT (key) DO NOTHING;

-- Remove obsolete coarse key
DELETE FROM role_permissions WHERE permission_id IN (SELECT id FROM permissions WHERE key = 'employees.manage');
DELETE FROM permissions WHERE key = 'employees.manage';

-- Clear existing role_permissions and re-seed clean matrix
TRUNCATE role_permissions;

-- super_admin: gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.key = 'super_admin';

-- admin: permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key = 'admin' AND p.key IN (
  'portal.attendance', 'portal.employees', 'portal.attendance_audit', 'portal.breaks_audit',
  'employees.view', 'employees.view.sensitive', 'employees.create', 'employees.edit',
  'employees.edit.status', 'employees.filter.by_role', 'employees.filter.by_department', 'employees.filter.by_status',
  'attendance.view_own', 'attendance.view_team', 'attendance.view_all', 'attendance.correct',
  'breaks.view_own', 'breaks.view_team', 'breaks.view_all',
  'hr.reset_password'
);

-- manager: permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key = 'manager' AND p.key IN (
  'portal.attendance', 'portal.employees', 'portal.attendance_audit', 'portal.breaks_audit',
  'employees.view', 'employees.filter.by_department',
  'attendance.view_own', 'attendance.view_team', 'attendance.correct',
  'breaks.view_own', 'breaks.view_team'
);

-- team_leader: permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key = 'team_leader' AND p.key IN (
  'portal.attendance', 'portal.attendance_audit', 'portal.breaks_audit',
  'attendance.view_own', 'attendance.view_team',
  'breaks.view_own', 'breaks.view_team'
);

-- employee: permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.key = 'employee' AND p.key IN (
  'portal.attendance',
  'attendance.view_own',
  'breaks.view_own'
);
