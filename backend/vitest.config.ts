import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';

// Automatically load .env.test for test suite executions
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    passWithNoTests: true,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://jduser:jdpassword@127.0.0.1:5432/jdconnect_test?schema=public',
    },
  },
});
