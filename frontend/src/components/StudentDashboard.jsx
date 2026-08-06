import React, { useState } from 'react';
import TicketCard from './TicketCard';

export default function StudentDashboard({ session, requests, onSubmitRequest, onAction, onSaveProfileAddress }) {
  const mine = requests.slice().reverse();
  const total = mine.length;
  const pending = mine.filter(r => ['pending_staff', 'notifying_parent', 'pending_faculty'].includes(r.status)).length;
  const out = mine.filter(r => r.status === 'approved_final').length;
  const returned = mine.filter(r => r.status === 'returned').length;

  const hasSavedHome = !!session.homeAddress;

  const [room, setRoom] = useState(session.room || '');
  const [dest, setDest] = useState(session.homeAddress || '');
  const [saveHomeAddr, setSaveHomeAddr] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [travel, setTravel] = useState('Bus');
  const [parentPhone, setParentPhone] = useState('');
  const [requestType, setRequestType] = useState('weekend');
  const [reason, setReason] = useState('');

  const handleRoomChange = (e) => {
    setRoom(e.target.value.replace(/[^0-9]/g, ''));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (saveHomeAddr && dest.trim()) {
      await onSaveProfileAddress(dest.trim());
    }
    await onSubmitRequest({
      room: room.trim(),
      dest: dest.trim(),
      fromDate,
      toDate,
      travel,
      parentPhone: parentPhone.trim(),
      requestType,
      reason: reason.trim()
    });
    setFromDate('');
    setToDate('');
    setReason('');
  };

  return (
    <>
      <div className="gkof-stats">
        <div className="gkof-stat c1"><div className="n">{total}</div><div className="l">Total Requests</div></div>
        <div className="gkof-stat c2"><div className="n">{pending}</div><div className="l">In Progress</div></div>
        <div className="gkof-stat c3"><div className="n">{out}</div><div class="l">Currently Out</div></div>
        <div className="gkof-stat c4"><div className="n">{returned}</div><div className="l">Returned Safe</div></div>
      </div>

      <div className="gkof-card">
        <h3>New Out Request</h3>
        <form onSubmit={handleFormSubmit}>
          <div className="gkof-row">
            <div className="gkof-field">
              <label>Hostel / Room No.</label>
              <input
                required
                placeholder="e.g. 214"
                pattern="[0-9]+"
                inputMode="numeric"
                title="Room No. must be numbers only"
                value={room}
                onChange={handleRoomChange}
              />
            </div>
            <div className="gkof-field">
              <label>
                <span>Destination (Hometown Address)</span>
                {hasSavedHome && (
                  <span
                    style={{ color: 'var(--teal)', cursor: 'pointer', fontSize: '11px' }}
                    onClick={() => setDest(session.homeAddress)}
                  >
                    🏠 Auto-Fill Home Address
                  </span>
                )}
              </label>
              <input
                required
                placeholder="e.g. 12/4, Main Road, Thanjavur - 613001"
                value={dest}
                onChange={(e) => setDest(e.target.value)}
              />
              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="checkbox"
                  id="saveHomeChk"
                  checked={saveHomeAddr}
                  onChange={(e) => setSaveHomeAddr(e.target.checked)}
                  style={{ width: 'auto', accentColor: 'var(--teal)' }}
                />
                <label htmlFor="saveHomeChk" style={{ fontSize: '11.5px', color: 'var(--ink-soft)', fontWeight: 'normal', cursor: 'pointer', display: 'inline' }}>
                  Save this as my default Home Address for future requests
                </label>
              </div>
            </div>
          </div>

          <div className="gkof-row">
            <div className="gkof-field">
              <label>Out Date &amp; Time</label>
              <input required type="datetime-local" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="gkof-field">
              <label>Expected Return</label>
              <input required type="datetime-local" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>
          </div>

          <div className="gkof-row">
            <div className="gkof-field">
              <label>Mode of Travel</label>
              <select value={travel} onChange={(e) => setTravel(e.target.value)}>
                <option>Bus</option>
                <option>Train</option>
                <option>Parent Pickup</option>
                <option>Other</option>
              </select>
            </div>
            <div className="gkof-field">
              <label>Parent Mobile No.</label>
              <input required placeholder="10-digit mobile" pattern="[0-9]{10}" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
            </div>
          </div>

          <div className="gkof-field">
            <label>Request Type</label>
            <div className="gkof-radio-group">
              <label className="gkof-radio-opt">
                <input
                  type="radio"
                  name="requestType"
                  value="weekend"
                  checked={requestType === 'weekend'}
                  onChange={() => setRequestType('weekend')}
                />
                Weekend Out Pass
              </label>
              <label className="gkof-radio-opt">
                <input
                  type="radio"
                  name="requestType"
                  value="weekday"
                  checked={requestType === 'weekday'}
                  onChange={() => setRequestType('weekday')}
                />
                Weekday Out Pass
              </label>
            </div>
          </div>

          <div className="gkof-field">
            <label>Reason</label>
            <textarea required rows={2} placeholder="Reason for going home" value={reason} onChange={(e) => setReason(e.target.value)}></textarea>
          </div>

          <button className="gkof-btn gold" type="submit">Submit Request</button>
        </form>
      </div>

      <div className="gkof-card">
        <h3>My Requests <span className="count">{mine.length}</span></h3>
        <div>
          {mine.length ? (
            mine.map(r => <TicketCard key={r.requestId || r.id || r._id} request={r} viewer="student" onAction={onAction} />)
          ) : (
            <div className="gkof-empty">No requests yet. Submit the form above.</div>
          )}
        </div>
      </div>
    </>
  );
}
