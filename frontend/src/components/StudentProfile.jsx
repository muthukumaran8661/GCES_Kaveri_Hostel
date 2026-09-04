import React, { useState, useEffect } from 'react';
import SettingsModal from './SettingsModal';

function normalizeYear(y) {
  if (!y) return 'I Year';
  const s = String(y).trim();
  if (/^I(\s+Year)?$/i.test(s) || /^1(st)?(\s+Year)?$/i.test(s)) return 'I Year';
  if (/^II(\s+Year)?$/i.test(s) || /^2(nd)?(\s+Year)?$/i.test(s)) return 'II Year';
  if (/^III(\s+Year)?$/i.test(s) || /^3(rd)?(\s+Year)?$/i.test(s)) return 'III Year';
  if (/^IV(\s+Year)?$/i.test(s) || /^4(th)?(\s+Year)?$/i.test(s)) return 'IV Year';
  if (/ALL/i.test(s)) return 'All Years';
  return s;
}

export default function StudentProfile({ session, onUpdateYear, onSaveAddress, onLogout, themeMode = 'system', onThemeChange }) {
  const [address, setAddress] = useState(session.homeAddress || '');
  const [savedMsg, setSavedMsg] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Year Edit state
  const [isEditingYear, setIsEditingYear] = useState(false);
  const [selectedYear, setSelectedYear] = useState(normalizeYear(session.year));
  const [savingYear, setSavingYear] = useState(false);
  const [yearSuccessMsg, setYearSuccessMsg] = useState('');
  const [yearErrorMsg, setYearErrorMsg] = useState('');

  const initial = (session.name || '?').trim().charAt(0).toUpperCase() || '?';

  useEffect(() => {
    if (!isEditingYear) {
      setSelectedYear(normalizeYear(session.year));
    }
  }, [session.year, isEditingYear]);

  const handleSaveAddress = async () => {
    await onSaveAddress(address.trim());
    setSavedMsg(true);
    setTimeout(() => { setSavedMsg(false); }, 1800);
  };

  const handleSaveYear = async () => {
    try {
      setSavingYear(true);
      setYearErrorMsg('');
      if (onUpdateYear) {
        await onUpdateYear(selectedYear);
      }
      setIsEditingYear(false);
      setYearSuccessMsg('Year updated successfully.');
      setTimeout(() => { setYearSuccessMsg(''); }, 3500);
    } catch (err) {
      setYearErrorMsg(err.message || 'Failed to update Year.');
    } finally {
      setSavingYear(false);
    }
  };

  const handleCancelYear = () => {
    setSelectedYear(normalizeYear(session.year));
    setIsEditingYear(false);
    setYearErrorMsg('');
  };

  const displayYear = normalizeYear(session.year);

  return (
    <>
      <div className="gkof-card" style={{ textAlign: 'center' }}>
        <div className="gkof-avatar">{initial}</div>
        <div className="gkof-profile-name">{session.name}</div>
        <div className="gkof-profile-role">Student · {session.department || 'CSE'} ({displayYear})</div>
      </div>

      <div className="gkof-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0 }}>Personal Details</h3>
          {yearSuccessMsg && (
            <span style={{ color: 'var(--green, #127A6E)', fontSize: '12.5px', fontWeight: 600, background: 'var(--gold-soft, #EAF6F4)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--green, #127A6E)' }}>
              ✓ {yearSuccessMsg}
            </span>
          )}
          {yearErrorMsg && (
            <span style={{ color: 'var(--red, #9E1B32)', fontSize: '12.5px', fontWeight: 600 }}>
              {yearErrorMsg}
            </span>
          )}
        </div>

        {/* Student Name - Read-only */}
        <div className="gkof-profile-row">
          <span className="k">Student Name</span>
          <span className="v">{session.name || '—'}</span>
        </div>

        {/* Register Number - Read-only */}
        <div className="gkof-profile-row">
          <span className="k">Register Number</span>
          <span className="v">{session.reg || session.registerNumber || '—'}</span>
        </div>

        {/* Student ID - Read-only */}
        <div className="gkof-profile-row">
          <span className="k">Student ID</span>
          <span className="v">{session.studentId || session.username || '—'}</span>
        </div>

        {/* Department - Read-only */}
        <div className="gkof-profile-row">
          <span className="k">Department</span>
          <span className="v">{session.department || '—'}</span>
        </div>

        {/* Year - ONLY Year is Editable */}
        <div className="gkof-profile-row" style={{ alignItems: 'center' }}>
          <span className="k">Year</span>
          {isEditingYear ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                disabled={savingYear}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--gold, #D4AF37)',
                  background: 'var(--card-bg, #fff)',
                  color: 'var(--ink, #1F1B24)',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                <option value="I Year">I Year</option>
                <option value="II Year">II Year</option>
                <option value="III Year">III Year</option>
                <option value="IV Year">IV Year</option>
              </select>
              <button
                className="gkof-btn teal"
                onClick={handleSaveYear}
                disabled={savingYear}
                style={{ padding: '5px 14px', fontSize: '12px' }}
              >
                {savingYear ? 'Saving...' : 'Save'}
              </button>
              <button
                className="gkof-btn ghost"
                onClick={handleCancelYear}
                disabled={savingYear}
                style={{ padding: '5px 12px', fontSize: '12px' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="v" style={{ fontWeight: 700 }}>{displayYear}</span>
              <button
                className="gkof-btn ghost"
                onClick={() => { setIsEditingYear(true); setYearSuccessMsg(''); setYearErrorMsg(''); }}
                style={{
                  padding: '3px 10px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--gold-soft, #D4AF37)'
                }}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Email ID - Read-only, no Edit button */}
        <div className="gkof-profile-row">
          <span className="k">Email ID</span>
          <span className="v">{session.email || '—'}</span>
        </div>

        {/* Phone Number - Read-only */}
        <div className="gkof-profile-row">
          <span className="k">Phone Number</span>
          <span className="v">{session.phone || '—'}</span>
        </div>

        {/* Room Number - Read-only */}
        <div className="gkof-profile-row">
          <span className="k">Room Number</span>
          <span className="v">{session.room || '—'}</span>
        </div>
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

      <div className="gkof-card">
        <h3>Academic &amp; Profile Details</h3>
        <div className="gkof-field">
          <label>Permanent Hometown Address</label>
          <textarea
            rows={2}
            placeholder="e.g. 12/4, Main Road, Thanjavur - 613001"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          ></textarea>
        </div>
        <div className="gkof-note">Set this once here — home address will auto-fill as the Destination on your out pass requests.</div>
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button className="gkof-btn teal" onClick={handleSaveAddress}>Save Address</button>
          {savedMsg && <span style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 600 }}>✓ Saved</span>}
        </div>
      </div>

      <div className="gkof-card">
        <button className="gkof-btn red wide" onClick={onLogout}>Log Out</button>
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
