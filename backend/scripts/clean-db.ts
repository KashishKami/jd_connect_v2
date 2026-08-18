import pool from '../src/lib/db';

async function main() {
  const client = await pool.connect();
  try {
    console.log('Truncating tables in development database...');
    await client.query(`
      TRUNCATE users, employees, employee_sessions, 
               attendance_records, attendance_corrections, attendance_audit_logs,
               break_records, break_requests, break_audit_logs, audit_logs CASCADE
    `);
    console.log('Database cleaned successfully.');
  } catch (err) {
    console.error('Failed to clean database:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
