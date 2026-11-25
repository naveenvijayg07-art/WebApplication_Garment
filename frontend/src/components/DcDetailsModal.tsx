import React from 'react';
import { WorkOrder } from '../types';
import './Modal.css';

interface DcDetailsModalProps {
  workOrder: WorkOrder | null;
  onClose: () => void;
}

export const DcDetailsModal: React.FC<DcDetailsModalProps> = ({ workOrder, onClose }) => {
  if (!workOrder) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Delivery Challan (DC) Details — {workOrder.woNo}</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '14px', fontSize: '13px', color: '#64748b' }}>
            <strong>Party:</strong> {workOrder.partyName} &nbsp;|&nbsp; <strong>Total WO Qty:</strong>{' '}
            {workOrder.qty.toLocaleString()} {workOrder.uom}
          </div>
          {workOrder.dcList && workOrder.dcList.length > 0 ? (
            <table className="modal-table">
              <thead>
                <tr>
                  <th>DC No</th>
                  <th>DC Date</th>
                  <th>DC Quantity</th>
                </tr>
              </thead>
              <tbody>
                {workOrder.dcList.map((dc, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{dc.dcNo}</td>
                    <td style={{ color: '#64748b' }}>{dc.dcDate}</td>
                    <td>
                      {dc.dcQty.toLocaleString()} {workOrder.uom}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>No DC records found for this work order.</p>
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
