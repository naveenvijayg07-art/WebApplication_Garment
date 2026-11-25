import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import './Layout.css';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="layout-root">
      {/* Top Navbar */}
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="mobile-menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          <div className="portal-logo">
            <span className="logo-badge">WO</span>
            <span className="logo-title">Supplier Work Order Portal</span>
          </div>
        </div>

        <div className="topbar-right">
          <div className="user-profile">
            <span className="user-avatar">{user?.name ? user.name.charAt(0) : 'U'}</span>
            <div className="user-details">
              <span className="user-name">{user?.name}</span>
              <span className="user-role-tag">{user?.role === 'admin' ? 'QC' : 'Supplier'}</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Sign out">
            Logout
          </button>
        </div>
      </header>

      <div className="layout-body">
        {/* Backdrop for mobile/tablet */}
        {sidebarOpen && <div className="sidebar-backdrop" onClick={closeSidebar} />}

        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-section-label">Navigation Menu</div>
          <nav className="nav-menu">
            {user?.role === 'supplier' ? (
              <>
                <NavLink
                  to="/supplier/work-orders"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={closeSidebar}
                >
                  <span className="nav-icon">📋</span>
                  <span>My Work Orders</span>
                </NavLink>
                <NavLink
                  to="/supplier/reports"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={closeSidebar}
                >
                  <span className="nav-icon">📊</span>
                  <span>My Reports</span>
                </NavLink>
                <NavLink
                  to="/change-password"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={closeSidebar}
                >
                  {/* <span className="nav-icon">🔒</span>
                  <span>Change Password</span> */}
                </NavLink>
              </>
            ) : (
              <>
                <NavLink
                  to="/admin/suppliers"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={closeSidebar}
                >
                  <span className="nav-icon">🏢</span>
                  <span>Supplier Credentials</span>
                </NavLink>
                <NavLink
                  to="/admin/status"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={closeSidebar}
                >
                  <span className="nav-icon">📈</span>
                  <span>Status Monitoring</span>
                </NavLink>
                <NavLink
                  to="/admin/reports"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={closeSidebar}
                >
                  <span className="nav-icon">📄</span>
                  <span>Reports</span>
                </NavLink>
                <NavLink
                  to="/change-password"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  onClick={closeSidebar}
                >
                  <span className="nav-icon">🔒</span>
                  <span>Change Password</span>
                </NavLink>
              </>
            )}
          </nav>

          {user?.role === 'supplier' && user.gstNumber && (
            <div className="sidebar-footer-card">
              <span className="gst-label">GSTIN</span>
              <span className="gst-val">{user.gstNumber}</span>
            </div>
          )}
        </aside>

        {/* Main Content Area */}
        <main className="content-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
