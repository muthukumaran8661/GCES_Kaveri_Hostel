import React, { useState } from 'react';

export default function StaffProfile({ session, onLogout }) {
  const initial = (session.name || session.staffId || '?').trim().charAt(0).toUpperCase() || '?';

  // Compute some quick stats from session if available
  const joinDate = session.createdAt
    ? new Date(session.createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogoutClick = () => {
    setShowConfirm(true);
  };

  const confirmLogout = () => {
    setShowConfirm(false);
    onLogout();
  };

  return (
    <>
      {/* Profile Header Card */}
      <div className="gkof-card" style={{ textAlign: 'center' }}>
        <div className="gkof-avatar staff-avatar">{initial}</div>
        <div className="gkof-profile-name">{session.name || session.staffId || 'Staff'}</div>
        <div className="gkof-profile-role">
          <span className="gkof-staff-badge">
            🛡️ {session.designation || 'Staff'}
          </span>
        </div>
      </div>

      {/* Staff Information Card */}
      <div className="gkof-card">
        <h3>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>📋</span>
            Staff Information
          </span>
        </h3>
        <div className="gkof-profile-row">
          <span className="k">Staff ID</span>
          <span className="v">{session.staffId || session.username || '—'}</span>
        </div>
        <div className="gkof-profile-row">
          <span className="k">Designation</span>
          <span className="v">{session.designation || '—'}</span>
        </div>
        <div className="gkof-profile-row">
          <span className="k">Username</span>
          <span className="v">{session.username || '—'}</span>
        </div>
        <div className="gkof-profile-row">
          <span className="k">Role</span>
          <span className="v" style={{ textTransform: 'capitalize' }}>{session.role || '—'}</span>
        </div>
        <div className="gkof-profile-row">
          <span className="k">Member Since</span>
          <span className="v">{joinDate}</span>
        </div>
      </div>

      {/* Quick Actions Card */}
      <div className="gkof-card">
        <h3>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>⚡</span>
            Quick Actions
          </span>
        </h3>
        <div className="gkof-note" style={{ marginTop: '0' }}>
          Use the <strong>Dashboard</strong> tab to manage student gate pass requests — approve, reject, or track students currently out of the hostel.
        </div>
      </div>

      {/* Logout Card */}
      <div className="gkof-card" style={{ textAlign: 'center' }}>
        {!showConfirm ? (
          <button className="gkof-btn red wide gkof-logout-btn" onClick={handleLogoutClick}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Log Out
            </span>
          </button>
        ) : (
          <div className="gkof-logout-confirm">
            <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Are you sure you want to log out?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="gkof-btn red" onClick={confirmLogout}>Yes, Log Out</button>
              <button className="gkof-btn ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
