import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDbPool, sql } from '../config/db';
import { TABLES } from '../config/constants';

export interface AuthPayload {
  role: 'admin' | 'supplier';
  loginId: number | string;
  name: string;
  partyId?: string; // Present only for suppliers
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Authorization token required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET as string;

  try {
    const decoded = jwt.verify(token, secret) as AuthPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const requireRole = (expectedRole: 'admin' | 'supplier') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    if (req.user.role !== expectedRole) {
      res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
      return;
    }

    try {
      const pool = await getDbPool();

      if (expectedRole === 'supplier') {
        if (!req.user.partyId) {
          res.status(403).json({ message: 'Forbidden: Missing supplier context' });
          return;
        }

        const result = await pool
          .request()
          .input('partyId', sql.NVarChar, String(req.user.partyId))
          .query(`SELECT TOP 1 is_active, must_change_pwd FROM ${TABLES.SUPPLIER_LOGIN} WHERE party_id = @partyId`);

        if (result.recordset.length === 0 || !result.recordset[0].is_active) {
          res.status(403).json({ message: 'Account disabled' });
          return;
        }

        if (result.recordset[0].must_change_pwd) {
          res.status(403).json({ message: 'Password change required' });
          return;
        }
      } else if (expectedRole === 'admin') {
        const result = await pool
          .request()
          .input('id', sql.NVarChar, String(req.user.loginId))
          .query(`
            SELECT TOP 1 EmpStatus
            FROM MasterEmployee
            WHERE CAST(EmployeeId AS NVARCHAR(50)) = @id
          `);

        if (result.recordset.length === 0 || (result.recordset[0].EmpStatus && result.recordset[0].EmpStatus !== 'Live')) {
          res.status(403).json({ message: 'Account disabled' });
          return;
        }
      }

      next();
    } catch (err) {
      console.error('requireRole error:', err);
      res.status(500).json({ message: 'Internal server error verifying account' });
    }
  };
};
