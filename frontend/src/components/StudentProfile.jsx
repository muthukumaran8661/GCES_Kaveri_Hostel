import React, { useState } from 'react';

function normalizeYear(y) {
  if (!y) return 'I Year';
  const s = String(y).trim().toUpperCase();
  if (s.startsWith('1') || (s.startsWith('I') && !s.startsWith('IV'))) return 'I Year';
  if (s.startsWith('2') || s.startsWith('II')) return 'II Year';
  if (s.startsWith('3') || s.startsWith('III')) return 'III Year';
  if (s.startsWith('4') || s.startsWith('IV')) return 'IV Year';
  return y;
}

export default function StudentProfile({ session, onSaveAddress, onLogout }) {
  const [address, setAddress] = useState(session.homeAddress || '');
  const [savedMsg, setSavedMsg] = useState(false);

  const initial = (session.name || '?').trim().charAt(0).toUpperCase() || '?';

  const handleSave = async () => {
    await onSaveAddress(address.trim());
    setSavedMsg(true);
    setTimeout(() => { setSavedMsg(false); }, 1800);
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
        <h3>Personal Information</h3>
        <div className="gkof-profile-row"><span className="k">Student ID</span><span className="v">{session.studentId || session.username || '—'}</span></div>
        <div className="gkof-profile-row"><span className="k">Register No.</span><span className="v">{session.reg || '—'}</span></div>
        <div className="gkof-profile-row"><span className="k">Department</span><span className="v">{session.department || '—'}</span></div>
        <div className="gkof-profile-row"><span className="k">Academic Year</span><span className="v">{displayYear || '—'}</span></div>
        <div className="gkof-profile-row"><span className="k">Room No.</span><span className="v">{session.room || '—'}</span></div>
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
          <button className="gkof-btn teal" onClick={handleSave}>Save Address</button>
          {savedMsg && <span style={{ color: 'var(--green)', fontSize: '12px', fontWeight: 600 }}>✓ Saved</span>}
        </div>
      </div>

      <div className="gkof-card">
        <button className="gkof-btn red wide" onClick={onLogout}>Log Out</button>
      </div>
    </>
  );
}
