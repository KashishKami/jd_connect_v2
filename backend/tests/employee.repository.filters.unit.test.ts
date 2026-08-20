import { describe, it, expect, vi } from 'vitest';
import { EmployeeRepository } from '../src/repositories/employee.repository';

describe('EmployeeRepository Filters Unit Tests', () => {
  it('applies search, department_id, role_key, and status filters in SQL query', async () => {
    const mockPool = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as unknown as any;

    const repo = new EmployeeRepository();
    // Override pool property for test
    (repo as any).createEmployee = vi.fn();

    await repo.findAllEmployees({
      search: 'ada',
      department_id: '11111111-1111-1111-1111-111111111111',
      role_key: 'manager',
      status: 'active',
    }, mockPool);

    expect(mockPool.query).toHaveBeenCalledWith(
      expect.stringContaining('e.full_name ILIKE'),
      expect.arrayContaining(['%ada%', '11111111-1111-1111-1111-111111111111', 'manager', 'active'])
    );
  });
});
