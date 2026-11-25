import React from 'react';
import { WorkOrderStatus } from '../types';
import './StatusBadge.css';

interface StatusBadgeProps {
  status: WorkOrderStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const getBadgeClass = (s: WorkOrderStatus) => {
    switch (s) {
      case 'Completed':
        return 'badge-completed';
      case 'In Progress':
        return 'badge-in-progress';
      case 'Received':
      default:
        return 'badge-received';
    }
  };

  return <span className={`status-badge ${getBadgeClass(status)}`}>{status}</span>;
};
