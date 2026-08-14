import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OAuthService, InvalidGrantError } from '../src/services/oauth.service';
import { EmployeeRepository } from '../src/repositories/employee.repository';

describe('OAuthService Unit Tests', () => {
  let oauthService: OAuthService;
  let mockEmpRepo: Partial<EmployeeRepository>;

  beforeEach(() => {
    mockEmpRepo = {
      findById: vi.fn().mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        auth_user_id: '00000000-0000-0000-0000-000000000001',
        employee_code: 'JD0001',
        full_name: 'Test Employee',
        email: 'test@company.com',
        zulip_user_id: 42,
        zulip_provisioned: true,
        employment_status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    };

    oauthService = new OAuthService(mockEmpRepo as EmployeeRepository);
  });

  it('generates an auth code and exchanges it successfully', async () => {
    const code = await oauthService.generateAuthCode(
      '00000000-0000-0000-0000-000000000001',
      'zulip',
      'http://127.0.0.1:9991/complete/oidc'
    );
    expect(code).toBeTypeOf('string');
    expect(code.length).toBeGreaterThan(10);

    const tokenRes = await oauthService.exchangeCodeForToken(code);
    expect(tokenRes).toHaveProperty('access_token');
    expect(tokenRes.token_type).toBe('Bearer');
  });

  it('throws InvalidGrantError when exchanging an invalid or used authorization code', async () => {
    await expect(oauthService.exchangeCodeForToken('invalid_code_123')).rejects.toThrow(
      InvalidGrantError
    );
  });
});
