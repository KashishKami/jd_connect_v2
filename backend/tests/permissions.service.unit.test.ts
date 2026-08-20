import { describe, it, expect, vi } from 'vitest';
import { PermissionsService, ImmutableRoleError, UnknownPermissionKeyError } from '../src/services/permissions.service';
import { PermissionsRepository } from '../src/repositories/permissions.repository';

describe('PermissionsService Unit Tests', () => {
  it('getMyPermissions returns all keys when super_admin in roles', async () => {
    const mockRepo = {
      getAllPermissionKeys: vi.fn().mockResolvedValue(['p1', 'p2', 'p3']),
      getPermissionsForRoles: vi.fn(),
    } as unknown as PermissionsRepository;

    const service = new PermissionsService(mockRepo);
    const result = await service.getMyPermissions(['super_admin']);

    expect(result).toEqual(['p1', 'p2', 'p3']);
    expect(mockRepo.getAllPermissionKeys).toHaveBeenCalledOnce();
    expect(mockRepo.getPermissionsForRoles).not.toHaveBeenCalled();
  });

  it('getMyPermissions queries repo for non-super_admin roles', async () => {
    const mockRepo = {
      getAllPermissionKeys: vi.fn(),
      getPermissionsForRoles: vi.fn().mockResolvedValue(['p1', 'p2']),
    } as unknown as PermissionsRepository;

    const service = new PermissionsService(mockRepo);
    const result = await service.getMyPermissions(['employee']);

    expect(result).toEqual(['p1', 'p2']);
    expect(mockRepo.getPermissionsForRoles).toHaveBeenCalledWith(['employee']);
    expect(mockRepo.getAllPermissionKeys).not.toHaveBeenCalled();
  });

  it('updateRolePermissions throws ImmutableRoleError for super_admin', async () => {
    const service = new PermissionsService();
    await expect(service.updateRolePermissions('super_admin', ['p1'])).rejects.toThrow(ImmutableRoleError);
  });

  it('updateRolePermissions throws UnknownPermissionKeyError for invalid permission key', async () => {
    const mockRepo = {
      getAllPermissionKeys: vi.fn().mockResolvedValue(['portal.attendance', 'employees.view']),
    } as unknown as PermissionsRepository;

    const service = new PermissionsService(mockRepo);
    await expect(service.updateRolePermissions('admin', ['invalid.key'])).rejects.toThrow(UnknownPermissionKeyError);
  });
});
