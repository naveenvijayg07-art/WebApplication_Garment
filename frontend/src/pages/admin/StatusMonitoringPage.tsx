import React, { useState, useEffect } from 'react';
import { getStatusUpdates, getSuppliers, StatusLogItem, reverseCompletion } from '../../api/adminApi';
import { Supplier } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { Pagination } from '../../components/Pagination';
import { useToast } from '../../components/Toast';
import { getErrorMessage } from '../../api/client';
import './StatusMonitoringPage.css';

export const StatusMonitoringPage: React.FC = () => {
  const { showToast } = useToast();

  const [logs, setLogs] = useState<StatusLogItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters: supplier, date range, WO no
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [woNoFilter, setWoNoFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Reversal modal state
  const [reversalTarget, setReversalTarget] = useState<StatusLogItem | null>(null);
  const [reversalQty, setReversalQty] = useState('');
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalTarget) return;
    const numQty = Number(reversalQty);
    if (!numQty || numQty <= 0) {
      showToast('Please enter a valid quantity to reverse', 'error');
      return;
    }
    if (!reversalReason.trim()) {
      showToast('Please provide a reason for the reversal', 'error');
      return;
    }
    setIsReversing(true);
    try {
      const res = await reverseCompletion(
        reversalTarget.woNo,
        reversalTarget.partyId,
        numQty,
        reversalReason.trim()
      );
      showToast(res.message, 'success');
      setReversalTarget(null);
      loadData();
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setIsReversing(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [suppliersData, logsData] = await Promise.all([
        getSuppliers(),
        getStatusUpdates({
          supplier: selectedSupplier,
          from: startDate,
          to: endDate,
          woNo: woNoFilter,
        }),
      ]);
      setSuppliers(suppliersData);
      setLogs(logsData);
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApplyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadData();
  };

  const handleResetFilters = async () => {
    setSelectedSupplier('ALL');
    setStartDate('');
    setEndDate('');
    setWoNoFilter('');
    setCurrentPage(1);

    setLoading(true);
    try {
      const logsData = await getStatusUpdates();
      setLogs(logsData);
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = logs.slice(startIndex, startIndex + pageSize);

  return (
    <div className="status-monitoring-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Status Monitoring</h2>
          <p className="page-subtitle">Real-time log of supplier completion quantity entries</p>
        </div>
      </div>

      {/* Filter toolbar: supplier, date range, WO no */}
      <form onSubmit={handleApplyFilters} className="card toolbar-card">
        <div className="filter-group" style={{ minWidth: '180px' }}>
          <label>Filter by Supplier</label>
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

        <div className="filter-group" style={{ minWidth: '140px' }}>
          <label>WO Number</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. WO-2024-001"
            value={woNoFilter}
            onChange={(e) => setWoNoFilter(e.target.value)}
          />
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

        <div className="monitoring-filter-buttons">
          <button type="submit" className="btn btn-primary">
            Apply Filters
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleResetFilters}>
            Reset
          </button>
        </div>
      </form>

      {/* Status updates table */}
      <div className="card">
        {loading ? (
          <div className="state-container">
            <div className="spinner" />
            <div className="state-title">Loading Status Updates...</div>
          </div>
        ) : logs.length === 0 ? (
          <div className="state-container">
            <div className="state-title">No completion entries found</div>
            <p>Try modifying your filter parameters.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>WO No</th>
                    <th>Supplier / Party</th>
                    <th>FO No</th>
                    <th>Process</th>
                    <th>Qty Entered</th>
                    <th>Running Total</th>
                    <th>Status</th>
                    <th>Remarks</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log, index) => (
                    <tr key={`${log.woNo}-${log.updatedOn}-${index}`}>
                      <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>
                        {log.updatedOn}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0284c7' }}>{log.woNo}</td>
                      <td style={{ fontWeight: 500 }}>{log.partyName}</td>
                      <td>{log.fono}</td>
                      <td>{log.process}</td>
                      <td style={{ fontWeight: 600, color: log.qty < 0 ? '#ef4444' : '#16a34a' }}>
                        {log.qty > 0 ? `+${log.qty.toLocaleString()}` : log.qty.toLocaleString()} {log.uom}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0284c7' }}>
                        {log.runningTotal.toLocaleString()} {log.uom}
                      </td>
                      <td>
                        <StatusBadge status={log.status} />
                      </td>
                      <td style={{ maxWidth: '250px' }}>{log.remarks}</td>
                      <td>
                        {log.qty > 0 && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#ef4444', borderColor: '#fca5a5' }}
                            onClick={() => {
                              setReversalTarget(log);
                              setReversalQty(String(log.qty));
                              setReversalReason('');
                            }}
                          >
                            Reverse
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={logs.length}
              pageSize={pageSize}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </>
        )}
      </div>

      {/* Reversal Modal */}
      {reversalTarget && (
        <div className="modal-backdrop">
          <div className="modal-dialog card" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Reverse Completion Entry</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setReversalTarget(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleConfirmReversal}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                  WO No: <strong>{reversalTarget.woNo}</strong> | Party: <strong>{reversalTarget.partyName}</strong>
                </p>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Quantity to Reverse:
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    className="input-field"
                    value={reversalQty}
                    onChange={(e) => setReversalQty(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Reason for Reversal:
                  </label>
                  <textarea
                    className="input-field"
                    rows={3}
                    placeholder="Enter reason for reversing this quantity..."
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setReversalTarget(null)}
                  disabled={isReversing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger btn-sm"
                  disabled={isReversing}
                >
                  {isReversing ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
