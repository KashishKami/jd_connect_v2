import { describe, it, expect } from 'vitest';
import { validateAddEmployeePayload, formatRoleLabel } from '../src/lib/employee_utils';

describe('HR Dashboard Interactivity Utilities (W-651 & W-652)', () => {
  it('validates required fields for adding a new employee', () => {
    const invalidPayload = {
      full_name: '',
      email: 'invalid-email',
      password: 'short',
      role_key: '',
    };

    const result = validateAddEmployeePayload(invalidPayload);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Full name is required');
    expect(result.errors).toContain('Valid email is required');
    expect(result.errors).toContain('Password must be at least 8 characters');
    expect(result.errors).toContain('Role selection is required');
  });

  it('passes validation for valid employee creation payload', () => {
    const validPayload = {
      full_name: 'John Doe',
      email: 'john.doe@jdconnect.com',
      password: 'EmployeePassword123!',
      role_key: 'employee',
      department_id: '1',
      centre_id: '1',
      shift_id: '1',
    };

    const result = validateAddEmployeePayload(validPayload);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('formats role key into human readable display title', () => {
    expect(formatRoleLabel('super_admin')).toBe('Super Admin');
    expect(formatRoleLabel('team_leader')).toBe('Team Leader');
    expect(formatRoleLabel('employee')).toBe('Employee');
  });
});
