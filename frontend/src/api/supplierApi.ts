import client from './client';
import { WorkOrder, DCDetail, CompletionEntry, WorkOrderStatus } from '../types';

export interface ReportFilters {
  from?: string;
  to?: string;
  status?: string;
}

export interface CompletionResponse {
  completedQty: number;
  balanceQty: number;
  status: WorkOrderStatus;
}

// GET /supplier/work-orders
export const getMyWorkOrders = async (): Promise<WorkOrder[]> => {
  const response = await client.get<WorkOrder[]>('/supplier/work-orders');
  return response.data;
};

// GET /supplier/dc?woNo=... (woNo contains slashes, must be query param)
export const getDcDetails = async (woNo: string): Promise<DCDetail[]> => {
  const response = await client.get<DCDetail[]>('/supplier/dc', {
    params: { woNo },
  });
  return response.data;
};

// GET /supplier/history?woNo=... (woNo contains slashes, must be query param)
export const getHistory = async (woNo: string): Promise<CompletionEntry[]> => {
  const response = await client.get<CompletionEntry[]>('/supplier/history', {
    params: { woNo },
  });
  return response.data;
};

// POST /supplier/completion, body { woNo, qty, remarks }
export const updateCompletedQty = async (
  woNo: string,
  qty: number,
  remarks: string
): Promise<CompletionResponse> => {
  const response = await client.post<CompletionResponse>('/supplier/completion', {
    woNo,
    qty,
    remarks,
  });
  const { completedQty, balanceQty, status } = response.data;
  return { completedQty, balanceQty, status };
};

// GET /supplier/reports with params from, to, status
export const getMyReport = async (filters?: ReportFilters): Promise<WorkOrder[]> => {
  const params: Record<string, string> = {};

  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;
  if (filters?.status && filters.status !== 'ALL') params.status = filters.status;

  const response = await client.get<WorkOrder[]>('/supplier/reports', { params });
  return response.data;
};

// GET /supplier/reports/download with params from, to, status and responseType "blob"
export const downloadMyReport = async (filters?: ReportFilters): Promise<Blob> => {
  const params: Record<string, string> = {};

  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;
  if (filters?.status && filters.status !== 'ALL') params.status = filters.status;

  const response = await client.get('/supplier/reports/download', {
    params,
    responseType: 'blob',
  });
  return response.data;
};
