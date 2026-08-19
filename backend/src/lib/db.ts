import { Pool, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Parse Postgres DATE (OID 1082) as raw string "YYYY-MM-DD" to avoid node-postgres timezone shifting
types.setTypeParser(1082, (val: string) => val);

const connectionString =
  process.env.DATABASE_URL ||
  (process.env.NODE_ENV === 'test'
    ? 'postgres://jduser:jdpassword@127.0.0.1:5432/jdconnect_test'
    : 'postgres://jduser:jdpassword@127.0.0.1:5432/jdconnect');

const pool = new Pool({
  connectionString,
});


export default pool;
