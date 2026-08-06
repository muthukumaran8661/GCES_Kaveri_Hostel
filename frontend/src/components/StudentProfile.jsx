import React, { useState } from 'react';

export default function StudentProfile({ session, onSaveAddress, onLogout }) {
  const [address, setAddress] = useState(session.homeAddress || '');
  const [savedMsg, setSavedMsg] = useState(false);

  const initial = (session.name || '?').trim().charAt(0).toUpperCase() || '?';

  const handleSave = async () => {
    await onSaveAddress(address.trim());
    setSavedMsg(true);
    setTimeout(() => { setSavedMsg(false); }, 1800);
  };

  return (
    <>
      <div className="gkof-card" style={{ textAlign: 'center' }}>
        <div className="gkof-avatar">{initial}</div>
        <div className="gkof-profile-name">{session.name}</div>
        <div className="gkof-profile-role">Student</div>
      </div>

      <div className="gkof-card">
        <h3>Personal Information</h3>
        <div className="gkof-profile-row"><span className="k">Student ID</span><span className="v">{session.studentId || session.username || '—'}</span></div>
        <div className="gkof-profile-row"><span className="k">Register No.</span><span className="v">{session.reg || '—'}</span></div>
        <div className="gkof-profile-row"><span className="k">Room No.</span><span className="v">{session.room || '—'}</span></div>
      </div>

      <div className="gkof-card">
        <h3>Home Address</h3>
        <div className="gkof-field">
          <label>Permanent Hometown Address</label>
          <textarea
            rows={2}
            placeholder="e.g. 12/4, Main Road, Thanjavur - 613001"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          ></textarea>
        </div>
        <div className="gkof-note">Set this once here — it will auto-fill as the Destination every time you submit a new Out Request.</div>
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
