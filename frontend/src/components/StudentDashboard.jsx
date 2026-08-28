import React, { useState } from 'react';
import TicketCard from './TicketCard';

export default function StudentDashboard({ session, requests, onSubmitRequest, onAction, onSaveProfileAddress, onShareLocation }) {
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

  const [dateError, setDateError] = useState('');

  const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getLocalTimeString = (d = new Date()) => {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const validateOutPassDates = (fromDateStr, toDateStr) => {
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const currentHHmm = getLocalTimeString(now);

    if (fromDateStr) {
      const [fromDatePart, fromTimePart] = fromDateStr.split('T');

      // 1. Date restriction: Today or Future
      if (fromDatePart < todayStr) {
        return { isValid: false, error: 'Out Date cannot be in the past. Only Today and future dates are allowed.' };
      }

      // 3. Time restriction: 05:00 AM to 06:00 PM
      if (fromTimePart) {
        if (fromTimePart < '05:00' || fromTimePart > '18:00') {
          return { isValid: false, error: 'Out Time must be between 05:00 AM and 06:00 PM.' };
        }
      }

      // 4. Today time check: prevent selecting a time that has already passed
      if (fromDatePart === todayStr && fromTimePart) {
        if (fromDateStr < `${todayStr}T${currentHHmm}`) {
          return { isValid: false, error: 'Out Date & Time cannot be in the past.' };
        }
      }
    }

    if (toDateStr) {
      const [toDatePart, toTimePart] = toDateStr.split('T');

      // 1. Date restriction: Today or Future
      if (toDatePart < todayStr) {
        return { isValid: false, error: 'Expected Return date cannot be in the past. Only Today and future dates are allowed.' };
      }

      // 3. Time restriction: 05:00 AM to 06:00 PM
      if (toTimePart) {
        if (toTimePart < '05:00' || toTimePart > '18:00') {
          return { isValid: false, error: 'Expected Return time must be between 05:00 AM and 06:00 PM.' };
        }
      }

      // 4. Today time check
      if (toDatePart === todayStr && toTimePart) {
        if (toDateStr < `${todayStr}T${currentHHmm}`) {
          return { isValid: false, error: 'Expected Return date & time cannot be in the past.' };
        }
      }
    }

    // 4. Expected Return must be strictly after Out Date & Time
    if (fromDateStr && toDateStr) {
      if (new Date(toDateStr) <= new Date(fromDateStr)) {
        return { isValid: false, error: 'Expected Return date & time must be after Out Date & Time.' };
      }
    }

    return { isValid: true, error: '' };
  };

  const handleFromDateChange = (val) => {
    setFromDate(val);
    const check = validateOutPassDates(val, toDate);
    setDateError(check.isValid ? '' : check.error);
  };

  const handleToDateChange = (val) => {
    setToDate(val);
    const check = validateOutPassDates(fromDate, val);
    setDateError(check.isValid ? '' : check.error);
  };

  const getFromDateMin = () => {
    const now = new Date();
    const today = getLocalDateString(now);
    const nowTime = getLocalTimeString(now);

    if (fromDate) {
      const [datePart] = fromDate.split('T');
      if (datePart === today) {
        const minTime = nowTime > '05:00' ? nowTime : '05:00';
        return `${today}T${minTime}`;
      } else if (datePart > today) {
        return `${datePart}T05:00`;
      }
    }
    const minTime = nowTime > '05:00' ? nowTime : '05:00';
    return `${today}T${minTime}`;
  };

  const getFromDateMax = () => {
    if (fromDate) {
      const [datePart] = fromDate.split('T');
      if (datePart) return `${datePart}T18:00`;
    }
    return undefined;
  };

  const getToDateMin = () => {
    const now = new Date();
    const today = getLocalDateString(now);
    const nowTime = getLocalTimeString(now);

    if (toDate) {
      const [toPart] = toDate.split('T');
      if (fromDate) {
        const [fromPart] = fromDate.split('T');
        if (toPart === fromPart) {
          return fromDate;
        }
      }
      if (toPart === today) {
        const minTime = nowTime > '05:00' ? nowTime : '05:00';
        return `${today}T${minTime}`;
      } else if (toPart > today) {
        return `${toPart}T05:00`;
      }
    }

    if (fromDate) {
      return fromDate;
    }

    const minTime = nowTime > '05:00' ? nowTime : '05:00';
    return `${today}T${minTime}`;
  };

  const getToDateMax = () => {
    if (toDate) {
      const [datePart] = toDate.split('T');
      if (datePart) return `${datePart}T18:00`;
    }
    return undefined;
  };

  const handleRoomChange = (e) => {
    setRoom(e.target.value.replace(/[^0-9]/g, ''));
  };

  const handlePhoneChange = (e) => {
    setParentPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!/^[0-9]{10}$/.test(parentPhone.trim())) {
      alert('Parent Mobile No. must be exactly 10 digits.');
      return;
    }

    const val = validateOutPassDates(fromDate, toDate);
    if (!fromDate || !toDate) {
      alert('Both Out Date & Time and Expected Return are required.');
      return;
    }
    if (!val.isValid) {
      alert(val.error);
      setDateError(val.error);
      return;
    }

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
      reason: reason.trim(),
      department: session.department || '',
      year: session.year || ''
    });
    setFromDate('');
    setToDate('');
    setReason('');
    setDateError('');
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
              <input
                required
                type="datetime-local"
                value={fromDate}
                min={getFromDateMin()}
                max={getFromDateMax()}
                onChange={(e) => handleFromDateChange(e.target.value)}
              />
            </div>
            <div className="gkof-field">
              <label>Expected Return</label>
              <input
                required
                type="datetime-local"
                value={toDate}
                min={getToDateMin()}
                max={getToDateMax()}
                onChange={(e) => handleToDateChange(e.target.value)}
              />
            </div>
          </div>
          {dateError && (
            <div style={{ color: '#c5221f', backgroundColor: '#fce8e6', border: '1px solid #fad2cf', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>
              ⚠️ {dateError}
            </div>
          )}

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
              <input
                required
                placeholder="10-digit mobile"
                pattern="[0-9]{10}"
                maxLength={10}
                inputMode="numeric"
                title="Parent mobile number must be exactly 10 digits"
                value={parentPhone}
                onChange={handlePhoneChange}
              />
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
            mine.map(r => <TicketCard key={r.requestId || r.id || r._id} request={r} viewer="student" onAction={onAction} onShareLocation={onShareLocation} />)
          ) : (
            <div className="gkof-empty">No requests yet. Submit the form above.</div>
          )}
        </div>
      </div>
    </>
  );
}
