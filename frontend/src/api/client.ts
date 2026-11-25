import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
});

// Request interceptor: read token from portal_auth_user and attach Authorization header
client.interceptors.request.use(
  (config) => {
    const rawUser = sessionStorage.getItem('portal_auth_user');
    if (rawUser) {
      try {
        const token = JSON.parse(rawUser)?.token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {}
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401 (if not on /login), clear sessionStorage and redirect to /login
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      sessionStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Error message extractor helper
export const getErrorMessage = (error: any): string => {
  return error?.response?.data?.message || error?.message || 'Something went wrong';
};

// Excel/File download blob helper
export const saveBlob = (blob: Blob, fileName: string): void => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export default client;
