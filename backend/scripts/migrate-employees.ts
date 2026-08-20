/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import pool from '../src/lib/db';
import { parseSqlDump } from '../src/lib/copy-parser';
import { zulipService } from '../src/services/zulip.service';

export interface MigrationSummary {
  totalEmployees: number;
  migratedCount: number;
  zulipProvisionedCount: number;
}

export async function migrateEmployees(dumpFilePath: string): Promise<MigrationSummary> {
  console.log(`Starting employee migration from: ${dumpFilePath}`);
  const data = await parseSqlDump(dumpFilePath);

  const legacyEmployees = data['employees'] || [];
  const legacyDepartments = data['departments'] || [];
  const legacyCentres = data['centres'] || [];
  const legacyShifts = data['shifts'] || [];
  const legacyRoles = data['roles'] || [];

  const client = await pool.connect();
  const summary: MigrationSummary = {
    totalEmployees: legacyEmployees.length,
    migratedCount: 0,
    zulipProvisionedCount: 0,
  };

  const tempPasswords: Array<{ email: string; pass: string }> = [];

  try {
    // Clean up sample seeded employees to avoid conflicts with production migration
    await client.query("DELETE FROM employees WHERE email IN ('john.doe@jdconnect.com', 'jane.mgr@jdconnect.com')");
    await client.query("DELETE FROM users WHERE email IN ('john.doe@jdconnect.com', 'jane.mgr@jdconnect.com')");
    // Update the system admin's code to a safe, non-conflicting code
    await client.query("UPDATE employees SET employee_code = 'SYS-0001' WHERE email = 'admin@company.com'");

    // 1. Sync Reference Data and build ID mapping maps
    // A. Departments
    const deptMap: Record<string, string> = {}; // oldUUID -> newUUID
    for (const oldDept of legacyDepartments) {
      if (!oldDept.name) continue;
      // Check if department exists in new DB
      const res = await client.query('SELECT id FROM departments WHERE LOWER(name) = LOWER($1)', [oldDept.name]);
      if (res.rows.length > 0) {
        deptMap[oldDept.id!] = res.rows[0].id;
      } else {
        const insertRes = await client.query(
          'INSERT INTO departments (name, description, is_active) VALUES ($1, $2, $3) RETURNING id',
          [oldDept.name, oldDept.description || null, oldDept.is_active === 't']
        );
        deptMap[oldDept.id!] = insertRes.rows[0].id;
      }
    }

    // B. Centres
    const centreMap: Record<string, string> = {}; // oldUUID -> newUUID
    for (const oldCentre of legacyCentres) {
      if (!oldCentre.code) continue;
      const res = await client.query('SELECT id FROM centres WHERE LOWER(code) = LOWER($1)', [oldCentre.code]);
      if (res.rows.length > 0) {
        centreMap[oldCentre.id!] = res.rows[0].id;
      } else {
        const insertRes = await client.query(
          'INSERT INTO centres (code, name, is_active) VALUES ($1, $2, $3) RETURNING id',
          [oldCentre.code, oldCentre.name || oldCentre.code, oldCentre.is_active === 't']
        );
        centreMap[oldCentre.id!] = insertRes.rows[0].id;
      }
    }

    // C. Shifts
    const shiftMap: Record<string, string> = {}; // oldUUID -> newUUID
    for (const oldShift of legacyShifts) {
      if (!oldShift.name) continue;
      const res = await client.query('SELECT id FROM shifts WHERE LOWER(name) = LOWER($1)', [oldShift.name]);
      if (res.rows.length > 0) {
        shiftMap[oldShift.id!] = res.rows[0].id;
      } else {
        const insertRes = await client.query(
          'INSERT INTO shifts (name, start_time, end_time, grace_minutes, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [
            oldShift.name,
            oldShift.start_time,
            oldShift.end_time,
            oldShift.grace_minutes ? parseInt(oldShift.grace_minutes) : 15,
            oldShift.is_active === 't',
          ]
        );
        shiftMap[oldShift.id!] = insertRes.rows[0].id;
      }
    }

    // D. Roles
    const roleMap: Record<string, string> = {}; // oldUUID -> newUUID
    for (const oldRole of legacyRoles) {
      if (!oldRole.key) continue;
      // Map legacy hr to hr in new DB
      const targetRoleKey = oldRole.key === 'hr' ? 'hr' : oldRole.key;
      const res = await client.query('SELECT id FROM roles WHERE key = $1', [targetRoleKey]);
      if (res.rows.length > 0) {
        roleMap[oldRole.id!] = res.rows[0].id;
      }
    }

    // 2. Insert Users and Employees in first pass
    const employeeIdMap: Record<string, string> = {}; // oldEmployeeUUID -> newEmployeeUUID

    for (const oldEmp of legacyEmployees) {
      if (!oldEmp.email) continue;

      const email = oldEmp.email.toLowerCase().trim();
      const tempPassword = deriveTempPassword(oldEmp.auth_user_id || oldEmp.id || null);

      // Check if user already exists
      let userId: string;
      const userCheck = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      if (userCheck.rows.length > 0) {
        userId = userCheck.rows[0].id;
      } else {
        const passwordHash = await bcrypt.hash(tempPassword, 12);
        const userInsert = await client.query(
          'INSERT INTO users (email, password_hash, is_active) VALUES ($1, $2, $3) RETURNING id',
          [email, passwordHash, true]
        );
        userId = userInsert.rows[0].id;
        tempPasswords.push({ email, pass: tempPassword });
      }

      // Check if employee already exists
      let newEmployeeId: string;
      let existingZulipUserId: number | null = null;
      let existingZulipProvisioned = false;

      const empCheck = await client.query('SELECT id, zulip_user_id, zulip_provisioned FROM employees WHERE LOWER(email) = LOWER($1)', [email]);

      const deptId = oldEmp.department_id ? deptMap[oldEmp.department_id] || null : null;
      const roleId = oldEmp.role_id ? roleMap[oldEmp.role_id] || null : null;
      const centreId = oldEmp.centre_id ? centreMap[oldEmp.centre_id] || null : null;
      const shiftId = oldEmp.shift_id ? shiftMap[oldEmp.shift_id] || null : null;
      const status = resolveEmploymentStatus(oldEmp.employment_status || null);
      const aliasVal = oldEmp.alias_name || null;

      if (empCheck.rows.length > 0) {
        newEmployeeId = empCheck.rows[0].id;
        existingZulipUserId = empCheck.rows[0].zulip_user_id;
        existingZulipProvisioned = empCheck.rows[0].zulip_provisioned;

        await client.query(
          `UPDATE employees
           SET auth_user_id = $2, employee_code = $3, full_name = $4, alias = $5, mobile = $6,
               department_id = $7, role_id = $8, centre_id = $9, shift_id = $10,
               designation = $11, joining_date = $12, employment_status = $13, profile_photo_url = $14,
               updated_at = NOW()
           WHERE id = $1`,
          [
            newEmployeeId,
            userId,
            oldEmp.employee_code,
            oldEmp.full_name,
            aliasVal,
            oldEmp.mobile || null,
            deptId,
            roleId,
            centreId,
            shiftId,
            oldEmp.designation || null,
            oldEmp.joining_date || null,
            status,
            oldEmp.profile_photo_url || null,
          ]
        );
      } else {
        const empInsert = await client.query(
          `INSERT INTO employees (
             auth_user_id, employee_code, full_name, alias, email, mobile,
             department_id, role_id, centre_id, shift_id, designation,
             joining_date, employment_status, profile_photo_url
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           RETURNING id`,
          [
            userId,
            oldEmp.employee_code,
            oldEmp.full_name,
            aliasVal,
            email,
            oldEmp.mobile || null,
            deptId,
            roleId,
            centreId,
            shiftId,
            oldEmp.designation || null,
            oldEmp.joining_date || null,
            status,
            oldEmp.profile_photo_url || null,
          ]
        );
        newEmployeeId = empInsert.rows[0].id;
      }

      employeeIdMap[oldEmp.id!] = newEmployeeId;
      summary.migratedCount++;

      // 3. Atomically Provision Zulip Account
      if (existingZulipProvisioned && existingZulipUserId) {
        summary.zulipProvisionedCount++;
      } else {
        try {
          const zulipUser = await zulipService.createUser({
            email,
            full_name: oldEmp.alias_name || oldEmp.full_name || email.split('@')[0],
            password: tempPassword,
          });

          await client.query(
            'UPDATE employees SET zulip_user_id = $1, zulip_provisioned = true WHERE id = $2',
            [zulipUser.zulipUserId, newEmployeeId]
          );
          summary.zulipProvisionedCount++;
        } catch (err) {
          console.warn(`Failed to provision Zulip user for ${email}: ${(err as Error).message}`);
          await client.query(
            'UPDATE employees SET zulip_provisioned = false WHERE id = $1',
            [newEmployeeId]
          );
        }
      }
    }

    // 4. Second Pass: Update reporting structure manager_id and team_leader_id
    for (const oldEmp of legacyEmployees) {
      if (!oldEmp.email) continue;
      const newEmpId = employeeIdMap[oldEmp.id!];
      if (!newEmpId) continue;

      const newManagerId = oldEmp.manager_id ? employeeIdMap[oldEmp.manager_id] || null : null;
      const newTeamLeaderId = oldEmp.team_leader_id ? employeeIdMap[oldEmp.team_leader_id] || null : null;

      if (newManagerId || newTeamLeaderId) {
        await client.query(
          'UPDATE employees SET manager_id = $1, team_leader_id = $2 WHERE id = $3',
          [newManagerId, newTeamLeaderId, newEmpId]
        );
      }
    }

    // Write passwords file for HR
    if (tempPasswords.length > 0) {
      const csvContent = 'email,temporary_password\n' + tempPasswords.map((p) => `${p.email},${p.pass}`).join('\n');
      fs.writeFileSync(path.resolve(__dirname, '../../migration_passwords.csv'), csvContent, 'utf-8');
      console.log(`Wrote temporary passwords to migration_passwords.csv`);
    }

    console.log('Employee migration completed successfully.');
    return summary;
  } catch (err) {
    console.error('Employee migration script failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

export function deriveTempPassword(_oldAuthUserId?: string | null): string {
  return 'Hacking@159$';
}

export function resolveEmploymentStatus(status: string | null): string {
  const validStatuses = ['active', 'suspended', 'resigned', 'terminated', 'absconded'];
  return validStatuses.includes(status || '') ? status! : 'active';
}

if (require.main === module) {
  const dumpPath = process.argv[2] || 'C:\\Users\\Administrator\\Desktop\\jdconnect_public_data.sql';
  migrateEmployees(dumpPath)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
