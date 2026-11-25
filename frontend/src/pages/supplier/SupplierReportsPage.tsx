import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import { getMyReport, downloadMyReport } from '../../api/supplierApi';
import { saveBlob, getErrorMessage } from '../../api/client';
import { WorkOrder, WorkOrderStatus } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { useToast } from '../../components/Toast';
import './SupplierReportsPage.css';

const STATUS_OPTIONS: WorkOrderStatus[] = [
  'Received',
  'In Progress',
  'Completed',
];

export const SupplierReportsPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [appliedFilters, setAppliedFilters] = useState<{ from?: string; to?: string; status?: string }>({});

  const fetchReports = async (filters: { from?: string; to?: string; status?: string } = appliedFilters) => {
    if (!user?.gstNumber) return;
    setLoading(true);
    try {
      const data = await getMyReport(filters);
      setOrders(data);
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [user?.gstNumber]);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const filters = {
      from: startDate || undefined,
      to: endDate || undefined,
      status: statusFilter !== 'ALL' ? statusFilter : undefined,
    };
    setAppliedFilters(filters);
    fetchReports(filters);
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setStatusFilter('ALL');
    setAppliedFilters({});
    fetchReports({});
  };

  const handleDownloadExcel = async () => {
    try {
      const blob = await downloadMyReport(appliedFilters);
      saveBlob(blob, 'Supplier_Report.xlsx');
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
    }
  };

  return (
    <div className="supplier-reports-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Reports</h2>
          <p className="page-subtitle">Generate and review work order summary reports</p>
        </div>
        <button className="btn btn-primary" onClick={handleDownloadExcel}>
          📥 Download Excel
        </button>
      </div>

      {/* Filter toolbar */}
      <form onSubmit={handleApplyFilter} className="card toolbar-card">
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

        <div className="filter-group" style={{ minWidth: '180px' }}>
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

        <div className="report-filter-buttons">
          <button type="submit" className="btn btn-primary">
            Apply Filters
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>
        </div>
      </form>

      {/* Report Table */}
      <div className="card">
        {loading ? (
          <div className="state-container">
            <div className="spinner" />
            <div className="state-title">Generating Report...</div>
          </div>
        ) : orders.length === 0 ? (
          <div className="state-container">
            <div className="state-title">No work orders match the criteria</div>
            <p>Try broadening the date range or status filter.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>WO No</th>
                  <th>FO No</th>
                  <th>Process</th>
                  <th>Unit</th>
                  <th>Order Qty</th>
                  <th>Completed Qty</th>
                  <th>Balance Qty</th>
                  <th>Delay Days</th>
                  <th>Status</th>
                  <th>Last Update</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((wo) => {
                  const lastUpdate = wo.lastUpdate || '—';
                  const orderQty = wo.orderQty ?? wo.qty ?? 0;
                  const completedQty = wo.completedQty ?? 0;
                  const balanceQty = wo.balanceQty ?? 0;
                  const foNo = wo.foNo || wo.fono || '';
                  const unit = wo.unit || wo.unitName || '';

                  return (
                    <tr key={wo.woNo}>
                      <td style={{ fontWeight: 600, color: '#0284c7' }}>{wo.woNo}</td>
                      <td style={{ fontWeight: 600 }}>{foNo}</td>
                      <td>{wo.process}</td>
                      <td>{unit}</td>
                      <td>
                        {orderQty.toLocaleString()} {wo.uom}
                      </td>
                      <td style={{ color: '#16a34a', fontWeight: 600 }}>
                        {completedQty.toLocaleString()} {wo.uom}
                      </td>
                      <td
                        style={{
                          color: balanceQty > 0 ? '#ea580c' : '#16a34a',
                          fontWeight: 600,
                        }}
                      >
                        {balanceQty.toLocaleString()} {wo.uom}
                      </td>
                      <td className={wo.delayDays < 0 ? 'delay-negative' : 'delay-positive'}>
                        {wo.delayDays}
                      </td>
                      <td>
                        <StatusBadge status={wo.status} />
                      </td>
                      <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>{lastUpdate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
