import pool from '../lib/db';

export interface RoleWithPermissions {
  key: string;
  name: string;
  permissions: string[];
}

export class PermissionsRepository {
  async getPermissionsForRoles(roleKeys: string[]): Promise<string[]> {
    if (!roleKeys || roleKeys.length === 0) return [];

    const res = await pool.query<{ key: string }>(
      `
      SELECT DISTINCT p.key
      FROM permissions p
      JOIN role_permissions rp ON rp.permission_id = p.id
      JOIN roles r ON r.id = rp.role_id
      WHERE r.key = ANY($1)
      ORDER BY p.key ASC
      `,
      [roleKeys]
    );

    return res.rows.map((r) => r.key);
  }

  async getAllPermissionKeys(): Promise<string[]> {
    const res = await pool.query<{ key: string }>(
      `SELECT key FROM permissions ORDER BY key ASC`
    );
    return res.rows.map((r) => r.key);
  }

  async getAllPermissions(): Promise<{ key: string; description: string | null }[]> {
    const res = await pool.query<{ key: string; description: string | null }>(
      `SELECT key, description FROM permissions ORDER BY key ASC`
    );
    return res.rows;
  }

  async getRolesWithPermissions(): Promise<RoleWithPermissions[]> {
    const rolesRes = await pool.query<{ id: string; key: string; name: string }>(
      `SELECT id, key, name FROM roles ORDER BY name ASC`
    );

    const roles: RoleWithPermissions[] = [];
    for (const r of rolesRes.rows) {
      if (r.key === 'super_admin') {
        const allKeys = await this.getAllPermissionKeys();
        roles.push({ key: r.key, name: r.name, permissions: allKeys });
      } else {
        const permKeys = await this.getPermissionsForRoles([r.key]);
        roles.push({ key: r.key, name: r.name, permissions: permKeys });
      }
    }

    return roles;
  }

  async setRolePermissions(roleKey: string, permissionKeys: string[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const roleRes = await client.query<{ id: string }>(
        `SELECT id FROM roles WHERE key = $1`,
        [roleKey]
      );
      if (roleRes.rows.length === 0) {
        throw new Error(`Role not found: ${roleKey}`);
      }
      const roleId = roleRes.rows[0].id;

      // Delete existing assignments for this role
      await client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);

      if (permissionKeys.length > 0) {
        const permRes = await client.query<{ id: string; key: string }>(
          `SELECT id, key FROM permissions WHERE key = ANY($1)`,
          [permissionKeys]
        );

        if (permRes.rows.length !== permissionKeys.length) {
          const foundKeys = new Set(permRes.rows.map((p) => p.key));
          const invalidKey = permissionKeys.find((k) => !foundKeys.has(k));
          throw new Error(`Unknown permission key: ${invalidKey}`);
        }

        for (const p of permRes.rows) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`,
            [roleId, p.id]
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const permissionsRepository = new PermissionsRepository();
