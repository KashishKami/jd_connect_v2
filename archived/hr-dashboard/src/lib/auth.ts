export function hasPermission(permissions: string[], requiredKey: string): boolean {
  if (!permissions || !Array.isArray(permissions)) return false;
  return permissions.includes(requiredKey) || permissions.includes('super_admin');
}

export function isSessionActive(token: string | null): boolean {
  return typeof token === 'string' && token.trim().length > 0;
}
