import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import pool from '../src/lib/db';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';
import { SignJWT, generateKeyPair, KeyLike } from 'jose';

describe('OIDC Server Endpoints Integration (W-402)', () => {
  let userJwt: string;
  let zulipUserId: number;

  beforeAll(async () => {
    await runMigrations();
  });

  beforeEach(async () => {
    await runSeed();

    const empRes = await pool.query(
      `INSERT INTO employees (full_name, email, zulip_user_id, zulip_provisioned)
       VALUES ('SSO User', 'sso@company.com', 88, true)
       RETURNING *`
    );
    const emp = empRes.rows[0];
    zulipUserId = emp.zulip_user_id;

    const { privateKey } = await generateKeyPair('RS256');
    userJwt = await new SignJWT({
      sub: emp.id,
      employee_id: emp.id,
      zulip_user_id: zulipUserId,
      roles: ['employee'],
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey as KeyLike);
  });

  it('GET /oauth/authorize generates auth code and redirects', async () => {
    const res = await request(app)
      .get('/oauth/authorize')
      .set('Authorization', `Bearer ${userJwt}`)
      .query({
        client_id: 'zulip',
        response_type: 'code',
        redirect_uri: 'http://127.0.0.1:9991/complete/oidc',
      });

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^http:\/\/127\.0\.0\.1:9991\/complete\/oidc\?code=/);
  });

  it('POST /oauth/token exchanges authorization code for access_token', async () => {
    const authRes = await request(app)
      .get('/oauth/authorize')
      .set('Authorization', `Bearer ${userJwt}`)
      .query({
        client_id: 'zulip',
        response_type: 'code',
        redirect_uri: 'http://127.0.0.1:9991/complete/oidc',
      });

    const code = new URL(authRes.headers.location).searchParams.get('code');

    const tokenRes = await request(app)
      .post('/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code,
        client_id: 'zulip',
        redirect_uri: 'http://127.0.0.1:9991/complete/oidc',
      });

    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body).toHaveProperty('access_token');
    expect(tokenRes.body.token_type).toBe('Bearer');
  });

  it('GET /oauth/userinfo returns OIDC user identity claims', async () => {
    const res = await request(app)
      .get('/oauth/userinfo')
      .set('Authorization', `Bearer ${userJwt}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('sso@company.com');
    expect(res.body.name).toBe('SSO User');
    expect(res.body.sub).toBeDefined();
  });

  it('redirects safely without code when no user identity or matching cookie is provided', async () => {
    const res = await request(app)
      .get('/oauth/authorize')
      .query({
        client_id: 'attendance-app',
        response_type: 'code',
        redirect_uri: 'http://localhost:3300',
      });

    expect(res.status).toBe(302);
    // MUST redirect to login page WITHOUT code
    expect(res.headers.location).toBe('http://localhost:3300');
    expect(res.headers.location).not.toContain('code=');
  });


  it('strictly isolates per-browser sessions using sessionid cookie without cross-user leakage', async () => {
    // Create Employee 1 & Employee 2 in database
    await pool.query(
      `INSERT INTO employees (full_name, email, zulip_user_id, zulip_provisioned)
       VALUES ('Browser User One', 'browser1@company.com', 201, true)
       RETURNING id`
    );
    await pool.query(
      `INSERT INTO employees (full_name, email, zulip_user_id, zulip_provisioned)
       VALUES ('Browser User Two', 'browser2@company.com', 202, true)
       RETURNING id`
    );


    // Mock getZulipUserBySessionKey to return exact session mapping
    const { zulipService } = await import('../src/services/zulip.service');
    const spy = vi.spyOn(zulipService, 'getZulipUserBySessionKey').mockImplementation(async (key?: string) => {
      if (key === 'browser_session_1') return { email: 'browser1@company.com', zulipUserId: 201 };
      if (key === 'browser_session_2') return { email: 'browser2@company.com', zulipUserId: 202 };
      return null;
    });

    // Browser 1 sends Cookie: sessionid=browser_session_1
    const authRes1 = await request(app)
      .get('/oauth/authorize')
      .set('Cookie', 'sessionid=browser_session_1')
      .query({
        client_id: 'attendance-app',
        response_type: 'code',
        redirect_uri: 'http://localhost:3300',
      });

    expect(authRes1.status).toBe(302);
    const code1 = new URL(authRes1.headers.location).searchParams.get('code')!;

    const tokenRes1 = await request(app)
      .post('/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code: code1,
        client_id: 'attendance-app',
        redirect_uri: 'http://localhost:3300',
      });
    const user1 = await request(app)
      .get('/oauth/userinfo')
      .set('Authorization', `Bearer ${tokenRes1.body.access_token}`);

    expect(user1.body.email).toBe('browser1@company.com');
    expect(user1.body.name).toBe('Browser User One');

    // Browser 2 sends Cookie: sessionid=browser_session_2
    const authRes2 = await request(app)
      .get('/oauth/authorize')
      .set('Cookie', 'sessionid=browser_session_2')
      .query({
        client_id: 'attendance-app',
        response_type: 'code',
        redirect_uri: 'http://localhost:3300',
      });

    expect(authRes2.status).toBe(302);
    const code2 = new URL(authRes2.headers.location).searchParams.get('code')!;

    const tokenRes2 = await request(app)
      .post('/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code: code2,
        client_id: 'attendance-app',
        redirect_uri: 'http://localhost:3300',
      });
    const user2 = await request(app)
      .get('/oauth/userinfo')
      .set('Authorization', `Bearer ${tokenRes2.body.access_token}`);

    expect(user2.body.email).toBe('browser2@company.com');
    expect(user2.body.name).toBe('Browser User Two');

    // Verify complete multi-browser isolation
    expect(user1.body.email).not.toBe(user2.body.email);

    spy.mockRestore();
  });

  it('supports session_key query parameter for SSO authorization and prevents leakage on logged-out sessions', async () => {
    await pool.query(
      `INSERT INTO employees (full_name, email, zulip_user_id, zulip_provisioned)
       VALUES ('User B', 'userB@company.com', 302, true)
       ON CONFLICT (email) DO NOTHING`
    );

    const { zulipService } = await import('../src/services/zulip.service');
    const spy = vi.spyOn(zulipService, 'getZulipUserBySessionKey').mockImplementation(async (key?: string) => {
      if (key === 'valid_user_B_session') return { email: 'userB@company.com', zulipUserId: 302 };
      return null;
    });

    // Valid session key in query param
    const authRes = await request(app)
      .get('/oauth/authorize')
      .query({
        client_id: 'attendance-app',
        response_type: 'code',
        redirect_uri: 'http://localhost:3300',
        session_key: 'valid_user_B_session',
      });

    expect(authRes.status).toBe(302);
    expect(authRes.headers.location).toMatch(/^http:\/\/localhost:3300\/?\?code=/);
    const code = new URL(authRes.headers.location).searchParams.get('code')!;

    const tokenRes = await request(app)
      .post('/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code,
        client_id: 'attendance-app',
        redirect_uri: 'http://localhost:3300',
      });

    const userinfo = await request(app)
      .get('/oauth/userinfo')
      .set('Authorization', `Bearer ${tokenRes.body.access_token}`);

    expect(userinfo.body.email).toBe('userB@company.com');

    // Invalid or logged-out session key -> MUST NOT generate auth code
    const invalidRes = await request(app)
      .get('/oauth/authorize')
      .query({
        client_id: 'attendance-app',
        response_type: 'code',
        redirect_uri: 'http://localhost:3300',
        session_key: 'logged_out_session_A',
      });

    expect(invalidRes.status).toBe(302);
    expect(invalidRes.headers.location).toBe('http://localhost:3300');
    expect(invalidRes.headers.location).not.toContain('code=');

    spy.mockRestore();
  });

  it('refuses to guess user identity when session_key or cookie is missing, preventing cross-user session leakage', async () => {
    await pool.query(
      `INSERT INTO employees (full_name, email, zulip_user_id, zulip_provisioned)
       VALUES ('Winter User', 'winter@gmail.com', 404, true)
       ON CONFLICT (email) DO NOTHING`
    );

    // Call GET /oauth/authorize with no session_key, no cookie, no email
    const authRes = await request(app)
      .get('/oauth/authorize')
      .query({
        client_id: 'attendance-app',
        response_type: 'code',
        redirect_uri: 'http://localhost:3300',
      });

    // MUST redirect to login page WITHOUT code parameter (does NOT guess Winter or Denver)
    expect(authRes.status).toBe(302);
    expect(authRes.headers.location).toBe('http://localhost:3300');
    expect(authRes.headers.location).not.toContain('code=');
  });
});





