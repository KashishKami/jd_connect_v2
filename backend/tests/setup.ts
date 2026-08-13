import { beforeAll, beforeEach, afterAll } from 'vitest';
import dotenv from 'dotenv';
import path from 'path';

// Ensure .env.test is loaded before test hooks execute
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

beforeAll(async () => {
  // Global test setup: verify test database URL points to jdconnect_test
  if (!process.env.DATABASE_URL?.includes('jdconnect_test')) {
    console.warn('WARN: Test suite should run against jdconnect_test database!');
  }
});

beforeEach(async () => {
  // Hook for resetting database state between test runs
});

afterAll(async () => {
  // Hook for closing DB connection pools
});
