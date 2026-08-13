import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { SignJWT } from 'jose';
import { getPrivateKey } from '../lib/keys';
import { UserRepository, userRepository as defaultUserRepo } from '../repositories/user.repository';
import { SessionRepository, sessionRepository as defaultSessionRepo } from '../repositories/session.repository';
import { LoginInput, AuthResponse } from '../types/auth';

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
  }
}

export class AccountSuspendedError extends Error {
  constructor() {
    super('Account suspended');
    this.name = 'AccountSuspendedError';
  }
}

export class AuthService {
  constructor(
    private userRepo: UserRepository = defaultUserRepo,
    private sessionRepo: SessionRepository = defaultSessionRepo
  ) {}

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.userRepo.findAuthUserByEmail(input.email);
    if (!user || !user.is_active) {
      throw new InvalidCredentialsError();
    }

    const isValidPassword = await bcrypt.compare(input.password, user.password_hash);
    if (!isValidPassword) {
      throw new InvalidCredentialsError();
    }

    if (user.employment_status === 'suspended') {
      throw new AccountSuspendedError();
    }

    const privateKey = await getPrivateKey();
    const token = await new SignJWT({
      sub: user.id,
      employee_id: user.employee_id,
      zulip_user_id: user.zulip_user_id !== undefined && user.zulip_user_id !== null ? Number(user.zulip_user_id) : null,
      roles: user.role_keys,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(privateKey);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await this.sessionRepo.createSession(user.id, tokenHash);

    return {
      access_token: token,
      token_type: 'Bearer',
      expires_in: 900,
    };
  }
}

export const authService = new AuthService();
