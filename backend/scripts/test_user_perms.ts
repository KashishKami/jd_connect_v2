import pool from '../src/lib/db';
import { userRepository } from '../src/repositories/user.repository';
import { permissionsService } from '../src/services/permissions.service';

async function test() {
  const permRes = await pool.query(`SELECT * FROM permissions WHERE key = 'portal.attendance'`);
  console.log('PORTAL.ATTENDANCE PERMISSION ROW:', permRes.rows);

  const roleRes = await pool.query(`SELECT id, key FROM roles WHERE key IN ('employee', 'manager')`);
  console.log('ROLES:', roleRes.rows);

  const rpRes = await pool.query(`
    SELECT r.key as role_key, p.key as perm_key 
    FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE r.key IN ('employee', 'manager')
  `);
  console.log('ROLE PERMISSIONS FOR EMPLOYEE & MANAGER:', rpRes.rows);

  const john = await userRepository.findAuthUserByEmail('john.doe@jdconnect.com');
  console.log('JOHN USER DETAIL:', john);
  if (john) {
    const johnPerms = await permissionsService.getMyPermissions(john.role_keys);
    console.log('JOHN PERMISSIONS:', johnPerms);
  }

  process.exit(0);
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});
