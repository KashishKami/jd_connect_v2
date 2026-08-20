import { describe, it, expect, vi } from 'vitest';
import { Pool } from 'pg';
import { DepartmentRepository } from '../src/repositories/department.repository';

describe('DepartmentRepository Unit Tests', () => {
  it('queries active departments ordered by name', async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          { id: 'dept-1', name: 'Backend' },
          { id: 'dept-2', name: 'Sales' },
        ],
      }),
    } as unknown as Pool;

    const repo = new DepartmentRepository(mockPool);
    const depts = await repo.listDepartments();

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE is_active = true ORDER BY name')
    );
    expect(depts).toHaveLength(2);
    expect(depts[0].name).toBe('Backend');
  });
});
