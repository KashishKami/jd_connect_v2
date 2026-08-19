/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { parseSqlDump } from '../src/lib/copy-parser';


export function deriveTempPassword(oldId: string | null): string {
  if (!oldId) return 'TempPass@1234!';
  const clean = oldId.replace(/-/g, '').slice(-4);
  return `TempPass@${clean}!`;
}

async function main() {
  const dumpPath = 'C:\\Users\\Administrator\\Desktop\\jdconnect_public_data.sql';
  const data = await parseSqlDump(dumpPath);
  const legacyEmployees = data['employees'] || [];

  const lines = ['email,temporary_password'];
  for (const emp of legacyEmployees) {
    if (emp.email) {
      const email = emp.email.toLowerCase().trim();
      const pass = deriveTempPassword(emp.auth_user_id || emp.id || null);
      lines.push(`${email},${pass}`);
    }
  }

  const csvPath = path.resolve(__dirname, '../../migration_passwords.csv');
  fs.writeFileSync(csvPath, lines.join('\n'), 'utf-8');
  console.log(`Successfully exported ${lines.length - 1} employee credentials to ${csvPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
