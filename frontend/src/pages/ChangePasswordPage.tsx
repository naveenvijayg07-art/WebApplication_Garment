import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { changePassword } from '../api/authApi';
import { getErrorMessage } from '../api/client';
import { useToast } from '../components/Toast';
import './ChangePasswordPage.css';

export const ChangePasswordPage: React.FC = () => {
  const { user, markPasswordChanged } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (oldPassword === newPassword) {
      setError('New password cannot be the same as your old password.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(newPassword, oldPassword);
      markPasswordChanged();
      showToast('Password updated successfully!', 'success');
      if (user?.role === 'admin') {
        navigate('/admin/suppliers');
      } else {
        navigate('/supplier/work-orders');
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-pwd-container">
      <div className="page-header">
        <div>
          <h2 className="page-title">Change Password</h2>
          <p className="page-subtitle">Update your supplier account credentials</p>
        </div>
      </div>

      <div className="card change-pwd-card">
        {user?.mustChangePassword && (
          <div className="pwd-alert-banner">
            ⚠️ <strong>Action Required:</strong> You must update your temporary password before proceeding.
          </div>
        )}

        {error && <div className="pwd-error-banner">{error}</div>}

        <form onSubmit={handleSubmit} className="pwd-form">
          <div className="form-group">
            <label htmlFor="old-pwd">Current Password</label>
            <input
              id="old-pwd"
              type="password"
              className="input-field"
              placeholder="Enter your current password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="new-pwd">New Password</label>
            <input
              id="new-pwd"
              type="password"
              className="input-field"
              placeholder="Enter new password (min. 8 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm-pwd">Confirm New Password</label>
            <input
              id="confirm-pwd"
              type="password"
              className="input-field"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="pwd-actions">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Update Password'}
            </button>
            {!user?.mustChangePassword && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/supplier/work-orders')}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
