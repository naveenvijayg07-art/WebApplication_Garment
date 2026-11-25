import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { getDbPool, sql } from '../config/db';
import { TABLES, COLUMNS } from '../config/constants';
import { WO_SOURCE } from '../config/workOrderSource';
import { verifyToken, requireRole } from '../middleware/auth';

const router = Router();

// Strict security: all /supplier routes require authenticated supplier token
router.use(verifyToken);
router.use(requireRole('supplier'));

// Automatic status calculation rule:
// Completed Qty = 0 -> "Received"
// Completed Qty < Order Qty -> "In Progress"
// Completed Qty = Order Qty -> "Completed"
const calculateStatus = (completedQty: number, orderQty: number): 'Received' | 'In Progress' | 'Completed' => {
  if (completedQty <= 0) return 'Received';
  if (completedQty >= orderQty) return 'Completed';
  return 'In Progress';
};

// 1. GET /supplier/work-orders
// Returns list of assigned work orders with completedQty, balanceQty, and auto status
router.get('/work-orders', async (req: Request, res: Response): Promise<void> => {
  try {
    const partyId = req.user!.partyId!;
    const partyName = req.user!.name || '';
    const pool = await getDbPool();

    const query = `
      SELECT DISTINCT
        TRY_CAST(w.woNo AS BIGINT) AS woSort,
        w.woNo,
        w.foNo AS fono,
        w.merchName,
        w.prepBy,
        w.partyName,
        w.unit AS unitName,
        w.process,
        w.orderQty,
        w.uom,
        w.delayDays,
        ISNULL(c.total_completed, 0) AS completedQty
      FROM (${WO_SOURCE}) w
      LEFT JOIN (
        SELECT wo_no, party_id, SUM(completed_qty) AS total_completed
        FROM ${TABLES.WO_COMPLETION_UPDATE}
        WHERE party_id = @partyId
        GROUP BY wo_no, party_id
      ) c ON w.woNo = c.wo_no
      WHERE (w.partyId = @partyIdNum OR (w.partyId IS NULL AND w.partyName = @partyName))
      ORDER BY woSort DESC, w.woNo DESC
    `;

    const result = await pool
      .request()
      .input('partyId', sql.NVarChar, partyId)
      .input('partyIdNum', sql.Decimal(18, 0), Number(partyId))
      .input('partyName', sql.NVarChar, partyName)
      .query(query);

    const list = result.recordset.map((row) => {
      const orderQty = Number(row.orderQty);
      const completedQty = Number(row.completedQty);
      const balanceQty = Math.max(0, orderQty - completedQty);
      const status = calculateStatus(completedQty, orderQty);

      return {
        woNo: row.woNo,
        fono: row.fono,
        merchName: row.merchName,
        prepBy: row.prepBy,
        partyName: row.partyName,
        unitName: row.unitName,
        process: row.process,
        qty: orderQty,
        orderQty,
        uom: row.uom,
        delayDays: row.delayDays,
        completedQty,
        balanceQty,
        status,
      };
    });

    res.json(list);
  } catch (error) {
    console.error('Error fetching work orders:', error);
    res.status(500).json({ message: 'Internal server error fetching work orders' });
  }
});

// 2. GET /supplier/dc?woNo=...
// Returns Delivery Challan list. Verifies ownership.
router.get('/dc', async (req: Request, res: Response): Promise<void> => {
  try {
    const woNo = req.query.woNo as string;
    const partyId = req.user!.partyId!;
    const partyName = req.user!.name || '';

    if (!woNo) {
      res.status(400).json({ message: 'Query parameter woNo is required' });
      return;
    }

    const pool = await getDbPool();

    // Fetch distinct DC details
    const result = await pool
      .request()
      .input('woNo', sql.NVarChar, woNo)
      .input('partyIdNum', sql.Decimal(18, 0), Number(partyId))
      .input('partyName', sql.NVarChar, partyName)
      .query(`
        SELECT
          CONVERT(VARCHAR(50), m.tEnno) AS dcNo,
          CONVERT(VARCHAR(10), ISNULL(m.DateandTime, GETDATE()), 120) AS dcDate,
          m.Qty AS dcQty
        FROM TableMerchLock m
        LEFT JOIN MasterParty mp ON m.PartyName = mp.Partyname
        WHERE m.TitleHead LIKE '31A%' AND m.ColourName = @woNo
          AND (mp.Partyid = @partyIdNum OR m.PartyName = @partyName)
        ORDER BY m.tEnno ASC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching DC details:', error);
    res.status(500).json({ message: 'Internal server error fetching DC details' });
  }
});

// 3. GET /supplier/history?woNo=...
// Returns completion history with date-ordered running totals. Verifies ownership.
router.get('/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const woNo = req.query.woNo as string;
    const partyId = req.user!.partyId!;

    if (!woNo) {
      res.status(400).json({ message: 'Query parameter woNo is required' });
      return;
    }

    const pool = await getDbPool();

    // Verify ownership using WO_SOURCE
    const checkOwnership = await pool
      .request()
      .input('woNo', sql.NVarChar, woNo)
      .input('partyIdNum', sql.Decimal(18, 0), Number(partyId))
      .input('partyName', sql.NVarChar, req.user!.name || '')
      .query(`
        SELECT TOP 1 1
        FROM (${WO_SOURCE}) w
        WHERE w.woNo = @woNo AND (w.partyId = @partyIdNum OR (w.partyId IS NULL AND w.partyName = @partyName))
      `);

    if (checkOwnership.recordset.length === 0) {
      res.status(403).json({ message: 'Forbidden: Work order does not belong to you' });
      return;
    }

    // Fetch completion records ordered chronologically
    const result = await pool
      .request()
      .input('woNo', sql.NVarChar, woNo)
      .input('partyId', sql.NVarChar, partyId)
      .query(`
        SELECT
          CONVERT(VARCHAR(16), updated_on, 120) AS updatedOn,
          completed_qty AS qty,
          remarks
        FROM ${TABLES.WO_COMPLETION_UPDATE}
        WHERE wo_no = @woNo AND party_id = @partyId
        ORDER BY updated_on ASC, id ASC
      `);

    let runningTotal = 0;
    const history = result.recordset.map((row) => {
      runningTotal += Number(row.qty);
      return {
        updatedOn: row.updatedOn,
        qty: Number(row.qty),
        runningTotal,
        remarks: row.remarks || '—',
      };
    });

    res.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ message: 'Internal server error fetching history' });
  }
});

// 4. POST /supplier/completion
// Transactional completion update with concurrency lock & server-side balance validation
router.post('/completion', async (req: Request, res: Response): Promise<void> => {
  const { woNo, qty, remarks } = req.body;
  const partyId = req.user!.partyId!;

  if (!woNo) {
    res.status(400).json({ message: 'Work order number (woNo) is required' });
    return;
  }

  const numQty = Number(qty);
  if (isNaN(numQty) || numQty <= 0) {
    res.status(400).json({ message: 'Quantity must be a positive number greater than 0' });
    return;
  }

  const pool = await getDbPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();
    const request = new sql.Request(transaction);

    request.input('woNo', sql.NVarChar, woNo);
    request.input('partyId', sql.NVarChar, partyId);
    request.input('partyIdNum', sql.Decimal(18, 0), Number(partyId));
    request.input('partyName', sql.NVarChar, req.user!.name || '');
    request.input('qty', sql.Decimal(18, 2), numQty);
    request.input('remarks', sql.NVarChar, remarks ? String(remarks).trim() : null);
    request.input('updatedBy', sql.NVarChar, String(req.user!.loginId));

    // Rule 1: Confirm WO exists and belongs to supplier
    const woResult = await request.query(`
      SELECT TOP 1 w.orderQty
      FROM (${WO_SOURCE}) w
      WHERE w.woNo = @woNo AND (w.partyId = @partyIdNum OR (w.partyId IS NULL AND w.partyName = @partyName))
    `);

    if (woResult.recordset.length === 0) {
      await transaction.rollback();
      res.status(403).json({ message: 'Forbidden: Work order does not belong to you' });
      return;
    }

    const orderQty = Number(woResult.recordset[0].orderQty);

    // Rule 3: Lock and calculate current completed sum with (UPDLOCK, HOLDLOCK)
    const sumResult = await request.query(`
      SELECT ISNULL(SUM(completed_qty), 0) AS currentCompleted
      FROM ${TABLES.WO_COMPLETION_UPDATE} WITH (UPDLOCK, HOLDLOCK)
      WHERE wo_no = @woNo AND party_id = @partyId
    `);

    const currentCompleted = Number(sumResult.recordset[0].currentCompleted);
    const balance = orderQty - currentCompleted;

    // Rule 4: If qty > balance, return 400
    if (numQty > balance) {
      await transaction.rollback();
      res.status(400).json({ message: 'Qty is more than balance' });
      return;
    }

    // Rule 5: Insert entry into audit table & commit
    await request.query(`
      INSERT INTO ${TABLES.WO_COMPLETION_UPDATE} (wo_no, party_id, completed_qty, remarks, updated_on, updated_by)
      VALUES (@woNo, @partyId, @qty, @remarks, GETDATE(), @updatedBy)
    `);

    await transaction.commit();

    const newCompletedQty = currentCompleted + numQty;
    const newBalanceQty = Math.max(0, orderQty - newCompletedQty);
    const status = calculateStatus(newCompletedQty, orderQty);

    res.json({
      completedQty: newCompletedQty,
      balanceQty: newBalanceQty,
      status,
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch {}
    console.error('Error updating completed quantity:', error);
    res.status(500).json({ message: 'Internal server error updating completed quantity' });
  }
});

// Helper to fetch report rows for this supplier
const getSupplierReportRows = async (partyId: string, partyName: string, from?: string, to?: string, statusFilter?: string) => {
  const pool = await getDbPool();
  const request = pool
    .request()
    .input('partyId', sql.NVarChar, partyId)
    .input('partyIdNum', sql.Decimal(18, 0), Number(partyId))
    .input('partyName', sql.NVarChar, partyName);

  let whereClause = 'WHERE (w.partyId = @partyIdNum OR (w.partyId IS NULL AND w.partyName = @partyName))';

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
    SELECT DISTINCT
      w.woNo,
      w.foNo,
      w.process,
      w.unit,
      w.orderQty,
      w.uom,
      w.delayDays,
      ISNULL(c.total_completed, 0) AS completedQty,
      ISNULL(c.last_update, '—') AS lastUpdate,
      CASE
        WHEN ISNULL(c.total_completed, 0) <= 0 THEN 'Received'
        WHEN ISNULL(c.total_completed, 0) >= w.orderQty THEN 'Completed'
        ELSE 'In Progress'
      END AS status
    FROM (${WO_SOURCE}) w
    LEFT JOIN (
      SELECT
        wo_no,
        party_id,
        SUM(completed_qty) AS total_completed,
        CONVERT(VARCHAR(16), MAX(updated_on), 120) AS last_update
      FROM ${TABLES.WO_COMPLETION_UPDATE}
      WHERE party_id = @partyId
      GROUP BY wo_no, party_id
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
      foNo: row.foNo,
      fono: row.foNo,
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

// 5. GET /supplier/reports?from=&to=&status=
router.get('/reports', async (req: Request, res: Response): Promise<void> => {
  try {
    const partyId = req.user!.partyId!;
    const partyName = req.user!.name || '';
    const from = req.query.from as string;
    const to = req.query.to as string;
    const status = req.query.status as string;

    const rows = await getSupplierReportRows(partyId, partyName, from, to, status);
    res.json(rows);
  } catch (error) {
    console.error('Error generating supplier report:', error);
    res.status(500).json({ message: 'Internal server error generating supplier report' });
  }
});

// 6. GET /supplier/reports/download (Excel export)
router.get('/reports/download', async (req: Request, res: Response): Promise<void> => {
  try {
    const partyId = req.user!.partyId!;
    const partyName = req.user!.name || '';
    const from = req.query.from as string;
    const to = req.query.to as string;
    const status = req.query.status as string;

    const rows = await getSupplierReportRows(partyId, partyName, from, to, status);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Work Orders Report');

    worksheet.columns = [
      { header: 'WO No', key: 'woNo', width: 22 },
      { header: 'FO No', key: 'foNo', width: 14 },
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
      'attachment; filename=Supplier_Report.xlsx'
    );

    await workbook.xlsx.write(res);
  } catch (error) {
    console.error('Error exporting Excel report:', error);
    res.status(500).json({ message: 'Internal server error exporting Excel report' });
  }
});

export default router;
