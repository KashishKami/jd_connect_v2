export interface AddEmployeePayloadInput {
  full_name?: string;
  email?: string;
  password?: string;
  role_key?: string;
  department_id?: string;
  centre_id?: string;
  shift_id?: string;
}

export function validateAddEmployeePayload(payload: AddEmployeePayloadInput): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!payload.full_name || payload.full_name.trim().length === 0) {
    errors.push('Full name is required');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!payload.email || !emailRegex.test(payload.email.trim())) {
    errors.push('Valid email is required');
  }

  if (!payload.password || payload.password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (!payload.role_key || payload.role_key.trim().length === 0) {
    errors.push('Role selection is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function formatRoleLabel(roleKey: string): string {
  if (!roleKey) return '';
  return roleKey
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
