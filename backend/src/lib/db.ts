import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === 'test'
    ? 'postgres://jduser:jdpassword@127.0.0.1:5432/jdconnect_test'
    : 'postgres://jduser:jdpassword@127.0.0.1:5432/jdconnect');

const pool = new Pool({
  connectionString,
});

export default pool;
