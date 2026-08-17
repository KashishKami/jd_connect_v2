import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';

describe('GET /api/attendance/status - Attendance & Shift Status Integration Test', () => {
  let employeeToken: string;

  beforeEach(async () => {
    await runMigrations();
    await runSeed();

    const loginRes = await supertest(app).post('/api/auth/login').send({
      email: 'john.doe@jdconnect.com',
      password: 'Employee123!',
    });

    employeeToken = loginRes.body.access_token;
  });

  it('returns off_shift status when employee has not clocked in today', async () => {
    const res = await supertest(app)
      .get('/api/attendance/status')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('off_shift');
  });

  it('returns clocked_in status when employee is currently clocked in', async () => {
    // Clock in first
    const clockInRes = await supertest(app)
      .post('/api/attendance/clock-in')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(clockInRes.status).toBe(201);

    const statusRes = await supertest(app)
      .get('/api/attendance/status')
      .set('Authorization', `Bearer ${employeeToken}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('clocked_in');
    expect(statusRes.body).toHaveProperty('clock_in_at');
  });
});
