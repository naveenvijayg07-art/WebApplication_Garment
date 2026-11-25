import React from 'react';
import { WorkOrder } from '../types';
import './Modal.css';

interface HistoryModalProps {
  workOrder: WorkOrder | null;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ workOrder, onClose }) => {
  if (!workOrder) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Completion History — {workOrder.woNo}</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '14px', fontSize: '13px', color: '#64748b' }}>
            <strong>FO:</strong> {workOrder.fono} &nbsp;|&nbsp; <strong>Process:</strong> {workOrder.process} &nbsp;|&nbsp;{' '}
            <strong>Order Qty:</strong> {workOrder.qty.toLocaleString()} {workOrder.uom}
          </div>
          {workOrder.completionHistory && workOrder.completionHistory.length > 0 ? (
            <table className="modal-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Qty Entered</th>
                  <th>Running Total</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {workOrder.completionHistory.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ whiteSpace: 'nowrap', color: '#64748b' }}>{item.updatedOn}</td>
                    <td style={{ fontWeight: 600, color: '#16a34a' }}>
                      +{item.qty.toLocaleString()} {workOrder.uom}
                    </td>
                    <td style={{ fontWeight: 600, color: '#0284c7' }}>
                      {(item.runningTotal ?? item.qty).toLocaleString()} {workOrder.uom}
                    </td>
                    <td>{item.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
              No completion history entries recorded yet.
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
