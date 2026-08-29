import React, { useState } from 'react';
import TicketCard from './TicketCard';
import StudentQrModal from './StudentQrModal';

function TimePicker12Hour({
  label,
  dateVal,
  hourVal,
  minVal,
  ampmVal,
  minDateStr,
  onDateChange,
  onHourChange,
  onMinChange,
  onAmpmChange
}) {
  let displayFormatted = '';
  if (dateVal) {
    const [y, m, d] = dateVal.split('-');
    if (y && m && d) {
      displayFormatted = `${d}-${m}-${y} ${hourVal}:${minVal} ${ampmVal}`;
    }
  }

  return (
    <div className="gkof-field" style={{ flex: 1 }}>
      <label>{label}</label>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          required
          type="date"
          min={minDateStr}
          value={dateVal}
          onChange={(e) => onDateChange(e.target.value)}
          style={{ flex: '2 1 120px', minWidth: '120px' }}
        />
        <select
          value={hourVal}
          onChange={(e) => onHourChange(e.target.value)}
          style={{ flex: '1 1 60px', minWidth: '55px', padding: '9px 4px', fontWeight: 600 }}
        >
          {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <span style={{ fontWeight: 'bold', color: 'var(--ink)' }}>:</span>
        <select
          value={minVal}
          onChange={(e) => onMinChange(e.target.value)}
          style={{ flex: '1 1 60px', minWidth: '55px', padding: '9px 4px' }}
        >
          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={ampmVal}
          onChange={(e) => onAmpmChange(e.target.value)}
          style={{ flex: '1 1 65px', minWidth: '60px', padding: '9px 4px', fontWeight: 700, color: '#2A2140' }}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      {displayFormatted ? (
        <div style={{ fontSize: '11.5px', color: 'var(--teal)', fontWeight: 700, marginTop: '4px' }}>
          📅 {displayFormatted}
        </div>
      ) : (
        <div style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '4px' }}>
          Select Date &amp; 12-Hour Time (05:00 AM – 06:00 PM)
        </div>
      )}
    </div>
  );
}

export default function StudentDashboard({ session, requests, onSubmitRequest, onAction, onSaveProfileAddress, onShareLocation }) {
  const [qrModalRequest, setQrModalRequest] = useState(null);
  const mine = requests.slice().reverse();
  const total = mine.length;
  const pending = mine.filter(r => ['pending_staff', 'notifying_parent', 'pending_faculty'].includes(r.status)).length;
  const out = mine.filter(r => r.status === 'approved_final').length;
  const returned = mine.filter(r => r.status === 'returned').length;

  const hasSavedHome = !!session.homeAddress;

  const getLocalDateString = (d = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayDateStr = getLocalDateString();

  const [room, setRoom] = useState(session.room || '');
  const [dest, setDest] = useState(session.homeAddress || '');
  const [saveHomeAddr, setSaveHomeAddr] = useState(false);

  // 12-hour AM/PM Out Date & Time state
  const [outDate, setOutDate] = useState('');
  const [outHour, setOutHour] = useState('05');
  const [outMin, setOutMin] = useState('00');
  const [outAmpm, setOutAmpm] = useState('AM');

  // 12-hour AM/PM Expected Return state
  const [returnDate, setReturnDate] = useState('');
  const [returnHour, setReturnHour] = useState('06');
  const [returnMin, setReturnMin] = useState('00');
  const [returnAmpm, setReturnAmpm] = useState('PM');

  const [travel, setTravel] = useState('Bus');
  const [parentPhone, setParentPhone] = useState('');
  const [requestType, setRequestType] = useState('weekend');
  const [reason, setReason] = useState('');

  const [dateError, setDateError] = useState('');

  const get24HourString = (hour12, ampm) => {
    let h = parseInt(hour12, 10) || 0;
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return String(h).padStart(2, '0');
  };

  const getIsoString = (dStr, h12, mStr, ampm) => {
    if (!dStr) return '';
    const h24 = get24HourString(h12, ampm);
    const m = String(mStr || '00').padStart(2, '0');
    return `${dStr}T${h24}:${m}`;
  };

  const getMinutesFromMidnight = (hour12, mStr, ampm) => {
    let h = parseInt(hour12, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const validateOutPassDates = (oDate, oHour, oMin, oAmpm, rDate, rHour, rMin, rAmpm) => {
    const now = new Date();
    const todayStr = getLocalDateString(now);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // 1. OUT DATE & TIME Restrictions
    if (oDate) {
      if (oDate < todayStr) {
        return { isValid: false, error: 'Out Date cannot be in the past. Only Today and future dates are allowed.' };
      }

      const oMins = getMinutesFromMidnight(oHour, oMin, oAmpm);
      if (oMins < 300 || oMins > 1080) {
        return { isValid: false, error: 'Out Time must be between 05:00 AM and 06:00 PM.' };
      }

      if (oDate === todayStr && oMins < currentMinutes) {
        return { isValid: false, error: 'Out Date & Time cannot be in the past.' };
      }
    }

    // 2. EXPECTED RETURN Restrictions
    if (rDate) {
      if (rDate < todayStr) {
        return { isValid: false, error: 'Expected Return date cannot be in the past. Only Today and future dates are allowed.' };
      }

      const rMins = getMinutesFromMidnight(rHour, rMin, rAmpm);
      if (rMins < 300 || rMins > 1080) {
        return { isValid: false, error: 'Expected Return time must be between 05:00 AM and 06:00 PM.' };
      }

      if (rDate === todayStr && rMins < currentMinutes) {
        return { isValid: false, error: 'Expected Return date & time cannot be in the past.' };
      }
    }

    // 3. Expected Return must be strictly after Out Date & Time
    if (oDate && rDate) {
      const fromIso = getIsoString(oDate, oHour, oMin, oAmpm);
      const toIso = getIsoString(rDate, rHour, rMin, rAmpm);
      if (new Date(toIso) <= new Date(fromIso)) {
        return { isValid: false, error: 'Expected Return date & time must be after Out Date & Time.' };
      }
    }

    return { isValid: true, error: '' };
  };

  const handleOutChange = (newDate, newHour, newMin, newAmpm) => {
    setOutDate(newDate);
    setOutHour(newHour);
    setOutMin(newMin);
    setOutAmpm(newAmpm);
    const check = validateOutPassDates(newDate, newHour, newMin, newAmpm, returnDate, returnHour, returnMin, returnAmpm);
    setDateError(check.isValid ? '' : check.error);
  };

  const handleReturnChange = (newDate, newHour, newMin, newAmpm) => {
    setReturnDate(newDate);
    setReturnHour(newHour);
    setReturnMin(newMin);
    setReturnAmpm(newAmpm);
    const check = validateOutPassDates(outDate, outHour, outMin, outAmpm, newDate, newHour, newMin, newAmpm);
    setDateError(check.isValid ? '' : check.error);
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

    if (!outDate || !returnDate) {
      alert('Both Out Date & Time and Expected Return are required.');
      return;
    }

    const val = validateOutPassDates(outDate, outHour, outMin, outAmpm, returnDate, returnHour, returnMin, returnAmpm);
    if (!val.isValid) {
      alert(val.error);
      setDateError(val.error);
      return;
    }

    if (saveHomeAddr && dest.trim()) {
      if (onSaveProfileAddress) {
        await onSaveProfileAddress(dest.trim());
      }
    }

    const fromDateIso = getIsoString(outDate, outHour, outMin, outAmpm);
    const toDateIso = getIsoString(returnDate, returnHour, returnMin, returnAmpm);

    await onSubmitRequest({
      room: room.trim(),
      dest: dest.trim(),
      fromDate: fromDateIso,
      toDate: toDateIso,
      travel,
      parentPhone: parentPhone.trim(),
      requestType,
      reason: reason.trim(),
      department: session.department || '',
      year: session.year || ''
    });

    setOutDate('');
    setOutHour('05');
    setOutMin('00');
    setOutAmpm('AM');
    setReturnDate('');
    setReturnHour('06');
    setReturnMin('00');
    setReturnAmpm('PM');
    setReason('');
    setDateError('');
  };

  return (
    <>
      <div className="gkof-stats">
        <div className="gkof-stat c1">
          <div className="n">{total}</div>
          <div className="l">Total Requests</div>
        </div>
        <div className="gkof-stat c2">
          <div className="n">{pending}</div>
          <div className="l">Pending Approval</div>
        </div>
        <div className="gkof-stat c3">
          <div className="n">{out}</div>
          <div className="l">Currently Out</div>
        </div>
        <div className="gkof-stat c4">
          <div className="n">{returned}</div>
          <div className="l">Returned Safe</div>
        </div>
      </div>

      <div className="gkof-card">
        <h3>📝 New Out Pass Request</h3>

        <form onSubmit={handleFormSubmit}>
          <div className="gkof-row">
            <div className="gkof-field">
              <label>Hostel / Room No.</label>
              <input
                required
                placeholder="e.g. 204 or 53145"
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
            <TimePicker12Hour
              label="Out Date & Time"
              dateVal={outDate}
              hourVal={outHour}
              minVal={outMin}
              ampmVal={outAmpm}
              minDateStr={todayDateStr}
              onDateChange={(d) => handleOutChange(d, outHour, outMin, outAmpm)}
              onHourChange={(h) => handleOutChange(outDate, h, outMin, outAmpm)}
              onMinChange={(m) => handleOutChange(outDate, outHour, m, outAmpm)}
              onAmpmChange={(ap) => handleOutChange(outDate, outHour, outMin, ap)}
            />

            <TimePicker12Hour
              label="Expected Return"
              dateVal={returnDate}
              hourVal={returnHour}
              minVal={returnMin}
              ampmVal={returnAmpm}
              minDateStr={outDate || todayDateStr}
              onDateChange={(d) => handleReturnChange(d, returnHour, returnMin, returnAmpm)}
              onHourChange={(h) => handleReturnChange(returnDate, h, returnMin, returnAmpm)}
              onMinChange={(m) => handleReturnChange(returnDate, returnHour, m, returnAmpm)}
              onAmpmChange={(ap) => handleReturnChange(returnDate, returnHour, returnMin, ap)}
            />
          </div>

          {dateError && (
            <div style={{ color: '#c5221f', backgroundColor: '#fce8e6', border: '1px solid #fad2cf', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, marginTop: '8px' }}>
              ⚠️ {dateError}
            </div>
          )}

          <div className="gkof-row" style={{ marginTop: '12px' }}>
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
                type="tel"
                placeholder="10-digit Parent Mobile Number"
                maxLength={10}
                value={parentPhone}
                onChange={handlePhoneChange}
              />
            </div>
          </div>

          <div className="gkof-row">
            <div className="gkof-field">
              <label>Request Type</label>
              <select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
                <option value="weekend">Weekend Out Pass (Warden Approval)</option>
                <option value="weekday">Weekday / Emergency Out Pass (Faculty &amp; Warden Approval)</option>
              </select>
            </div>
            <div className="gkof-field">
              <label>Reason for Leave</label>
              <input
                required
                placeholder="e.g. Going home for weekend / Medical reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <button className="gkof-btn maroon wide" type="submit" style={{ marginTop: '8px' }}>
            Submit Out Pass Request
          </button>
        </form>
      </div>

      <div className="gkof-card">
        <h3>📋 My Out Pass Request History <span className="count">{total}</span></h3>
        <div>
          {mine.length ? (
            mine.map(r => (
              <TicketCard
                key={r.requestId || r.id || r._id}
                request={r}
                viewer="student"
                onAction={onAction}
                onShareLocation={onShareLocation}
                onViewQr={setQrModalRequest}
              />
            ))
          ) : (
            <div className="gkof-empty">No out pass requests submitted yet.</div>
          )}
        </div>
      </div>

      {qrModalRequest && (
        <StudentQrModal
          request={qrModalRequest}
          onClose={() => setQrModalRequest(null)}
        />
      )}
    </>
  );
}
