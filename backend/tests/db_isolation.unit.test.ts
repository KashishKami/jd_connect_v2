import { describe, it, expect } from 'vitest';

describe('Test Database Isolation Config Unit Test', () => {
  it('confirms process.env.NODE_ENV === "test"', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('confirms database URL connects to jdconnect_test', () => {
    const dbUrl = process.env.DATABASE_URL || '';
    expect(dbUrl).toContain('jdconnect_test');
  });
});
