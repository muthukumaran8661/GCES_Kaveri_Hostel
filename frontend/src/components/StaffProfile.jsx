import React, { useState } from 'react';

export default function StaffProfile({ session, onLogout }) {
  const initial = (session.name || session.staffId || '?').trim().charAt(0).toUpperCase() || '?';

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
      <div className="gkof-card staff-profile-header">
        <div className="staff-profile-banner"></div>
        <div className="staff-profile-avatar-wrap">
          <div className="gkof-avatar staff-avatar">{initial}</div>
          <div className="staff-online-dot"></div>
        </div>
        <div className="gkof-profile-name">{session.name || session.staffId || 'Staff'}</div>
        <div className="gkof-profile-role">
          <span className="gkof-staff-badge">
            🛡️ {session.designation || 'Staff'}
          </span>
        </div>
        {session.department && (
          <div className="staff-profile-dept">{session.department}</div>
        )}
      </div>

      {/* Staff Information Card */}
      <div className="gkof-card">
        <h3>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--maroon)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Personal Details
          </span>
        </h3>
        <div className="gkof-profile-row">
          <span className="k">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: '6px', opacity: 0.6 }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Staff Name
          </span>
          <span className="v">{session.name || session.staffId || '—'}</span>
        </div>
        <div className="gkof-profile-row">
          <span className="k">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: '6px', opacity: 0.6 }}>
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M7 10h0M12 10h0M17 10h0" />
            </svg>
            Staff ID
          </span>
          <span className="v">{session.staffId || session.username || '—'}</span>
        </div>
        <div className="gkof-profile-row">
          <span className="k">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: '6px', opacity: 0.6 }}>
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            Designation
          </span>
          <span className="v">{session.designation || '—'}</span>
        </div>
        <div className="gkof-profile-row">
          <span className="k">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: '6px', opacity: 0.6 }}>
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Department
          </span>
          <span className="v">{session.department || '—'}</span>
        </div>
      </div>

      {/* Contact Information Card */}
      <div className="gkof-card">
        <h3>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Contact Information
          </span>
        </h3>
        <div className="gkof-profile-row">
          <span className="k">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: '6px', opacity: 0.6 }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Email
          </span>
          <span className="v">{session.email || '—'}</span>
        </div>
        <div className="gkof-profile-row">
          <span className="k">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: '6px', opacity: 0.6 }}>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            Phone Number
          </span>
          <span className="v">{session.phone || '—'}</span>
        </div>
        <div className="gkof-profile-row">
          <span className="k">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', marginRight: '6px', opacity: 0.6 }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Member Since
          </span>
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
          <button className="gkof-btn red wide gkof-logout-btn" onClick={handleLogoutClick} id="staff-logout-btn">
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
            <div className="gkof-logout-confirm-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p className="gkof-logout-confirm-title">
              Are you sure you want to logout?
            </p>
            <p className="gkof-logout-confirm-sub">
              You will be redirected to the login page.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="gkof-btn red" onClick={confirmLogout} id="staff-confirm-logout-btn">Yes, Log Out</button>
              <button className="gkof-btn ghost" onClick={() => setShowConfirm(false)} id="staff-cancel-logout-btn">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
