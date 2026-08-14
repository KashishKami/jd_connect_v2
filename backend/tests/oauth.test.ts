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
});
