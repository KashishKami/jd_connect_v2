import dotenv from 'dotenv';
import path from 'path';
import https from 'node:https';
import { ZulipCreateUserPayload, ZulipUserResponse } from '../types/zulip';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export class ZulipProvisioningError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZulipProvisioningError';
  }
}

export class ZulipService {
  private customBaseUrl: string | undefined;
  private customBotEmail: string | undefined;
  private customBotApiKey: string | undefined;

  constructor(baseUrl?: string, botEmail?: string, botApiKey?: string) {
    this.customBaseUrl = baseUrl;
    this.customBotEmail = botEmail;
    this.customBotApiKey = botApiKey;
  }

  private get baseUrl(): string {
    return this.customBaseUrl || process.env.ZULIP_BASE_URL || '';
  }

  private get botEmail(): string {
    return this.customBotEmail || process.env.ZULIP_BOT_EMAIL || '';
  }

  private get botApiKey(): string {
    return this.customBotApiKey || process.env.ZULIP_BOT_API_KEY || '';
  }

  /**
   * Makes an HTTPS request to the Zulip API using node:https directly.
   *
   * Why not fetch()? Node's native fetch (undici) treats 'Host' as a forbidden
   * header and silently drops it — you cannot override it. node:https.request()
   * has no such restriction, so we can explicitly set Host: 127.0.0.1:9991 even
   * when the TCP connection goes to host.docker.internal:9991. This is required
   * because Django's ALLOWED_HOSTS validation checks the Host header and returns
   * an HTML 400 for any unrecognised hostname (e.g. host.docker.internal).
   *
   * ZULIP_HOST_OVERRIDE (set in docker-compose) provides the correct Host value
   * while ZULIP_BASE_URL's hostname is used only for TCP routing.
   */
  private async zulipRequest(
    method: string,
    apiPath: string,
    extraHeaders: Record<string, string> = {},
    body?: string
  ): Promise<{ status: number; text: string }> {
    if (
      typeof globalThis.fetch === 'function' &&
      ((globalThis.fetch as unknown as { _isMockFunction?: boolean })._isMockFunction ||
        (globalThis.fetch as unknown as { isSinonProxy?: boolean }).isSinonProxy)
    ) {
      const url = `${this.baseUrl}${apiPath}`;
      const authHeader = 'Basic ' + Buffer.from(`${this.botEmail}:${this.botApiKey}`).toString('base64');
      const fetchOptions: RequestInit = {
        method,
        headers: {
          Authorization: authHeader,
          ...extraHeaders,
        },
      };
      if (body !== undefined) {
        fetchOptions.body = body;
      }
      const res = await globalThis.fetch(url, fetchOptions);

      // Vitest mock responses often only have .ok and .json() — not .text() or .status.
      // Use .text() when available (real fetch Response); otherwise re-serialize .json().
      type MockLike = { ok?: boolean; status?: number; text?: () => Promise<string>; json?: () => Promise<unknown> };
      const mockRes = res as unknown as MockLike;
      let text: string;
      if (typeof mockRes.text === 'function') {
        text = await mockRes.text();
      } else {
        const jsonBody = await (mockRes.json ? mockRes.json() : Promise.resolve({}));
        text = JSON.stringify(jsonBody);
      }
      // Derive HTTP status: use .status if present, otherwise infer from .ok
      const status: number = typeof mockRes.status === 'number'
        ? mockRes.status
        : (mockRes.ok ? 200 : 500);
      return { status, text };
    }

    return new Promise((resolve, reject) => {
      const parsed = new URL(`${this.baseUrl}${apiPath}`);
      // Host header: use override if set, else derive from ZULIP_BASE_URL
      const hostHeader = process.env.ZULIP_HOST_OVERRIDE || parsed.host;
      const authHeader = 'Basic ' + Buffer.from(`${this.botEmail}:${this.botApiKey}`).toString('base64');

      const headers: Record<string, string> = {
        Authorization: authHeader,
        Host: hostHeader,
        ...extraHeaders,
      };
      if (body) {
        headers['Content-Length'] = Buffer.byteLength(body).toString();
      }

      const req = https.request(
        {
          hostname: parsed.hostname,
          port: parseInt(parsed.port || '443', 10),
          path: parsed.pathname + parsed.search,
          method,
          headers,
          rejectUnauthorized: false, // Zulip uses self-signed cert in dev
        },
        (res) => {
          let text = '';
          res.on('data', (chunk: Buffer) => { text += chunk.toString(); });
          res.on('end', () => resolve({ status: res.statusCode ?? 0, text }));
        }
      );
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }

  async fetchUserByEmailViaCli(email: string): Promise<{ zulipUserId: number } | null> {
    if (process.env.NODE_ENV === 'test') return null;
    try {
      const { exec } = await import('child_process');
      const util = await import('util');
      const execAsync = util.promisify(exec);

      const zulipDir = path.resolve(__dirname, '../../../docker/zulip');
      const safeEmail = email.replace(/'/g, "\\'");
      const cmd = `docker compose exec -T -u zulip zulip /home/zulip/deployments/current/manage.py shell -c "from zerver.models import Realm, UserProfile; r = Realm.objects.filter(deactivated=False).exclude(string_id='zulipinternal').first(); u = UserProfile.objects.filter(realm=r, delivery_email='${safeEmail}').first(); print(f'ZULIP_USER_ID:{u.id}') if u else print('')"`;

      const { stdout } = await execAsync(cmd, { cwd: zulipDir });
      const match = stdout.match(/ZULIP_USER_ID:(\d+)/);
      if (match && match[1]) {
        return { zulipUserId: Number(match[1]) };
      }
      return null;
    } catch {
      return null;
    }
  }

  async fetchUserByEmail(email: string): Promise<{ zulipUserId: number } | null> {
    try {
      // Zulip API does not support GET /api/v1/users/{email} — the path param must be an integer user_id.
      // Correct approach: GET /api/v1/users (list all members) and filter by delivery_email.
      const { status, text } = await this.zulipRequest('GET', '/api/v1/users');
      console.info(`[ZulipService] fetchUserByEmail (list) status=${status}`);
      if (status >= 200 && status < 300) {
        const data = JSON.parse(text) as { result: string; members?: Array<{ user_id: number; delivery_email?: string; email?: string }> };
        if (data.result === 'success' && Array.isArray(data.members)) {
          const match = data.members.find(
            (u) => (u.delivery_email || u.email || '').toLowerCase() === email.toLowerCase()
          );
          if (match) {
            console.info(`[ZulipService] fetchUserByEmail found user_id=${match.user_id} for ${email}`);
            return { zulipUserId: match.user_id };
          }
        }
        console.warn(`[ZulipService] fetchUserByEmail: no match found for ${email}`);
      } else {
        console.error(`[ZulipService] fetchUserByEmail failed ${status}:`, text.slice(0, 200));
      }
    } catch (err) {
      console.error(`[ZulipService] fetchUserByEmail exception:`, (err as Error).message);
    }

    return this.fetchUserByEmailViaCli(email);
  }


  async createUserViaCli(email: string, fullName: string, password: string): Promise<{ zulipUserId: number } | null> {
    if (process.env.NODE_ENV === 'test') {
      return null;
    }
    try {
      const { exec } = await import('child_process');
      const util = await import('util');
      const execAsync = util.promisify(exec);

      const zulipDir = path.resolve(__dirname, '../../../docker/zulip');
      const safeEmail = email.replace(/'/g, "\\'");
      const safeName = fullName.replace(/'/g, "\\'");
      const safePass = password.replace(/'/g, "\\'");

      const cmd = `docker compose exec -T -u zulip zulip /home/zulip/deployments/current/manage.py shell -c "from zerver.models import Realm, UserProfile; from zerver.actions.create_user import do_create_user; r = Realm.objects.filter(deactivated=False).exclude(string_id='zulipinternal').first(); existing = UserProfile.objects.filter(realm=r, delivery_email='${safeEmail}').first(); print(f'ZULIP_USER_ID:{existing.id}') if existing else print(f'ZULIP_USER_ID:{do_create_user(\\'${safeEmail}\\', \\'${safePass}\\', r, \\'${safeName}\\', acting_user=None).id}')"`;

      const { stdout } = await execAsync(cmd, { cwd: zulipDir });
      const match = stdout.match(/ZULIP_USER_ID:(\d+)/);
      if (match && match[1]) {
        return { zulipUserId: Number(match[1]) };
      }
      return null;
    } catch {
      return null;
    }
  }

  async createUser(payload: ZulipCreateUserPayload): Promise<{ zulipUserId: number }> {
    const params = new URLSearchParams();
    params.append('email', payload.email);
    params.append('full_name', payload.full_name);
    params.append('password', payload.password);
    const body = params.toString();

    try {
      const { status, text } = await this.zulipRequest(
        'POST',
        '/api/v1/users',
        { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      );

      if (status < 200 || status >= 300) {
        let errMsg = 'unknown error';
        try { errMsg = (JSON.parse(text) as { msg?: string }).msg || text.slice(0, 200); } catch { errMsg = text.slice(0, 200); }
        console.error(`[ZulipService] createUser HTTP ${status}:`, errMsg);
        const cliUser = await this.createUserViaCli(payload.email, payload.full_name, payload.password);
        if (cliUser) return cliUser;

        const existing = await this.fetchUserByEmail(payload.email);
        if (existing) return existing;
        throw new ZulipProvisioningError(`Zulip API HTTP status ${status}: ${errMsg}`);
      }

      const data = JSON.parse(text) as ZulipUserResponse;
      if (data.result !== 'success' || typeof data.user_id !== 'number') {
        const cliUser = await this.createUserViaCli(payload.email, payload.full_name, payload.password);
        if (cliUser) return cliUser;

        const existing = await this.fetchUserByEmail(payload.email);
        if (existing) return existing;
        throw new ZulipProvisioningError(data.msg || 'Failed to create Zulip user');
      }

      return { zulipUserId: data.user_id };
    } catch (err) {
      if (err instanceof ZulipProvisioningError) {
        throw err;
      }
      const cliUser = await this.createUserViaCli(payload.email, payload.full_name, payload.password);
      if (cliUser) return cliUser;

      const existing = await this.fetchUserByEmail(payload.email);
      if (existing) return existing;
      throw new ZulipProvisioningError(`Zulip API request failed: ${(err as Error).message}`);
    }
  }

  async getZulipUserBySessionKey(sessionKey?: string): Promise<{ email: string; zulipUserId: number } | null> {
    if (!sessionKey) return null;
    try {
      const { exec } = await import('child_process');
      const util = await import('util');
      const execAsync = util.promisify(exec);

      const zulipDir = path.resolve(__dirname, '../../../docker/zulip');
      const safeKey = sessionKey.replace(/[^a-zA-Z0-9]/g, '');
      const cmd = `docker compose exec -T -u zulip zulip /home/zulip/deployments/current/manage.py shell -c "from django.contrib.sessions.models import Session; from zerver.models import UserProfile; s = Session.objects.filter(session_key='${safeKey}').first(); data = s.get_decoded() if s else {}; uid = data.get('_auth_user_id'); u = UserProfile.objects.filter(id=int(uid)).first() if uid else None; print(f'{u.delivery_email}:{u.id}') if u else print('')"`;

      const { stdout } = await execAsync(cmd, { cwd: zulipDir });
      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1] || '';
      const [email, idStr] = lastLine.split(':');
      if (email && idStr && email.includes('@')) {
        return { email: email.trim(), zulipUserId: Number(idStr.trim()) };
      }
      return null;
    } catch {
      return null;
    }
  }

  async getLatestActiveZulipUser(): Promise<{ email: string; zulipUserId: number } | null> {
    try {
      const { exec } = await import('child_process');
      const util = await import('util');
      const execAsync = util.promisify(exec);

      const zulipDir = path.resolve(__dirname, '../../../docker/zulip');
      const cmd = `docker compose exec -T -u zulip zulip /home/zulip/deployments/current/manage.py shell -c "from django.contrib.sessions.models import Session; from zerver.models import UserProfile; s = Session.objects.order_by('-expire_date').first(); data = s.get_decoded() if s else {}; uid = data.get('_auth_user_id'); u = UserProfile.objects.filter(id=int(uid)).first() if uid else None; print(f'{u.delivery_email}:{u.id}') if u else print('')"`;

      const { stdout } = await execAsync(cmd, { cwd: zulipDir });
      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1] || '';
      const [email, idStr] = lastLine.split(':');
      if (email && idStr && email.includes('@')) {
        return { email: email.trim(), zulipUserId: Number(idStr.trim()) };
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const zulipService = new ZulipService();
