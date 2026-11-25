import client from './client';
import { User } from '../types';

export interface SupplierLoginResponse {
  token: string;
  name: string;
  role: 'supplier';
  mustChangePassword?: boolean;
}

export interface AdminLoginResponse {
  token: string;
  name: string;
  role: 'admin';
}

export interface ChangePasswordResponse {
  message: string;
}

// Supplier login: POST /auth/supplier-login, body { gstNo, password }
export const supplierLogin = async (
  gstNo: string,
  password: string
): Promise<User> => {
  const response = await client.post<SupplierLoginResponse>('/auth/supplier-login', {
    gstNo,
    password,
  });

  const { token, name, role, mustChangePassword } = response.data;

  return {
    id: name,
    name,
    role: role || 'supplier',
    gstNumber: gstNo,
    mustChangePassword,
    token,
  };
};

// Admin login: POST /auth/admin-login, body { username, password }
export const adminLogin = async (
  username: string,
  password: string
): Promise<User> => {
  const response = await client.post<AdminLoginResponse>('/auth/admin-login', {
    username,
    password,
  });

  const { token, name, role } = response.data;

  return {
    id: name,
    name,
    role: role || 'admin',
    token,
  };
};

// Change password: POST /auth/change-password, body { newPassword, oldPassword }
export const changePassword = async (
  newPassword: string,
  oldPassword: string
): Promise<{ success: boolean; message: string }> => {
  const response = await client.post<ChangePasswordResponse>('/auth/change-password', {
    newPassword,
    oldPassword,
  });
  return {
    success: true,
    message: response.data?.message || 'Password changed successfully.',
  };
};
