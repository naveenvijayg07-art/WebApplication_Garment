import client from './client';
import { Supplier, WorkOrder, StatusLogItem } from '../types';

export type { StatusLogItem };

export interface SupplierItem {
  partyId: string;
  name: string;
  gstNo: string;
  isActive: boolean;
  hasPassword: boolean;
}

export interface AdminStatusFilters {
  supplier?: string;
  from?: string;
  to?: string;
  woNo?: string;
}

export interface AdminReportFilters {
  supplier?: string;
  from?: string;
  to?: string;
  status?: string;
}

// GET /admin/suppliers, returns list of { partyId, name, gstNo, isActive, hasPassword }
export const getSuppliers = async (): Promise<Supplier[]> => {
  const response = await client.get<SupplierItem[]>('/admin/suppliers');
  return response.data.map((item) => ({
    id: item.partyId,
    partyId: item.partyId,
    name: item.name,
    gstNumber: item.gstNo,
    gstNo: item.gstNo,
    isActive: item.isActive,
    hasPassword: item.hasPassword,
  }));
};

// POST /admin/suppliers/login, body { partyId, password }
export const createSupplierLogin = async (
  partyId: string,
  password: string
): Promise<Supplier> => {
  const response = await client.post('/admin/suppliers/login', {
    partyId,
    password,
  });

  const data = response.data || {};
  return {
    id: partyId,
    name: data.name || '',
    gstNumber: data.gstNo || data.gstNumber || '',
    isActive: true,
    hasPassword: true,
    ...data,
  };
};

// PUT /admin/suppliers/password, body { partyId, password }
export const setSupplierPassword = async (
  partyId: string,
  password: string
): Promise<Supplier> => {
  const response = await client.put('/admin/suppliers/password', {
    partyId,
    password,
  });

  const data = response.data || {};
  return {
    id: partyId,
    name: data.name || '',
    gstNumber: data.gstNo || data.gstNumber || '',
    isActive: data.isActive !== undefined ? data.isActive : true,
    hasPassword: true,
    ...data,
  };
};

// PUT /admin/suppliers/active, body { partyId, isActive }
export const setSupplierActive = async (
  partyId: string,
  isActive?: boolean
): Promise<Supplier> => {
  const response = await client.put('/admin/suppliers/active', {
    partyId,
    isActive,
  });

  const data = response.data || {};
  return {
    id: partyId,
    name: data.name || '',
    gstNumber: data.gstNo || data.gstNumber || '',
    isActive: data.isActive !== undefined ? data.isActive : !!isActive,
    hasPassword: data.hasPassword !== undefined ? data.hasPassword : false,
    ...data,
  };
};

// GET /admin/status with params supplier, from, to, woNo
export const getStatusUpdates = async (
  filters?: AdminStatusFilters
): Promise<StatusLogItem[]> => {
  const params: Record<string, string> = {};

  if (filters?.supplier && filters.supplier !== 'ALL') params.supplier = filters.supplier;
  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;
  if (filters?.woNo && filters.woNo.trim()) params.woNo = filters.woNo.trim();

  const response = await client.get<StatusLogItem[]>('/admin/status', { params });
  return response.data;
};

// GET /admin/reports with params
export const getAdminReport = async (
  filters?: AdminReportFilters
): Promise<WorkOrder[]> => {
  const params: Record<string, string> = {};

  if (filters?.supplier && filters.supplier !== 'ALL') params.supplier = filters.supplier;
  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;
  if (filters?.status && filters.status !== 'ALL') params.status = filters.status;

  const response = await client.get<WorkOrder[]>('/admin/reports', { params });
  return response.data;
};

// GET /admin/reports/download with params and responseType "blob"
export const downloadAdminReport = async (
  filters?: AdminReportFilters
): Promise<Blob> => {
  const params: Record<string, string> = {};

  if (filters?.supplier && filters.supplier !== 'ALL') params.supplier = filters.supplier;
  if (filters?.from) params.from = filters.from;
  if (filters?.to) params.to = filters.to;
  if (filters?.status && filters.status !== 'ALL') params.status = filters.status;

  const response = await client.get('/admin/reports/download', {
    params,
    responseType: 'blob',
  });
  return response.data;
};

// POST /admin/completion/reverse
export const reverseCompletion = async (
  woNo: string,
  partyId: string,
  qty: number,
  reason: string
): Promise<{ message: string }> => {
  const response = await client.post('/admin/completion/reverse', {
    woNo,
    partyId,
    qty,
    reason,
  });
  return response.data;
};
