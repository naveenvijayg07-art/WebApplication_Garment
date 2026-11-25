export type UserRole = 'admin' | 'supplier';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  gstNumber?: string;
  mustChangePassword?: boolean;
  token?: string;
}

export interface Supplier {
  id: string;
  name: string;
  gstNumber: string;
  isActive: boolean;
  hasPassword: boolean;
}

export type WorkOrderStatus =
  | 'Received'
  | 'In Progress'
  | 'Completed';

export interface DCDetail {
  dcNo: string;
  dcDate: string;
  dcQty: number;
}

export interface CompletionEntry {
  woNo: string;
  qty: number;
  remarks: string;
  updatedOn: string;
  runningTotal?: number;
}

export interface WorkOrder {
  woNo: string;
  fono: string;
  foNo?: string;
  merchName: string;
  prepBy: string;
  partyName: string;
  unitName: string;
  unit?: string;
  process: string;
  qty: number; // Order Qty
  orderQty?: number;
  completedQty: number;
  balanceQty: number;
  uom: string;
  delayDays: number;
  status: WorkOrderStatus;
  dcList: DCDetail[];
  completionHistory: CompletionEntry[];
  lastUpdate?: string;
}

export interface StatusLogItem {
  woNo: string;
  partyName: string;
  partyId: string;
  fono: string;
  process: string;
  qty: number;
  runningTotal: number;
  uom: string;
  status: WorkOrderStatus;
  remarks: string;
  updatedOn: string;
}

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}
