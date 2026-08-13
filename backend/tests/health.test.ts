import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import app from '../src/app';

describe('GET /health', () => {
  it('returns 200 OK with status ok', async () => {
    const res = await supertest(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
