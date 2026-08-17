/* eslint-disable no-console */
import bcrypt from 'bcryptjs';
import pool from '../src/lib/db';

export async function runSeed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Roles
    const roles = [
      { key: 'super_admin', name: 'Super Admin', desc: 'Full system access' },
      { key: 'admin', name: 'Admin', desc: 'Administrative access' },
      { key: 'manager', name: 'Manager', desc: 'Department manager access' },
      { key: 'team_leader', name: 'Team Leader', desc: 'Team supervisor access' },
      { key: 'employee', name: 'Employee', desc: 'Standard employee access' },
    ];

    for (const r of roles) {
      await client.query(
        `INSERT INTO roles (key, name, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO UPDATE SET name = $2, description = $3`,
        [r.key, r.name, r.desc]
      );
    }

    // 2. Permissions
    const permissions = [
      { key: 'employees.view', desc: 'View employee directory' },
      { key: 'employees.manage', desc: 'Create/edit/suspend employees' },
      { key: 'attendance.view_own', desc: 'View own attendance records' },
      { key: 'attendance.view_team', desc: 'View team attendance' },
      { key: 'attendance.view_all', desc: "View all employees' attendance" },
      { key: 'attendance.correct', desc: 'Submit attendance corrections' },
      { key: 'breaks.view_own', desc: 'View own break records' },
      { key: 'breaks.view_team', desc: 'View team break records' },
      { key: 'breaks.view_all', desc: "View all employees' breaks" },
      { key: 'hr.reset_password', desc: "Reset any employee's password" },
      { key: 'hr.manage_roles', desc: 'Assign/change employee roles' },
    ];

    for (const p of permissions) {
      await client.query(
        `INSERT INTO permissions (key, description)
         VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET description = $2`,
        [p.key, p.desc]
      );
    }

    // 3. Departments
    const departments = ['Sales', 'Backend', 'HR', 'Training', 'Management', 'Marketing', 'Logistics'];
    for (const d of departments) {
      await client.query(
        `INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
        [d]
      );
    }

    // 4. Centres
    const centres = [
      { code: 'DBP', name: 'Doon Business Park' },
      { code: 'ITP', name: 'IT Park' },
    ];
    for (const c of centres) {
      await client.query(
        `INSERT INTO centres (code, name) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
        [c.code, c.name]
      );
    }

    // 5. Shifts (Times in EST)
    await client.query(
      `INSERT INTO shifts (name, start_time, end_time, grace_minutes)
       VALUES ('Night Shift', '09:00:00', '18:00:00', 15)
       ON CONFLICT (name) DO NOTHING`
    );

    // 6. Break Types
    const breakTypes = [
      { key: 'bio', name: 'Bio Break', limit: 10, tl: 10, mgr: 20 },
      { key: 'tea', name: 'Tea Break', limit: 15, tl: 15, mgr: 25 },
      { key: 'dinner', name: 'Dinner Break', limit: 30, tl: 30, mgr: 45 },
      { key: 'smoke', name: 'Smoke Break', limit: 10, tl: 10, mgr: 20 },
      { key: 'meeting', name: 'Meeting Break', limit: null, tl: null, mgr: null },
    ];

    for (const bt of breakTypes) {
      await client.query(
        `INSERT INTO break_types (key, name, default_limit_minutes, tl_alert_minutes, manager_alert_minutes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (key) DO UPDATE SET name = $2, default_limit_minutes = $3, tl_alert_minutes = $4, manager_alert_minutes = $5`,
        [bt.key, bt.name, bt.limit, bt.tl, bt.mgr]
      );
    }

    // 7. Initial Super Admin User & Employee Profile
    const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@company.com';
    const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'AdminPassword123!';
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2
       RETURNING id`,
      [adminEmail, passwordHash]
    );
    const adminUserId = userRes.rows[0].id;

    const superAdminRoleRes = await client.query(`SELECT id FROM roles WHERE key = 'super_admin'`);
    const superAdminRoleId = superAdminRoleRes.rows[0]?.id;

    const deptRes = await client.query(`SELECT id FROM departments WHERE name = 'Management'`);
    const deptId = deptRes.rows[0]?.id;

    const centreRes = await client.query(`SELECT id FROM centres WHERE code = 'DBP'`);
    const centreId = centreRes.rows[0]?.id;

    const shiftRes = await client.query(`SELECT id FROM shifts WHERE name = 'Night Shift'`);
    const shiftId = shiftRes.rows[0]?.id;

    await client.query(
      `INSERT INTO employees (auth_user_id, full_name, email, role_id, department_id, centre_id, shift_id, designation, zulip_user_id, zulip_provisioned)
       VALUES ($1, 'Super Admin', $2, $3, $4, $5, $6, 'System Administrator', 11, true)
       ON CONFLICT (email) DO UPDATE SET auth_user_id = $1, role_id = $3, zulip_user_id = 11`,
      [adminUserId, adminEmail, superAdminRoleId, deptId, centreId, shiftId]
    );

    // 8. Sample Employee User & Profile
    const empEmail = 'john.doe@jdconnect.com';
    const empPassword = 'Employee123!';
    const empHash = await bcrypt.hash(empPassword, 12);

    const empUserRes = await client.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2
       RETURNING id`,
      [empEmail, empHash]
    );

    const empRoleIdRes = await client.query(`SELECT id FROM roles WHERE key = 'employee'`);

    await client.query(
      `INSERT INTO employees (auth_user_id, full_name, email, role_id, department_id, centre_id, shift_id, designation, zulip_user_id, zulip_provisioned)
       VALUES ($1, 'John Doe', $2, $3, $4, $5, $6, 'Backend Engineer', 14, true)
       ON CONFLICT (email) DO UPDATE SET auth_user_id = $1, role_id = $3, zulip_user_id = 14`,
      [empUserRes.rows[0].id, empEmail, empRoleIdRes.rows[0]?.id, deptId, centreId, shiftId]
    );

    // 9. Sample Manager User & Profile
    const mgrEmail = 'jane.mgr@jdconnect.com';
    const mgrPassword = 'Manager123!';
    const mgrHash = await bcrypt.hash(mgrPassword, 12);

    const mgrUserRes = await client.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2
       RETURNING id`,
      [mgrEmail, mgrHash]
    );

    const mgrRoleIdRes = await client.query(`SELECT id FROM roles WHERE key = 'manager'`);

    await client.query(
      `INSERT INTO employees (auth_user_id, full_name, email, role_id, department_id, centre_id, shift_id, designation, zulip_user_id, zulip_provisioned)
       VALUES ($1, 'Jane Manager', $2, $3, $4, $5, $6, 'Engineering Manager', 15, true)
       ON CONFLICT (email) DO UPDATE SET auth_user_id = $1, role_id = $3, zulip_user_id = 15`,
      [mgrUserRes.rows[0].id, mgrEmail, mgrRoleIdRes.rows[0]?.id, deptId, centreId, shiftId]
    );

    await client.query('COMMIT');
    console.log('Seeding completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
