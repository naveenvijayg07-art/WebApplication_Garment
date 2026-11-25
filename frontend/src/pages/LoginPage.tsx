import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { supplierLogin, adminLogin } from '../api/authApi';
import { getErrorMessage } from '../api/client';
import './LoginPage.css';

export const LoginPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'supplier' | 'admin'>('supplier');
  const [gstNumber, setGstNumber] = useState('');
  const [supplierPassword, setSupplierPassword] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!gstNumber.trim() || !supplierPassword.trim()) {
      setError('Please enter both GST number and password.');
      return;
    }

    setLoading(true);
    try {
      const user = await supplierLogin(gstNumber, supplierPassword);
      login(user);
      if (user.mustChangePassword) {
        navigate('/change-password');
      } else {
        navigate('/supplier/work-orders');
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!adminUsername.trim() || !adminPassword.trim()) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const user = await adminLogin(adminUsername, adminPassword);
      login(user);
      navigate('/admin/suppliers');
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-circle">WO</div>
          <h1 className="login-title">Supplier Work Order Portal</h1>
          <p className="login-subtitle">Sign in to access your portal</p>
        </div>

        {/* Tabs */}
        <div className="login-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'supplier' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('supplier');
              setError('');
            }}
          >
            Supplier Login
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('admin');
              setError('');
            }}
          >
            QC Login
          </button>
        </div>

        {error && <div className="login-error-box">{error}</div>}

        {activeTab === 'supplier' ? (
          <form onSubmit={handleSupplierSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="gst">GST Number</label>
              <input
                id="gst"
                type="text"
                className="input-field"
                placeholder="e.g. 29ABCDE1234F1Z5"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="sup-pwd">Password</label>
              <input
                id="sup-pwd"
                type="password"
                className="input-field"
                placeholder="Enter password"
                value={supplierPassword}
                onChange={(e) => setSupplierPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In as Supplier'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminSubmit} className="login-form">
                       <div className="form-group">
              <label htmlFor="admin-user">Employee Code</label>
              <input
                id="admin-user"
                type="text"
                className="input-field"
                placeholder="e.g. 7777"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="admin-pwd">Password</label>
              <input
                id="admin-pwd"
                type="password"
                className="input-field"
                placeholder="Enter password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In as QC'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
