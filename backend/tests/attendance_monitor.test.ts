import { describe, it, expect, beforeEach } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';
import { runMigrations } from '../scripts/migrate';
import { runSeed } from '../scripts/seed';

describe('GET /api/attendance/monitor & JOINed Employee Audits Integration Test', () => {
  let adminToken: string;
  let employeeToken: string;

  beforeEach(async () => {
    await runMigrations();
    await runSeed();

    const adminLogin = await supertest(app).post('/api/auth/login').send({
      email: 'admin@company.com',
      password: 'AdminPassword123!',
    });
    adminToken = adminLogin.body.access_token;

    const empLogin = await supertest(app).post('/api/auth/login').send({
      email: 'john.doe@jdconnect.com',
      password: 'Employee123!',
    });
    employeeToken = empLogin.body.access_token;
  });

  it('returns live workforce monitor metrics', async () => {
    // Clock in employee
    await supertest(app)
      .post('/api/attendance/clock-in')
      .set('Authorization', `Bearer ${employeeToken}`);

    const res = await supertest(app)
      .get('/api/attendance/monitor')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('working_count');
    expect(res.body).toHaveProperty('on_break_count');
    expect(res.body).toHaveProperty('total_clocked_in');
    expect(res.body.total_clocked_in).toBeGreaterThanOrEqual(1);
    expect(res.body.working_count).toBeGreaterThanOrEqual(1);
  });

  it('returns employee names and details in attendance audit logs', async () => {
    await supertest(app)
      .post('/api/attendance/clock-in')
      .set('Authorization', `Bearer ${employeeToken}`);

    const res = await supertest(app)
      .get('/api/attendance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('employee_name');
    expect(res.body[0].employee_name).toBe('John Doe');
  });
});
