import React, { useState, useEffect } from 'react';
import { useAuth } from '../../AuthContext';
import { getMyWorkOrders, updateCompletedQty, getHistory, getDcDetails } from '../../api/supplierApi';
import { getErrorMessage } from '../../api/client';
import { WorkOrder, WorkOrderStatus } from '../../types';
import { StatusBadge } from '../../components/StatusBadge';
import { HistoryModal } from '../../components/HistoryModal';
import { DcDetailsModal } from '../../components/DcDetailsModal';
import { Pagination } from '../../components/Pagination';
import { useToast } from '../../components/Toast';
import './MyWorkOrdersPage.css';

const STATUS_OPTIONS: WorkOrderStatus[] = [
  'Received',
  'In Progress',
  'Completed',
];

interface RowInputState {
  [woNo: string]: {
    qty: string;
    remarks: string;
    isSaving: boolean;
  };
}

export const MyWorkOrdersPage: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // Row completion input local state
  const [rowInputs, setRowInputs] = useState<RowInputState>({});

  // Modals
  const [historyTarget, setHistoryTarget] = useState<WorkOrder | null>(null);
  const [dcTarget, setDcTarget] = useState<WorkOrder | null>(null);

  const fetchOrders = async () => {
    if (!user?.gstNumber) return;
    setLoading(true);
    try {
      const data = await getMyWorkOrders();
      setWorkOrders(data);

      const initialInputs: RowInputState = {};
      data.forEach((wo) => {
        initialInputs[wo.woNo] = {
          qty: '',
          remarks: '',
          isSaving: false,
        };
      });
      setRowInputs(initialInputs);
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user?.gstNumber]);

  const handleQtyChange = (woNo: string, val: string) => {
    setRowInputs((prev) => ({
      ...prev,
      [woNo]: {
        ...prev[woNo],
        qty: val,
      },
    }));
  };

  const handleRemarksChange = (woNo: string, remarks: string) => {
    setRowInputs((prev) => ({
      ...prev,
      [woNo]: {
        ...prev[woNo],
        remarks,
      },
    }));
  };

  const handleOpenHistory = async (wo: WorkOrder) => {
    try {
      const history = await getHistory(wo.woNo);
      setHistoryTarget({ ...wo, completionHistory: history });
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
      setHistoryTarget({ ...wo, completionHistory: [] });
    }
  };

  const handleOpenDc = async (wo: WorkOrder) => {
    try {
      const dcList = await getDcDetails(wo.woNo);
      setDcTarget({ ...wo, dcList });
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
      setDcTarget({ ...wo, dcList: [] });
    }
  };

  const handleSaveCompletion = async (wo: WorkOrder) => {
    const input = rowInputs[wo.woNo];
    if (!input) return;

    const enteredQty = Number(input.qty);

    // Validation: the qty must be greater than 0 and must not be more than the Balance Qty
    if (!input.qty || isNaN(enteredQty) || enteredQty <= 0) {
      showToast('Completed quantity must be greater than 0.', 'error');
      return;
    }

    if (enteredQty > wo.balanceQty) {
      showToast(
        `Quantity cannot exceed the remaining Balance Qty (${wo.balanceQty.toLocaleString()} ${wo.uom}).`,
        'error'
      );
      return;
    }

    if (!window.confirm(`Confirm saving ${enteredQty.toLocaleString()} ${wo.uom} for Work Order ${wo.woNo}?`)) {
      return;
    }

    setRowInputs((prev) => ({
      ...prev,
      [wo.woNo]: { ...prev[wo.woNo], isSaving: true },
    }));

    try {
      // Call updateCompletedQty(woNo, qty, remarks) in api/supplierApi.ts
      const res = await updateCompletedQty(
        wo.woNo,
        enteredQty,
        input.remarks
      );

      // Refresh row's Completed Qty, Balance Qty and Status badge in state by merging
      setWorkOrders((prev) =>
        prev.map((item) =>
          item.woNo === wo.woNo
            ? {
                ...item,
                completedQty: res.completedQty,
                balanceQty: res.balanceQty,
                status: res.status,
              }
            : item
        )
      );

      // Reset inputs for this row
      setRowInputs((prev) => ({
        ...prev,
        [wo.woNo]: {
          qty: '',
          remarks: '',
          isSaving: false,
        },
      }));

      // Show success toast
      showToast(
        `Recorded ${enteredQty.toLocaleString()} ${wo.uom} completed for ${wo.woNo}`,
        'success'
      );
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
      setRowInputs((prev) => ({
        ...prev,
        [wo.woNo]: { ...prev[wo.woNo], isSaving: false },
      }));
    }
  };

  // Filtered orders
  const filteredOrders = workOrders.filter((wo) => {
    const matchesSearch =
      (wo.fono || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wo.woNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wo.merchName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wo.process || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (wo.unitName || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || wo.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Paginated orders
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + pageSize);

  return (
    <div className="work-orders-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">My Work Orders</h2>
          <p className="page-subtitle">
            Track deliverables, log completed quantities, and review progress
          </p>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="card toolbar-card">
        <div className="filter-group" style={{ minWidth: '240px', flex: 1 }}>
          <label>Search Work Orders</label>
          <input
            type="text"
            className="input-field"
            placeholder="Search by WO No, FO No, Merch, Process..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="filter-group" style={{ minWidth: '180px' }}>
          <label>Filter by Status</label>
          <select
            className="select-field"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="ALL">All Statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div style={{ alignSelf: 'flex-end' }}>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('ALL');
              setCurrentPage(1);
            }}
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Work Orders Table */}
      <div className="card">
        {loading ? (
          <div className="state-container">
            <div className="spinner" />
            <div className="state-title">Loading Work Orders...</div>
            <p>Please wait while we retrieve your work order details.</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="state-container">
            <div className="state-title">No work orders found</div>
            <p>Try clearing your search query or status filter.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fono</th>
                    <th>MerchName</th>
                    <th>PrepBy</th>
                    <th>PartyName</th>
                    <th>UnitName</th>
                    <th>Process</th>
                    <th>WO_No</th>
                    <th>Order Qty</th>
                    <th>Completed Qty</th>
                    <th>Balance Qty</th>
                    <th>Uom</th>
                    <th>DelayDays</th>
                    <th>Status</th>
                    <th>Details</th>
                    <th>Enter Completion</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((wo) => {
                    const rowInput = rowInputs[wo.woNo] || {
                      qty: '',
                      remarks: '',
                      isSaving: false,
                    };
                    const isFullyCompleted = wo.balanceQty <= 0;

                    return (
                      <tr key={wo.woNo}>
                        <td style={{ fontWeight: 600 }}>{wo.fono}</td>
                        <td>{wo.merchName}</td>
                        <td>{wo.prepBy}</td>
                        <td style={{ maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {wo.partyName}
                        </td>
                        <td>{wo.unitName}</td>
                        <td>
                          <span className="process-tag">{wo.process}</span>
                        </td>
                        <td style={{ fontWeight: 600, color: '#0284c7' }}>{wo.woNo}</td>
                        <td style={{ fontWeight: 600 }}>{wo.qty.toLocaleString()}</td>
                        <td style={{ fontWeight: 600, color: '#16a34a' }}>
                          {wo.completedQty.toLocaleString()}
                        </td>
                        <td
                          style={{
                            fontWeight: 600,
                            color: wo.balanceQty > 0 ? '#ea580c' : '#16a34a',
                          }}
                        >
                          {wo.balanceQty.toLocaleString()}
                        </td>
                        <td>{wo.uom}</td>
                        <td className={wo.delayDays < 0 ? 'delay-negative' : 'delay-positive'}>
                          {wo.delayDays}
                        </td>
                        <td>
                          <StatusBadge status={wo.status} />
                        </td>
                        <td>
                          <div className="row-action-btns">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenHistory(wo)}
                              title="View Completion History"
                            >
                              History
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenDc(wo)}
                              title="View Delivery Challans"
                            >
                              DC Details
                            </button>
                          </div>
                        </td>
                        {/* Last column: Number input, remarks input, Save button */}
                        <td>
                          <div className="inline-update-box">
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              max={wo.balanceQty}
                              className="input-field row-qty-input"
                              placeholder={isFullyCompleted ? 'Done' : 'Enter Qty'}
                              value={rowInput.qty}
                              disabled={isFullyCompleted || rowInput.isSaving}
                              onChange={(e) =>
                                handleQtyChange(wo.woNo, e.target.value)
                              }
                            />
                            <input
                              type="text"
                              className="input-field row-remarks-input"
                              placeholder={isFullyCompleted ? 'Fully completed' : 'Add remarks...'}
                              value={rowInput.remarks}
                              disabled={isFullyCompleted || rowInput.isSaving}
                              onChange={(e) =>
                                handleRemarksChange(wo.woNo, e.target.value)
                              }
                            />
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              disabled={isFullyCompleted || rowInput.isSaving}
                              onClick={() => handleSaveCompletion(wo)}
                            >
                              {rowInput.isSaving ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              totalItems={filteredOrders.length}
              pageSize={pageSize}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </>
        )}
      </div>

      {/* Popups */}
      <HistoryModal
        workOrder={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
      <DcDetailsModal
        workOrder={dcTarget}
        onClose={() => setDcTarget(null)}
      />
    </div>
  );
};
