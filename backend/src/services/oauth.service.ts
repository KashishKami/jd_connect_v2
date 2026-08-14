import { SignJWT, generateKeyPair, KeyLike } from 'jose';
import { employeeRepository, EmployeeRepository } from '../repositories/employee.repository';

export class InvalidGrantError extends Error {
  constructor(message: string = 'Invalid or expired authorization code') {
    super(message);
    this.name = 'InvalidGrantError';
  }
}

interface AuthCodeEntry {
  employeeId: string;
  clientId: string;
  redirectUri: string;
  expiresAt: number;
}

// In-memory keypair for test/dev OAuth server tokens
let privateKeyPromise: Promise<KeyLike> | null = null;
async function getPrivateKey(): Promise<KeyLike> {
  if (!privateKeyPromise) {
    privateKeyPromise = generateKeyPair('RS256').then((res) => res.privateKey as KeyLike);
  }
  return privateKeyPromise;
}

export class OAuthService {
  private codes = new Map<string, AuthCodeEntry>();

  constructor(private empRepo: EmployeeRepository = employeeRepository) {}

  async generateAuthCode(
    employeeId: string,
    clientId: string,
    redirectUri: string
  ): Promise<string> {
    const code = 'code_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    this.codes.set(code, {
      employeeId,
      clientId,
      redirectUri,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes TTL
    });
    return code;
  }

  async exchangeCodeForToken(code: string): Promise<{ access_token: string; token_type: string }> {
    const entry = this.codes.get(code);
    if (!entry || Date.now() > entry.expiresAt) {
      this.codes.delete(code);
      throw new InvalidGrantError();
    }

    this.codes.delete(code); // One-time use code

    const employee = await this.empRepo.findById(entry.employeeId);
    if (!employee) {
      throw new InvalidGrantError('Employee not found for authorization code');
    }

    const key = await getPrivateKey();
    const token = await new SignJWT({
      sub: employee.auth_user_id || employee.id,
      employee_id: employee.id,
      zulip_user_id: employee.zulip_user_id,
      roles: ['employee'],
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(key);

    return {
      access_token: token,
      token_type: 'Bearer',
    };
  }

  async getUserInfo(employeeId: string): Promise<{
    sub: string;
    email: string;
    name: string;
    preferred_username: string;
    zulip_user_id: number | null;
  }> {
    const employee = await this.empRepo.findById(employeeId);
    if (!employee) {
      throw new Error('User not found');
    }

    return {
      sub: employee.id,
      email: employee.email,
      name: employee.full_name,
      preferred_username: employee.email.split('@')[0],
      zulip_user_id: employee.zulip_user_id ?? null,
    };
  }
}

export const oauthService = new OAuthService();
