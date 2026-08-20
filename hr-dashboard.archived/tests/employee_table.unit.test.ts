import { describe, it, expect } from 'vitest';
import { filterEmployees } from '../src/components/employee_table';

describe('Employee Table Filter Unit Tests (W-602)', () => {
  const employees = [
    { id: '1', full_name: 'Alice Smith', email: 'alice@company.com', department: 'Sales', zulip_provisioned: true },
    { id: '2', full_name: 'Bob Jones', email: 'bob@company.com', department: 'Backend', zulip_provisioned: false },
    { id: '3', full_name: 'Charlie Brown', email: 'charlie@company.com', department: 'Sales', zulip_provisioned: true },
  ];

  it('filters employees by department name', () => {
    const result = filterEmployees(employees, { department: 'Sales' });
    expect(result).toHaveLength(2);
    expect(result.map((e) => e.full_name)).toEqual(['Alice Smith', 'Charlie Brown']);
  });

  it('filters employees by Zulip provisioning status', () => {
    const failedZulip = filterEmployees(employees, { zulip_provisioned: false });
    expect(failedZulip).toHaveLength(1);
    expect(failedZulip[0].full_name).toBe('Bob Jones');
  });

  it('returns all employees when no filter criteria are provided', () => {
    const result = filterEmployees(employees, {});
    expect(result).toHaveLength(3);
  });
});
