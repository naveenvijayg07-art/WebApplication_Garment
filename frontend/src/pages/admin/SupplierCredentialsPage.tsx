import React, { useState, useEffect } from 'react';
import {
  getSuppliers,
  createSupplierLogin,
  setSupplierPassword,
  setSupplierActive,
} from '../../api/adminApi';
import { Supplier } from '../../types';
import { PasswordModal } from '../../components/PasswordModal';
import { useToast } from '../../components/Toast';
import { getErrorMessage } from '../../api/client';
import './SupplierCredentialsPage.css';

export const SupplierCredentialsPage: React.FC = () => {
  const { showToast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(''); 
  const [togglingId, setTogglingId] = useState<string | null>(null); 

  // Modal state
  const [modalSupplier, setModalSupplier] = useState<Supplier | null>(null);
  const [modalMode, setModalMode] = useState<'create' | 'reset'>('create');

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOpenPasswordModal = (supplier: Supplier, mode: 'create' | 'reset') => {
    setModalSupplier(supplier);
    setModalMode(mode);
  };

  const handlePasswordSubmit = async (supplierId: string, password: string) => {
    if (modalMode === 'create') {
      const updated = await createSupplierLogin(supplierId, password);
      setSuppliers((prev) =>
        prev.map((s) => (s.id === supplierId ? updated : s))
      );
      showToast(`Login created for ${updated.name}`, 'success');
    } else {
      const updated = await setSupplierPassword(supplierId, password);
      setSuppliers((prev) =>
        prev.map((s) => (s.id === supplierId ? updated : s))
      );
      showToast(`Password reset for ${updated.name}`, 'success');
    }
  };

  const handleToggleStatus = async (supplier: Supplier) => {
    if (togglingId) return;
    setTogglingId(supplier.id);
    try {
      const updated = await setSupplierActive(supplier.id, !supplier.isActive);
      setSuppliers((prev) =>
        prev.map((s) => (s.id === supplier.id ? { ...s, isActive: updated.isActive } : s))
      );
      const action = updated.isActive ? 'activated' : 'deactivated';
      showToast(`Supplier ${supplier.name} ${action}`, 'info');
    } catch (err: any) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      setTogglingId(null);
    }
  };
// Filter by supplier name or GST number (case-insensitive)
const filteredSuppliers = suppliers.filter((s) => {
  const term = searchTerm.toLowerCase().trim();
  if (!term) return true;
  return (
    s.name.toLowerCase().includes(term) ||
    s.gstNumber.toLowerCase().includes(term)
  );
});
  return (
    <div className="supplier-credentials-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Supplier Credentials</h2>
          <p className="page-subtitle">
            Manage supplier portal access, create accounts, and reset credentials
          </p>
        </div>
      </div>
      {/* Search Bar */}
<div className="card" style={{ marginBottom: '16px', padding: '14px 20px' }}>
  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
    <input
      type="text"
      className="input-field"
      placeholder="Search by Supplier Name or GST Number..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      style={{ maxWidth: '450px' }}
    />
    {searchTerm && (
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setSearchTerm('')}
      >
        Clear
      </button>
    )}
    <span style={{ fontSize: '13px', color: '#64748b', marginLeft: 'auto' }}>
      Showing {filteredSuppliers.length} of {suppliers.length} suppliers
    </span>
  </div>
</div>

      <div className="card">
        {loading ? (
          <div className="state-container">
            <div className="spinner" />
            <div className="state-title">Loading Suppliers...</div>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="state-container">
            <div className="state-title">No suppliers found</div>
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier Name</th>
                  <th>GST Number</th>
                  <th>Account Status</th>
                  <th>Password Configured</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.gstNumber}</td>
                    <td>
                      {s.isActive ? (
                        <span className="supplier-status-badge status-active">Active</span>
                      ) : (
                        <span className="supplier-status-badge status-inactive">Inactive</span>
                      )}
                    </td>
                    <td>
                      {s.hasPassword ? (
                        <span className="has-pwd-badge pwd-yes">Yes (Configured)</span>
                      ) : (
                        <span className="has-pwd-badge pwd-no">No Login Yet</span>
                      )}
                    </td>
                    <td>
                      <div className="credentials-action-buttons">
                        {s.hasPassword ? (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenPasswordModal(s, 'reset')}
                          >
                            Set / Reset Password
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleOpenPasswordModal(s, 'create')}
                          >
                            Create Login
                          </button>
                        )}

                        <button
                          type="button"
                          className={`btn btn-sm ${s.isActive ? 'btn-danger' : 'btn-success'}`}
                          disabled={togglingId === s.id}
                          onClick={() => handleToggleStatus(s)}
                        >
                          {togglingId === s.id ? 'Updating...' : s.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PasswordModal
        supplier={modalSupplier}
        mode={modalMode}
        onClose={() => setModalSupplier(null)}
        onSubmit={handlePasswordSubmit}
      />
    </div>
  );
};
