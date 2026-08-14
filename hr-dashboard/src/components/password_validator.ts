export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

export function validateResetPasswordInput(password: string, confirmPassword: string): ValidationResult {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match' };
  }
  return { valid: true, error: null };
}

export async function executeAdminPasswordReset(
  apiClient: { post: (endpoint: string, body: Record<string, unknown>) => Promise<Record<string, unknown>> },
  employeeId: string,
  newPassword: string
): Promise<Record<string, unknown>> {
  return await apiClient.post(`/api/employees/${employeeId}/reset-password`, {
    new_password: newPassword,
  });
}
