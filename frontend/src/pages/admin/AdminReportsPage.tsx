import React, { useState, useEffect } from 'react';
import { getAdminReport, getSuppliers, downloadAdminReport } from '../../api/adminApi';
import { saveBlob, getErrorMessage } from '../../api/client';
import { Supplier, WorkOrder, WorkOrderStatus } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';
import './AdminReportsPage.css';

const STATUS_OPTIONS: WorkOrderStatus[] = [
  'Received',
  'In Progress',
  'Completed',
];

export const AdminReportsPage: React.FC = () => {
  const { showToast } = useToast();

  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [suppliersData, reportsData] = await Promise.all([
        getSuppliers(),
        getAdminReport({
          supplier: selectedSupplier,
          from: startDate,
          to: endDate,
          status: statusFilter,
        }),
      ]);
      setSuppliers(suppliersData);
      setOrders(reportsData);
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, []);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    loadReportData();
  };

  const handleReset = async () => {
    setSelectedSupplier('ALL');
    setStartDate('');
    setEndDate('');
    setStatusFilter('ALL');

    setLoading(true);
    try {
      const reportsData = await getAdminReport();
      setOrders(reportsData);
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const blob = await downloadAdminReport({
        supplier: selectedSupplier,
        from: startDate,
        to: endDate,
        status: statusFilter,
      });
      saveBlob(blob, 'Admin_Report.xlsx');
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  return (
    <div className="admin-reports-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Company Work Order Reports</h2>
          <p className="page-subtitle">Consolidated view of all supplier deliverables and progress</p>
        </div>
        <button className="btn btn-primary" onClick={handleDownloadExcel}>
          📥 Download Excel
        </button>
      </div>

      {/* Filter toolbar */}
      <form onSubmit={handleApplyFilter} className="card toolbar-card">
        <div className="filter-group" style={{ minWidth: '180px' }}>
          <label>Supplier</label>
          <select
            className="select-field"
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
          >
            <option value="ALL">All Suppliers</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Start Date</label>
          <input
            type="date"
            className="input-field"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>End Date</label>
          <input
            type="date"
            className="input-field"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="filter-group" style={{ minWidth: '160px' }}>
          <label>Status</label>
          <select
            className="select-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-report-filter-buttons">
          <button type="submit" className="btn btn-primary">
            Apply Filters
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>
        </div>
      </form>

      {/* Consolidated Report Table */}
      <div className="card">
        {loading ? (
          <div className="state-container">
            <div className="spinner" />
            <div className="state-title">Generating Consolidated Report...</div>
          </div>
        ) : orders.length === 0 ? (
          <div className="state-container">
            <div className="state-title">No records matched the filter criteria</div>
            <p>Try resetting filters or expanding the date range.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>WO No</th>
                  <th>Supplier Party</th>
                  <th>FO No</th>
                  <th>Merchandiser</th>
                  <th>Process</th>
                  <th>Unit</th>
                  <th>Order Qty</th>
                  <th>Completed Qty</th>
                  <th>Balance Qty</th>
                  <th>Delay (Days)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((wo) => (
                  <tr key={wo.woNo}>
                    <td style={{ fontWeight: 600, color: '#0284c7' }}>{wo.woNo}</td>
                    <td style={{ fontWeight: 500 }}>{wo.partyName}</td>
                    <td style={{ fontWeight: 600 }}>{wo.foNo}</td>
                    <td>{wo.merchName}</td>
                    <td>{wo.process}</td>
                    <td>{wo.unit}</td>
                    <td>
                      {wo.orderQty?.toLocaleString()} {wo.uom}
                    </td>
                    <td style={{ color: '#16a34a', fontWeight: 600 }}>
                      {wo.completedQty.toLocaleString()} {wo.uom}
                    </td>
                    <td style={{ color: wo.balanceQty > 0 ? '#ea580c' : '#16a34a', fontWeight: 600 }}>
                      {wo.balanceQty.toLocaleString()} {wo.uom}
                    </td>
                    <td className={wo.delayDays < 0 ? 'delay-negative' : 'delay-positive'}>
                      {wo.delayDays}
                    </td>
                    <td>
                      <StatusBadge status={wo.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
