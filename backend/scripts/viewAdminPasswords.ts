import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { getDbPool, sql } from '../src/config/db';

function decryptERPPassword(rawPass?: string | null): { shifted: string; reversed: string; clean: string } {
  if (!rawPass) return { shifted: '', reversed: '', clean: '' };
  // 1. Remove non-printable control characters (\x00-\x1F, \x7F)
  const clean = rawPass.replace(/[\x00-\x1F\x7F]/g, '');
  // 2. Subtract 4 from ASCII of each character
  const shifted = [...clean].map((c) => String.fromCharCode(c.charCodeAt(0) - 4)).join('');
  // 3. Reversed
  const reversed = [...shifted].reverse().join('');
  return { shifted, reversed, clean };
}

async function main() {
  const argCode = process.argv[2];
  const allowedCodesRaw = process.env.ALLOWED_ADMIN_CODES || '';

  let targetCodes: string[] = [];

  if (argCode) {
    targetCodes = [argCode.trim()];
  } else if (allowedCodesRaw.trim()) {
    targetCodes = allowedCodesRaw.split(',').map((c) => c.trim()).filter(Boolean);
  } else {
    console.log('No EmployeeCode specified and ALLOWED_ADMIN_CODES is empty in .env');
    console.log('Usage: npx ts-node scripts/viewAdminPasswords.ts [EmployeeCode]');
    process.exit(1);
  }

  console.log(`\nChecking passwords for Employee Codes: ${targetCodes.join(', ')} ...\n`);

  try {
    const pool = await getDbPool();
    const req = pool.request();

    // Build parameterized IN query
    const paramNames = targetCodes.map((_, i) => `@c${i}`);
    targetCodes.forEach((code, i) => {
      req.input(`c${i}`, sql.NVarChar, code);
    });

    const result = await req.query(`
      SELECT 
        CAST(EmployeeId AS NVARCHAR(50)) AS EmployeeId,
        CAST(EmployeeCode AS NVARCHAR(50)) AS EmployeeCode,
        EmployeeName,
        ContactNo,
        Pass,
        EmpStatus
      FROM MasterEmployee
      WHERE CAST(EmployeeCode AS NVARCHAR(50)) IN (${paramNames.join(', ')})
         OR CAST(EmployeeId AS NVARCHAR(50)) IN (${paramNames.join(', ')})
    `);

    if (result.recordset.length === 0) {
      console.log('No matching employees found in MasterEmployee.');
      process.exit(0);
    }

    console.table(
      result.recordset.map((emp) => {
        const { shifted, reversed, clean } = decryptERPPassword(emp.Pass);
        // Usually the password is shifted, or reversed if it's words like "happy"
        const likelyPassword = shifted === reversed ? shifted : `${shifted} (or ${reversed})`;
        return {
          'Employee Code': emp.EmployeeCode,
          'Employee Name': emp.EmployeeName,
          'Decrypted Password': likelyPassword,
          'Clean Text': clean,
          Status: emp.EmpStatus,
        };
      })
    );

    console.log('\nUse the "Decrypted Password" shown above to log in to the Admin Portal.\n');
    process.exit(0);
  } catch (err) {
    console.error('Error querying MasterEmployee:', err);
    process.exit(1);
  }
}

main();
