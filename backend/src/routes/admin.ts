import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import ExcelJS from 'exceljs';
import { getDbPool, sql } from '../config/db';
import { TABLES, COLUMNS } from '../config/constants';
import { verifyToken, requireRole } from '../middleware/auth';
import { WO_SOURCE } from '../config/workOrderSource';

const router = Router();

// Strict security: all /admin routes require authenticated admin token
router.use(verifyToken);
router.use(requireRole('admin'));

const calculateStatus = (completedQty: number, orderQty: number): 'Received' | 'In Progress' | 'Completed' => {
  if (completedQty <= 0) return 'Received';
  if (completedQty >= orderQty) return 'Completed';
  return 'In Progress';
};

// 1. GET /admin/suppliers
// Returns list of suppliers with portal credentials status
router.get('/suppliers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const pool = await getDbPool();

    const query = `
      SELECT DISTINCT
        CAST(p.${COLUMNS.MASTER_PARTY.PARTY_ID} AS NVARCHAR(50)) AS partyId,
        p.${COLUMNS.MASTER_PARTY.PARTY_NAME} AS name,
        ISNULL(p.${COLUMNS.PARTY_GST.GST_NO}, '') AS gstNo,
        CASE WHEN l.id IS NOT NULL THEN l.is_active ELSE 0 END AS isActive,
        CASE WHEN l.id IS NOT NULL THEN 1 ELSE 0 END AS hasPassword
      FROM ${TABLES.MASTER_PARTY} p
      INNER JOIN TableMerchLock m
        ON m.TitleHead LIKE '31A%' AND (m.PartyName = p.${COLUMNS.MASTER_PARTY.PARTY_NAME} OR m.PartyName = REPLACE(REPLACE(p.${COLUMNS.MASTER_PARTY.PARTY_NAME}, ' INDUSTRIES PVT LTD', ''), ' INDUSTRIES PRIVATE LIMITED', ''))
      LEFT JOIN ${TABLES.SUPPLIER_LOGIN} l
        ON CAST(p.${COLUMNS.MASTER_PARTY.PARTY_ID} AS NVARCHAR(50)) = l.party_id
      WHERE p.${COLUMNS.PARTY_GST.GST_NO} IS NOT NULL AND p.${COLUMNS.PARTY_GST.GST_NO} <> ''
      ORDER BY p.${COLUMNS.MASTER_PARTY.PARTY_NAME} ASC
    `;

    const result = await pool.request().query(query);
    res.json(result.recordset);
  } catch (error) {
    console.error('Error retrieving suppliers:', error);
    res.status(500).json({ message: 'Internal server error retrieving suppliers' });
  }
});

// 2. POST /admin/suppliers/login
// Create credentials for a supplier (must_change_pwd = 1, created_by = admin)
router.post('/suppliers/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { partyId, password } = req.body;

    if (!partyId || !password) {
      res.status(400).json({ message: 'partyId and password are required' });
      return;
    }

    const stringPartyId = String(partyId).trim();

    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters long' });
      return;
    }

    const pool = await getDbPool();

    // Check if supplier login already exists
    const existingCheck = await pool
      .request()
      .input('partyId', sql.NVarChar, stringPartyId)
      .query(`SELECT TOP 1 id FROM ${TABLES.SUPPLIER_LOGIN} WHERE party_id = @partyId`);

    if (existingCheck.recordset.length > 0) {
      res.status(409).json({ message: 'Supplier login already exists for this party' });
      return;
    }

    // Get GST number from Party GST table
    const gstResult = await pool
      .request()
      .input('partyId', sql.NVarChar, stringPartyId)
      .query(`
        SELECT TOP 1 ${COLUMNS.PARTY_GST.GST_NO} AS gstNo
        FROM ${TABLES.PARTY_GST}
        WHERE CAST(${COLUMNS.PARTY_GST.PARTY_ID} AS NVARCHAR(50)) = @partyId
      `);

    if (gstResult.recordset.length === 0 || !gstResult.recordset[0].gstNo) {
      res.status(404).json({ message: 'GST number not found for this supplier' });
      return;
    }

    const gstNo = gstResult.recordset[0].gstNo;
    const passwordHash = await bcrypt.hash(password, 10);
    const createdBy = String(req.user?.loginId || req.user?.name || 'admin');

    // Insert new supplier login
    await pool
      .request()
      .input('partyId', sql.NVarChar, stringPartyId)
      .input('gstNo', sql.NVarChar, gstNo)
      .input('passwordHash', sql.NVarChar, passwordHash)
      .input('createdBy', sql.NVarChar, createdBy)
      .query(`
        INSERT INTO ${TABLES.SUPPLIER_LOGIN}
          (party_id, gst_no, password_hash, is_active, must_change_pwd, created_by, created_on)
        VALUES
          (@partyId, @gstNo, @passwordHash, 1, 1, @createdBy, GETDATE())
      `);

    res.status(201).json({
      message: 'Supplier login created successfully',
      partyId: stringPartyId,
      gstNo,
      isActive: true,
      hasPassword: true,
    });
  } catch (error) {
    console.error('Error creating supplier login:', error);
    res.status(500).json({ message: 'Internal server error creating supplier login' });
  }
});

// 3. PUT /admin/suppliers/password
// Reset supplier password (must_change_pwd = 1)
router.put('/suppliers/password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { partyId, password } = req.body;

    if (!partyId || !password) {
      res.status(400).json({ message: 'partyId and password are required' });
      return;
    }

    const stringPartyId = String(partyId).trim();

    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ message: 'Password must be at least 8 characters long' });
      return;
    }

    const pool = await getDbPool();

    // Confirm supplier login exists
    const existingCheck = await pool
      .request()
      .input('partyId', sql.NVarChar, stringPartyId)
      .query(`SELECT TOP 1 id FROM ${TABLES.SUPPLIER_LOGIN} WHERE party_id = @partyId`);

    if (existingCheck.recordset.length === 0) {
      res.status(404).json({ message: 'Supplier login account not found' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Update password and enforce password change on next login
    await pool
      .request()
      .input('partyId', sql.NVarChar, stringPartyId)
      .input('passwordHash', sql.NVarChar, passwordHash)
      .query(`
        UPDATE ${TABLES.SUPPLIER_LOGIN}
        SET password_hash = @passwordHash, must_change_pwd = 1
        WHERE party_id = @partyId
      `);

    res.json({ message: 'Supplier password reset successfully', partyId: stringPartyId });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Internal server error resetting password' });
  }
});

// 4. PUT /admin/suppliers/active
// Activate / deactivate supplier login
router.put('/suppliers/active', async (req: Request, res: Response): Promise<void> => {
  try {
    const { partyId, isActive } = req.body;

    if (!partyId) {
      res.status(400).json({ message: 'partyId is required' });
      return;
    }

    const stringPartyId = String(partyId).trim();

    const pool = await getDbPool();

    // Find current status if isActive not explicitly boolean
    const checkResult = await pool
      .request()
      .input('partyId', sql.NVarChar, stringPartyId)
      .query(`SELECT TOP 1 is_active FROM ${TABLES.SUPPLIER_LOGIN} WHERE party_id = @partyId`);

    if (checkResult.recordset.length === 0) {
      res.status(404).json({ message: 'Supplier login account not found' });
      return;
    }

    const newActiveState =
      typeof isActive === 'boolean' ? isActive : !checkResult.recordset[0].is_active;

    await pool
      .request()
      .input('partyId', sql.NVarChar, stringPartyId)
      .input('isActive', sql.Bit, newActiveState ? 1 : 0)
      .query(`
        UPDATE ${TABLES.SUPPLIER_LOGIN}
        SET is_active = @isActive
        WHERE party_id = @partyId
      `);

    res.json({
      message: `Supplier successfully ${newActiveState ? 'activated' : 'deactivated'}`,
      partyId: stringPartyId,
      isActive: newActiveState,
    });
  } catch (error) {
    console.error('Error toggling supplier status:', error);
    res.status(500).json({ message: 'Internal server error toggling supplier status' });
  }
});

// POST /admin/completion/reverse
// Reverse a wrong completion entry
router.post('/completion/reverse', async (req: Request, res: Response): Promise<void> => {
  try {
    const { woNo, partyId, qty, reason } = req.body;
    const numQty = Number(qty);

    if (!woNo || !partyId || !reason || typeof reason !== 'string' || !reason.trim()) {
      res.status(400).json({ message: 'woNo, partyId, and non-empty reason are required' });
      return;
    }

    if (isNaN(numQty) || numQty <= 0) {
      res.status(400).json({ message: 'Qty to reverse must be greater than 0' });
      return;
    }

    const pool = await getDbPool();

    // Check current total completed for that wo and party
    const totalResult = await pool
      .request()
      .input('woNo', sql.NVarChar, String(woNo).trim())
      .input('partyId', sql.NVarChar, String(partyId).trim())
      .query(`
        SELECT ISNULL(SUM(completed_qty), 0) AS totalCompleted
        FROM ${TABLES.WO_COMPLETION_UPDATE}
        WHERE wo_no = @woNo AND party_id = @partyId
      `);

    const currentTotal = Number(totalResult.recordset[0]?.totalCompleted || 0);

    if (numQty > currentTotal) {
      res.status(400).json({
        message: `Cannot reverse ${numQty}: current total completed is only ${currentTotal}`,
      });
      return;
    }

    const updatedBy = String(req.user?.loginId || req.user?.name || 'admin');

    await pool
      .request()
      .input('woNo', sql.NVarChar, String(woNo).trim())
      .input('partyId', sql.NVarChar, String(partyId).trim())
      .input('revQty', sql.Decimal(18, 2), -numQty)
      .input('remarks', sql.NVarChar, `REVERSAL: ${reason.trim()}`)
      .input('updatedBy', sql.NVarChar, updatedBy)
      .query(`
        INSERT INTO ${TABLES.WO_COMPLETION_UPDATE}
          (wo_no, party_id, completed_qty, remarks, updated_on, updated_by)
        VALUES
          (@woNo, @partyId, @revQty, @remarks, GETDATE(), @updatedBy)
      `);

    res.json({ message: `Successfully reversed ${numQty} for WO ${woNo}` });
  } catch (error) {
    console.error('Error reversing completion:', error);
    res.status(500).json({ message: 'Internal server error reversing completion' });
  }
});

// 5. GET /admin/status?supplier=&from=&to=&woNo=
// Returns all completion updates with supplier name and filters
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const supplier = req.query.supplier as string;
    const from = req.query.from as string;
    const to = req.query.to as string;
    const woNo = req.query.woNo as string;

    const pool = await getDbPool();
    const request = pool.request();

    let whereClause = 'WHERE 1=1';

    if (supplier && supplier !== 'ALL') {
      request.input('supplier', sql.NVarChar, supplier);
      whereClause += ` AND (c.party_id = @supplier OR g.${COLUMNS.PARTY_GST.GST_NO} = @supplier)`;
    }

    if (woNo && woNo.trim()) {
      request.input('woNo', sql.NVarChar, `%${woNo.trim()}%`);
      whereClause += ' AND c.wo_no LIKE @woNo';
    }

    if (from) {
      request.input('from', sql.NVarChar, from);
      whereClause += ' AND CONVERT(VARCHAR(10), c.updated_on, 120) >= @from';
    }

    if (to) {
      request.input('to', sql.NVarChar, to);
      whereClause += ' AND CONVERT(VARCHAR(10), c.updated_on, 120) <= @to';
    }

    const query = `
      SELECT
        c.id,
        c.wo_no AS woNo,
        c.party_id AS partyId,
        p.${COLUMNS.MASTER_PARTY.PARTY_NAME} AS partyName,
        w.foNo AS fono,
        w.process,
        w.uom,
        w.orderQty,
        c.completed_qty AS qty,
        SUM(c.completed_qty) OVER (PARTITION BY c.wo_no, c.party_id ORDER BY c.updated_on, c.id) AS runningTotal,
        c.remarks,
        CONVERT(VARCHAR(16), c.updated_on, 120) AS updatedOn
      FROM ${TABLES.WO_COMPLETION_UPDATE} c
      LEFT JOIN ${TABLES.MASTER_PARTY} p
        ON c.party_id = CAST(p.${COLUMNS.MASTER_PARTY.PARTY_ID} AS NVARCHAR(50))
      LEFT JOIN ${TABLES.PARTY_GST} g
        ON c.party_id = CAST(g.${COLUMNS.PARTY_GST.PARTY_ID} AS NVARCHAR(50))
      OUTER APPLY (
        SELECT TOP 1
          w.foNo,
          w.process,
          w.uom,
          w.orderQty
        FROM (${WO_SOURCE}) w
        WHERE w.woNo = c.wo_no
      ) w
      ${whereClause}
      ORDER BY c.updated_on DESC, c.id DESC
    `;

    const result = await request.query(query);

    // Calculate status per item
    const logs = result.recordset.map((row) => {
      const orderQty = Number(row.orderQty || 0);
      const qty = Number(row.qty || 0);
      const runningTotal = Number(row.runningTotal || 0);

      return {
        woNo: row.woNo,
        partyName: row.partyName || '—',
        partyId: row.partyId,
        fono: row.fono || '—',
        process: row.process || '—',
        qty,
        runningTotal,
        uom: row.uom || '',
        status: orderQty <= 0 ? 'Received' : calculateStatus(runningTotal, orderQty),
        remarks: row.remarks || '—',
        updatedOn: row.updatedOn,
      };
    });

    res.json(logs);
  } catch (error) {
    console.error('Error fetching status updates:', error);
    res.status(500).json({ message: 'Internal server error fetching status updates' });
  }
});

// Helper for Admin report queries
const getAdminReportRows = async (supplier?: string, from?: string, to?: string, statusFilter?: string) => {
  const pool = await getDbPool();
  const request = pool.request();

  let whereClause = 'WHERE 1=1';

  if (supplier && supplier !== 'ALL') {
    request.input('supplier', sql.NVarChar, supplier);
    whereClause += ` AND (CAST(w.partyId AS NVARCHAR(50)) = @supplier
      OR (w.partyId IS NULL AND w.partyName = (SELECT TOP 1 ${COLUMNS.MASTER_PARTY.PARTY_NAME} FROM ${TABLES.MASTER_PARTY}
                        WHERE CAST(${COLUMNS.MASTER_PARTY.PARTY_ID} AS NVARCHAR(50)) = @supplier)))`;
  }

  if (from) {
    request.input('from', sql.NVarChar, from);
    whereClause += ' AND c.last_update IS NOT NULL AND CONVERT(VARCHAR(10), c.last_update, 120) >= @from';
  }

  if (to) {
    request.input('to', sql.NVarChar, to);
    whereClause += ' AND c.last_update IS NOT NULL AND CONVERT(VARCHAR(10), c.last_update, 120) <= @to';
  }

  if (statusFilter && statusFilter !== 'ALL') {
    request.input('statusFilter', sql.NVarChar, statusFilter);
    whereClause += ` AND (
      CASE
        WHEN ISNULL(c.total_completed, 0) <= 0 THEN 'Received'
        WHEN ISNULL(c.total_completed, 0) >= w.orderQty THEN 'Completed'
        ELSE 'In Progress'
      END = @statusFilter
    )`;
  }

  const query = `
    SELECT w.woNo, w.partyName, w.foNo, w.merchName, w.process, w.unit,
           w.orderQty, w.uom, w.delayDays,
           ISNULL(c.total_completed, 0) AS completedQty,
           ISNULL(c.last_update, '—') AS lastUpdate,
           CASE
             WHEN ISNULL(c.total_completed, 0) <= 0 THEN 'Received'
             WHEN ISNULL(c.total_completed, 0) >= w.orderQty THEN 'Completed'
             ELSE 'In Progress'
           END AS status
    FROM (${WO_SOURCE}) w
    LEFT JOIN (
      SELECT wo_no, SUM(completed_qty) AS total_completed,
             CONVERT(VARCHAR(16), MAX(updated_on), 120) AS last_update
      FROM ${TABLES.WO_COMPLETION_UPDATE}
      GROUP BY wo_no
    ) c ON w.woNo = c.wo_no
    ${whereClause}
    ORDER BY w.woNo DESC
  `;

  const result = await request.query(query);

  return result.recordset.map((row) => {
    const orderQty = Number(row.orderQty);
    const completedQty = Number(row.completedQty);
    const balanceQty = Math.max(0, orderQty - completedQty);

    return {
      woNo: row.woNo,
      partyName: row.partyName,
      foNo: row.foNo,
      fono: row.foNo,
      merchName: row.merchName,
      process: row.process,
      unit: row.unit,
      unitName: row.unit,
      orderQty,
      qty: orderQty,
      completedQty,
      balanceQty,
      uom: row.uom || '',
      delayDays: row.delayDays,
      status: row.status,
      lastUpdate: row.lastUpdate,
    };
  });
};

// 6. GET /admin/reports?from=&to=&supplier=&status=
router.get('/reports', async (req: Request, res: Response): Promise<void> => {
  try {
    const supplier = req.query.supplier as string;
    const from = req.query.from as string;
    const to = req.query.to as string;
    const status = req.query.status as string;

    const rows = await getAdminReportRows(supplier, from, to, status);
    res.json(rows);
  } catch (error) {
    console.error('Error generating admin report:', error);
    res.status(500).json({ message: 'Internal server error generating admin report' });
  }
});

// 7. GET /admin/reports/download (Excel export)
router.get('/reports/download', async (req: Request, res: Response): Promise<void> => {
  try {
    const supplier = req.query.supplier as string;
    const from = req.query.from as string;
    const to = req.query.to as string;
    const status = req.query.status as string;

    const rows = await getAdminReportRows(supplier, from, to, status);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Company Work Order Report');

    worksheet.columns = [
      { header: 'WO No', key: 'woNo', width: 22 },
      { header: 'Supplier Party', key: 'partyName', width: 28 },
      { header: 'FO No', key: 'foNo', width: 14 },
      { header: 'Merchandiser', key: 'merchName', width: 18 },
      { header: 'Process', key: 'process', width: 18 },
      { header: 'Unit', key: 'unit', width: 20 },
      { header: 'Order Qty', key: 'orderQty', width: 14 },
      { header: 'Completed Qty', key: 'completedQty', width: 16 },
      { header: 'Balance Qty', key: 'balanceQty', width: 14 },
      { header: 'Delay Days', key: 'delayDays', width: 12 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Last Update', key: 'lastUpdate', width: 20 },
    ];

    // Format header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };

    rows.forEach((row) => {
      worksheet.addRow(row);
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=Admin_Work_Order_Report.xlsx'
    );

    await workbook.xlsx.write(res);
  } catch (error) {
    console.error('Error exporting admin Excel report:', error);
    res.status(500).json({ message: 'Internal server error exporting admin Excel report' });
  }
});

export default router;
