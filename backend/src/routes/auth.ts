import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { getDbPool, sql } from '../config/db';
import { TABLES, COLUMNS } from '../config/constants';
import { verifyToken, AuthPayload } from '../middleware/auth';

const router = Router();

// Separate rate limiters
const supplierLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many supplier login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});



const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many admin login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { message: 'Too many password change attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /auth/supplier-login
router.post('/supplier-login', supplierLoginLimiter, async (req: Request, res: Response): Promise<void> => {
  const genericErrorMessage = 'Invalid GST or password';

  try {
    const { gstNo, password } = req.body;

    if (!gstNo || !password) {
      res.status(401).json({ message: genericErrorMessage });
      return;
    }

    const pool = await getDbPool();

    // 1. Find active SUPPLIER_LOGIN rows matching this GST (supports multiple party IDs per GST)
    const loginResult = await pool
      .request()
      .input('gstNo', sql.NVarChar, gstNo.trim())
      .query(`
        SELECT
          l.id,
          l.party_id,
          l.password_hash,
          l.is_active,
          l.must_change_pwd,
          p.${COLUMNS.MASTER_PARTY.PARTY_NAME} AS party_name
        FROM ${TABLES.SUPPLIER_LOGIN} l
        INNER JOIN ${TABLES.MASTER_PARTY} p
          ON l.party_id = CAST(p.${COLUMNS.MASTER_PARTY.PARTY_ID} AS NVARCHAR(50))
        WHERE l.gst_no = @gstNo AND l.is_active = 1
      `);

    if (loginResult.recordset.length === 0) {
      res.status(401).json({ message: genericErrorMessage });
      return;
    }

    // 2. Compare password against all active accounts under this GST
    let matchedLogin = null;
    for (const row of loginResult.recordset) {
      const match = await bcrypt.compare(password, row.password_hash);
      if (match) {
        matchedLogin = row;
        break;
      }
    }

    if (!matchedLogin) {
      res.status(401).json({ message: genericErrorMessage });
      return;
    }

    const supplierLogin = matchedLogin;
    const partyName = matchedLogin.party_name;

    // 4. Update last_login
    await pool
      .request()
      .input('id', sql.Int, supplierLogin.id)
      .query(`UPDATE ${TABLES.SUPPLIER_LOGIN} SET last_login = GETDATE() WHERE id = @id`);

    // 5. Generate JWT token (8 hours expiry)
    const tokenPayload: AuthPayload = {
      role: 'supplier',
      partyId: supplierLogin.party_id,
      loginId: supplierLogin.id,
      name: partyName,
    };

    const secret = process.env.JWT_SECRET as string;
    const token = jwt.sign(tokenPayload, secret, { expiresIn: '8h' });

    res.json({
      token,
      name: partyName,
      role: 'supplier',
      mustChangePassword: !!supplierLogin.must_change_pwd,
    });
  } catch (error) {
    console.error('Supplier login error:', error);
    res.status(500).json({ message: 'Internal server error during supplier login' });
  }
});

// Helper function: Decrypt and verify legacy ERP password from MasterEmployee
function verifyERPPassword(inputPassword: string, dbPassword?: string | null): boolean {
  if (!inputPassword || !dbPassword) return false;
  // 1. Remove non-printable control characters (\x00-\x1F, \x7F)
  const clean = dbPassword.replace(/[\x00-\x1F\x7F]/g, '');
  // 2. Subtract 4 from ASCII of each character
  const shifted = [...clean].map((c) => String.fromCharCode(c.charCodeAt(0) - 4)).join('');
  // 3. Reversed shifted (for passwords stored in reverse order like 'happy')
  const reversed = [...shifted].reverse().join('');
  // 4. Match against input
  return inputPassword === shifted || inputPassword === reversed || inputPassword === clean;
}

// POST /auth/admin-login
router.post('/admin-login', adminLoginLimiter, async (req: Request, res: Response): Promise<void> => {
  const genericErrorMessage = 'Invalid username or password';

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(401).json({ message: genericErrorMessage });
      return;
    }

    const pool = await getDbPool();

    // Query MasterEmployee (Read-Only) by EmployeeCode, EmployeeId, EmployeeName, or ContactNo
    const result = await pool
      .request()
      .input('username', sql.NVarChar, username.trim())
      .query(`
        SELECT TOP 1
          CAST(EmployeeId AS NVARCHAR(50)) AS EmployeeId,
          CAST(EmployeeCode AS NVARCHAR(50)) AS EmployeeCode,
          EmployeeName,
          Pass,
          EmpStatus
        FROM MasterEmployee
        WHERE (
          CAST(EmployeeCode AS NVARCHAR(50)) = @username
          OR CAST(EmployeeId AS NVARCHAR(50)) = @username
          OR EmployeeName = @username
          OR ContactNo = @username
        )
        AND (EmpStatus = 'Live' OR EmpStatus IS NULL)
      `);

    if (result.recordset.length === 0) {
      res.status(401).json({ message: genericErrorMessage });
      return;
    }

    const employee = result.recordset[0];

    // Check if employee is authorized via ALLOWED_ADMIN_CODES in .env
    const allowedCodesRaw = process.env.ALLOWED_ADMIN_CODES || '';
    if (allowedCodesRaw.trim()) {
      const allowedCodes = allowedCodesRaw.split(',').map((c) => c.trim());
      const empCode = String(employee.EmployeeCode).trim();
      const empId = String(employee.EmployeeId).trim();
      if (!allowedCodes.includes(empCode) && !allowedCodes.includes(empId)) {
        res.status(403).json({ message: 'Access denied: You do not have admin permissions.' });
        return;
      }
    }

    // Verify password using legacy ERP decryption
    const match = verifyERPPassword(password, employee.Pass);
    if (!match) {
      res.status(401).json({ message: genericErrorMessage });
      return;
    }

    const adminName = employee.EmployeeName || employee.EmployeeCode;

    // Generate JWT token (8 hours expiry)
    const tokenPayload: AuthPayload = {
      role: 'admin',
      loginId: employee.EmployeeId,
      name: adminName,
    };

    const secret = process.env.JWT_SECRET as string;
    const token = jwt.sign(tokenPayload, secret, { expiresIn: '8h' });

    res.json({
      token,
      name: adminName,
      role: 'admin',
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Internal server error during admin login' });
  }
});

// POST /auth/change-password (any logged-in user)
router.post('/change-password', verifyToken, changePasswordLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || typeof oldPassword !== 'string') {
      res.status(400).json({ message: 'Current password is required' });
      return;
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters long' });
      return;
    }

    const pool = await getDbPool();
    const user = req.user!;

    if (user.role === 'admin') {
      res.status(400).json({ message: 'Admin passwords are managed directly in the ERP system.' });
      return;
    }

    let currentHash = '';
    if (user.role === 'supplier') {
      const result = await pool
        .request()
        .input('partyId', sql.NVarChar, String(user.partyId))
        .query(`SELECT TOP 1 password_hash FROM ${TABLES.SUPPLIER_LOGIN} WHERE party_id = @partyId`);
      if (result.recordset.length > 0) {
        currentHash = result.recordset[0].password_hash;
      }
    }

    if (!currentHash) {
      res.status(400).json({ message: 'User account not found' });
      return;
    }

    const match = await bcrypt.compare(oldPassword, currentHash);
    if (!match) {
      res.status(400).json({ message: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await pool
      .request()
      .input('partyId', sql.NVarChar, String(user.partyId))
      .input('hash', sql.NVarChar, newHash)
      .query(`
        UPDATE ${TABLES.SUPPLIER_LOGIN}
        SET password_hash = @hash, must_change_pwd = 0
        WHERE party_id = @partyId
      `);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ message: 'Internal server error changing password' });
  }
});

export default router;
