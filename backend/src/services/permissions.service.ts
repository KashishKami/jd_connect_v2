import { PermissionsRepository, permissionsRepository as defaultPermissionsRepo, RoleWithPermissions } from '../repositories/permissions.repository';

export class ImmutableRoleError extends Error {
  constructor() {
    super('super_admin permissions cannot be modified');
    this.name = 'ImmutableRoleError';
  }
}

export class UnknownPermissionKeyError extends Error {
  constructor(key: string) {
    super(`Unknown permission key: ${key}`);
    this.name = 'UnknownPermissionKeyError';
  }
}

export class PermissionsService {
  constructor(private permRepo: PermissionsRepository = defaultPermissionsRepo) {}

  async getMyPermissions(roles: string[]): Promise<string[]> {
    if (!roles || roles.length === 0) return [];

    if (roles.includes('super_admin')) {
      return this.permRepo.getAllPermissionKeys();
    }

    return this.permRepo.getPermissionsForRoles(roles);
  }

  async getAllPermissions(): Promise<{ key: string; description: string | null }[]> {
    return this.permRepo.getAllPermissions();
  }

  async getRolesWithPermissions(): Promise<RoleWithPermissions[]> {
    return this.permRepo.getRolesWithPermissions();
  }

  async getRolePermissions(roleKey: string): Promise<string[]> {
    if (roleKey === 'super_admin') {
      return this.permRepo.getAllPermissionKeys();
    }
    return this.permRepo.getPermissionsForRoles([roleKey]);
  }

  async updateRolePermissions(roleKey: string, permissionKeys: string[]): Promise<void> {
    if (roleKey === 'super_admin') {
      throw new ImmutableRoleError();
    }

    const validKeys = await this.permRepo.getAllPermissionKeys();
    const validSet = new Set(validKeys);

    for (const key of permissionKeys) {
      if (!validSet.has(key)) {
        throw new UnknownPermissionKeyError(key);
      }
    }

    await this.permRepo.setRolePermissions(roleKey, permissionKeys);
  }
}

export const permissionsService = new PermissionsService();
