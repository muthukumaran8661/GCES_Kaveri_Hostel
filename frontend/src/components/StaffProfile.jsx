import React, { useState } from 'react';
import SettingsModal from './SettingsModal';

function normalizeYear(y) {
  if (!y) return 'All Years';
  const s = String(y).trim();
  if (/^I(\s+Year)?$/i.test(s) || /^1(st)?(\s+Year)?$/i.test(s)) return 'I Year';
  if (/^II(\s+Year)?$/i.test(s) || /^2(nd)?(\s+Year)?$/i.test(s)) return 'II Year';
  if (/^III(\s+Year)?$/i.test(s) || /^3(rd)?(\s+Year)?$/i.test(s)) return 'III Year';
  if (/^IV(\s+Year)?$/i.test(s) || /^4(th)?(\s+Year)?$/i.test(s)) return 'IV Year';
  if (/ALL/i.test(s)) return 'All Years';
  return s;
}

export default function StaffProfile({ session, onLogout, themeMode = 'system', onThemeChange }) {
  const initial = (session.name || session.staffId || '?').trim().charAt(0).toUpperCase() || '?';
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const displayYear = normalizeYear(session.year);
  const isWarden = session.role === 'staff' || session.role === 'admin';
  const displayDesignation = isWarden
    ? (displayYear && displayYear !== 'All Years' ? `${displayYear} Warden` : (session.designation || 'Warden'))
    : (session.designation || 'Faculty Advisor');

  const handleLogoutClick = () => {
    setShowConfirm(true);
  };

  const confirmLogout = () => {
    setShowConfirm(false);
    onLogout();
  };

  return (
    <>
      <div className="gkof-card" style={{ textAlign: 'center' }}>
        <div className="gkof-avatar staff-avatar">{initial}</div>
        <div className="gkof-profile-name">{session.name || session.staffId || 'Warden'}</div>
        <div className="gkof-profile-role">
          {isWarden ? 'Warden' : 'Faculty Advisor'} · {session.department || (isWarden ? 'Hostel Administration' : 'All Depts')} ({displayYear})
        </div>
      </div>

      <div className="gkof-card">
        <h3>Personal &amp; Authorization Details</h3>
        <div className="gkof-profile-row"><span className="k">Name</span><span className="v">{session.name || session.staffId || '—'}</span></div>
        <div className="gkof-profile-row"><span className="k">{isWarden ? 'Warden ID' : 'Faculty ID'}</span><span className="v">{session.staffId || session.username || '—'}</span></div>
        <div className="gkof-profile-row"><span className="k">Role</span><span className="v" style={{ fontWeight: 600 }}>{isWarden ? 'Warden' : 'Faculty Advisor'}</span></div>
        <div className="gkof-profile-row"><span className="k">Designation</span><span className="v" style={{ fontWeight: 600 }}>{displayDesignation}</span></div>
        <div className="gkof-profile-row"><span className="k">Department</span><span className="v">{session.department || (isWarden ? 'Hostel Administration' : '—')}</span></div>
        <div className="gkof-profile-row"><span className="k">Assigned Year</span><span className="v" style={{ fontWeight: 600 }}>{displayYear}</span></div>
        <div className="gkof-profile-row">
          <span className="k">Approval Status</span>
          <span className="v" style={{ fontWeight: 600, color: session.status === 'inactive' ? 'var(--red)' : 'var(--green)' }}>
            {session.status === 'inactive' ? '🔴 Inactive' : '🟢 Active'}
          </span>
        </div>
        <div className="gkof-profile-row"><span className="k">Email</span><span className="v">{session.email || '—'}</span></div>
        <div className="gkof-profile-row"><span className="k">Phone Number</span><span className="v">{session.phone || '—'}</span></div>
      </div>

      {/* Settings Section directly below Personal Information */}
      <div
        className="gkof-card"
        style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
        onClick={() => setShowSettings(true)}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: 'var(--gold-soft)', width: '42px', height: '42px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
              ⚙️
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px' }}>Settings</h3>
              <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'var(--ink-soft)' }}>
                Customize your application preferences and appearance
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--maroon)', background: 'var(--gold-soft)', padding: '3px 10px', borderRadius: '12px', textTransform: 'capitalize' }}>
              {themeMode === 'system' ? 'System' : themeMode} Mode
            </span>
            <span style={{ fontSize: '16px', color: 'var(--ink-soft)', fontWeight: 'bold' }}>❯</span>
          </div>
        </div>
      </div>

      <div className="gkof-card" style={{ textAlign: 'center' }}>
        {!showConfirm ? (
          <button className="gkof-btn red wide" onClick={handleLogoutClick}>Log Out</button>
        ) : (
          <div className="gkof-logout-confirm">
            <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
              Are you sure you want to logout?
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button className="gkof-btn red" onClick={confirmLogout}>Yes, Log Out</button>
              <button className="gkof-btn ghost" onClick={() => setShowConfirm(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsModal
          currentTheme={themeMode}
          onThemeChange={onThemeChange}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
