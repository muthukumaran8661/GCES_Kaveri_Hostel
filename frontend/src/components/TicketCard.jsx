import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { QRCodeSVG } from 'qrcode.react';
import logo from './../assets/logo.png';

function getLogoBase64(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      try {
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const STATUS_META = {
  pending_faculty: { label: 'Awaiting Faculty Advisor', cls: 'bg-gold-soft text-[#8A6100]' },
  faculty_rejected: { label: 'Faculty Declined', cls: 'bg-[#F8DAD5] text-danger' },
  pending_staff: { label: 'Awaiting Warden', cls: 'bg-gold-soft text-[#8A6100]' },
  staff_rejected: { label: 'Warden Declined', cls: 'bg-[#F8DAD5] text-danger' },
  notifying_parent: { label: 'Calling Parent', cls: 'bg-[#DCE6F5] text-[#1a4fb4]' },
  parent_rejected: { label: 'Parent Declined', cls: 'bg-[#F8DAD5] text-danger' },
  approved_final: { label: 'Approved — Out', cls: 'bg-maroon text-white' },
  returned: { label: 'Returned', cls: 'bg-[#E6E1F0] text-ink-soft' }
};

const REJECTED_STATUSES = ['faculty_rejected', 'staff_rejected', 'parent_rejected'];

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

export default function TicketCard({ request: r, viewer, onAction, onShareLocation, onViewQr }) {
  const meta = STATUS_META[r.status] || { label: r.status, cls: 'bg-gold-soft text-[#8A6100]' };
  const type = r.type === 'weekday' ? 'weekday' : 'weekend';
  const typeLabel = type === 'weekday' ? 'Weekday Out Pass' : 'Weekend Out Pass';
  const showFacultyApprove = viewer === 'staff' && r.status === 'pending_faculty';
  const showStaffApprove = viewer === 'staff' && r.status === 'pending_staff';
  const showParentRecord = viewer === 'staff' && r.status === 'notifying_parent';
  const showReturn = viewer === 'staff' && r.status === 'approved_final';
  const justStamped = r.status === 'approved_final' || r.status === 'returned';
  const isAccepted = r.status === 'approved_final';
  const isDeclined = REJECTED_STATUSES.includes(r.status);
  const isDownloadable = viewer === 'student' && (r.status === 'approved_final' || r.status === 'returned');
  const displayId = r.requestId || r.id;

  // GPS tracking state
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [gpsError, setGpsError] = useState('');
  const [showLocationPanel, setShowLocationPanel] = useState(false);

  const canShareLocation = viewer === 'student' && !REJECTED_STATUSES.includes(r.status) && r.status !== 'returned' && !!onShareLocation;
  const hasLocations = r.gpsLocations && r.gpsLocations.length > 0;
  const lastLocation = hasLocations ? r.gpsLocations[r.gpsLocations.length - 1] : null;
  const canViewLocation = canShareLocation || hasLocations;

  function fmtDate(d) {
    if (!d) return '—';

    // Parse datetime-local string (e.g. "2026-08-10T13:30") directly without timezone shifts
    if (typeof d === 'string' && d.includes('T')) {
      const parts = d.split('T');
      const dateParts = parts[0].split('-');
      const timeParts = parts[1].replace('Z', '').split(':');

      if (dateParts.length === 3 && timeParts.length >= 2) {
        const year = parseInt(dateParts[0], 10);
        const monthIdx = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        const hour24 = parseInt(timeParts[0], 10);
        const minute = parseInt(timeParts[1], 10);

        if (!isNaN(year) && !isNaN(monthIdx) && !isNaN(day) && !isNaN(hour24) && !isNaN(minute)) {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthStr = months[monthIdx] || dateParts[1];
          const dayStr = String(day).padStart(2, '0');

          const period = hour24 >= 12 ? 'pm' : 'am';
          const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
          const hourStr = String(hour12).padStart(2, '0');
          const minStr = String(minute).padStart(2, '0');

          return `${dayStr} ${monthStr} ${year} · ${hourStr}:${minStr} ${period}`;
        }
      }
    }

    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' +
      dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtTime(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' · ' + dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }

  function handleShareLocation() {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      setGpsStatus('error');
      return;
    }

    setGpsStatus('loading');
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await onShareLocation(displayId, position.coords.latitude, position.coords.longitude);
          setGpsStatus('success');
          setTimeout(() => setGpsStatus('idle'), 3000);
        } catch (err) {
          setGpsError('Failed to share location.');
          setGpsStatus('error');
        }
      },
      (err) => {
        let msg = 'Unable to retrieve your location.';
        if (err.code === 1) msg = 'Location permission denied. Please allow location access.';
        if (err.code === 2) msg = 'Location unavailable. Please try again.';
        if (err.code === 3) msg = 'Location request timed out. Please try again.';
        setGpsError(msg);
        setGpsStatus('error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function renderTimeline() {
    const isWeekday = type === 'weekday';
    const steps = isWeekday
      ? [{ label: 'Submitted' }, { label: 'Faculty Advisor' }, { label: 'Warden OK' }, { label: 'Parent OK' }, { label: 'Out / Back' }]
      : [{ label: 'Submitted' }, { label: 'Warden OK' }, { label: 'Parent OK' }, { label: 'Out / Back' }];
    let doneUpto = 0;
    if (isWeekday) {
      if (r.status === 'pending_staff') doneUpto = 1;
      if (r.status === 'staff_rejected') doneUpto = 1;
      if (r.status === 'notifying_parent') doneUpto = 2;
      if (r.status === 'parent_rejected') doneUpto = 2;
      if (r.status === 'approved_final') doneUpto = 3;
      if (r.status === 'returned') doneUpto = 4;
    } else {
      if (r.status === 'notifying_parent') doneUpto = 1;
      if (r.status === 'parent_rejected') doneUpto = 1;
      if (r.status === 'approved_final') doneUpto = 2;
      if (r.status === 'returned') doneUpto = 3;
    }
    const isRejected = REJECTED_STATUSES.includes(r.status);

    return (
      <div className="gkof-timeline">
        {steps.map((s, i) => {
          const done = i <= doneUpto && !isRejected;
          const active = i === doneUpto + 1 && !isRejected;
          return (
            <div key={i} className={`gkof-tl-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}>
              <div className="gkof-tl-dot">{done ? '✓' : ''}</div>
              <div className="gkof-tl-label">{s.label}</div>
            </div>
          );
        })}
      </div>
    );
  }

  async function downloadOutPass() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const maroon = [158, 27, 50];
    const gold = [217, 164, 65];
    const ink = [42, 33, 64];
    const inkSoft = [122, 114, 144];

    // Load logo image as base64
    const logoData = await getLogoBase64(logo);

    doc.setFillColor(...maroon);
    doc.rect(0, 0, pageW, 86, 'F');

    let textX = 40;
    if (logoData) {
      // Circular white badge background for logo
      doc.setFillColor(255, 255, 255);
      doc.circle(60, 43, 26, 'F');
      // Draw logo inside circle
      doc.addImage(logoData, 'PNG', 37, 20, 46, 46);
      textX = 98;
    }

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(16.5);
    doc.text('GCES Kaveri Girls Hostel', textX, 35);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    doc.text('Government College of Engineering, Srirangam · Hostel Gate Pass', textX, 52);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12.5);
    doc.text(r.status === 'returned' ? 'RETURNED — PASS COMPLETE' : 'APPROVED OUT PASS', textX, 71);

    doc.setFillColor(...gold);
    doc.roundedRect(pageW - 150, 26, 110, 26, 6, 6, 'F');
    doc.setTextColor(74, 52, 16);
    doc.setFont('courier', 'bold'); doc.setFontSize(11);
    doc.text(displayId, pageW - 95, 43, { align: 'center' });

    // Embed Official Gate Pass QR Code onto PDF
    const qrTokenVal = r.qrToken || r.requestId;
    if (qrTokenVal && (r.status === 'approved_final' || r.status === 'returned')) {
      try {
        const qrDataUrl = await QRCode.toDataURL(qrTokenVal, { width: 140, margin: 1 });
        doc.setFillColor(250, 248, 242);
        doc.setDrawColor(...gold);
        doc.setLineWidth(0.8);
        doc.roundedRect(pageW - 145, 115, 105, 125, 6, 6, 'FD');
        doc.addImage(qrDataUrl, 'PNG', pageW - 137, 120, 89, 89);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        doc.setTextColor(...maroon);
        doc.text('OFFICIAL GATE QR', pageW - 92, 218, { align: 'center' });
        doc.setFont('courier', 'bold'); doc.setFontSize(7.5);
        doc.setTextColor(...ink);
        doc.text(qrTokenVal, pageW - 92, 230, { align: 'center' });
      } catch (err) {
        console.error('Error embedding QR image into PDF:', err);
      }
    }

    let y = 120;
    const labelX = 40, valueX = 180;
    doc.setTextColor(...ink);

    function row(label, value) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
      doc.setTextColor(...inkSoft);
      doc.text(label, labelX, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(11.5);
      doc.setTextColor(...ink);
      const lines = doc.splitTextToSize(String(value || '—'), pageW - valueX - 40);
      doc.text(lines, valueX, y);
      y += Math.max(20, lines.length * 15);
    }

    row('Student Name', r.name);
    row('Register No.', r.reg);
    row('Department', r.department || '—');
    row('Academic Year', normalizeYear(r.year) || '—');
    row('Hostel / Room No.', r.room);
    row('Destination (Hometown)', r.dest);
    row('Mode of Travel', r.travel);
    row('Parent Mobile No.', r.parentPhone);
    row('Out Date & Time', fmtDate(r.fromDate));
    row('Expected Return', fmtDate(r.toDate));
    row('Reason', r.reason);
    row('Pass Type', r.type === 'weekday' ? 'Weekday Out Pass' : 'Weekend Out Pass');
    row('Current Status', (STATUS_META[r.status] || {}).label || r.status);

    if (lastLocation) {
      row('Last GPS Location', `${lastLocation.lat.toFixed(6)}, ${lastLocation.lng.toFixed(6)}`);
    }

    y += 6;
    doc.setDrawColor(...gold);
    doc.setLineWidth(1);
    doc.line(40, y, pageW - 40, y);
    y += 22;

    doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5);
    doc.setTextColor(...inkSoft);
    const note = 'This pass confirms the request completed Warden and Parent confirmation. Carry your College/Hostel ID card along with this pass when exiting or re-entering the hostel gate.';
    doc.text(doc.splitTextToSize(note, pageW - 80), 40, y);
    y += 40;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.text('Generated on ' + new Date().toLocaleString('en-IN'), 40, y);

    doc.save(`OutPass_${displayId}.pdf`);
  }

  const reqYearDisplay = normalizeYear(r.year);

  return (
    <div className="gkof-ticket">
      <div className="gkof-ticket-main">
        {justStamped && (
          <div className="gkof-stamp">
            {r.status === 'returned' ? <>BACK<br />SAFE</> : <>OUT<br />PASS<br />OK</>}
          </div>
        )}
        <div className="gkof-name">{r.name}</div>
        <div className="gkof-meta">{r.reg} · {r.department || 'CSE'}{reqYearDisplay ? ` (${reqYearDisplay})` : ''} · Room {r.room || '—'} · {typeLabel}</div>
        <div className="gkof-detail-line">
          <b>Dept &amp; Year:</b> {r.department || '—'} ({reqYearDisplay}) &nbsp;·&nbsp; <b>Destination:</b> {r.dest} &nbsp;·&nbsp; <b>Travel:</b> {r.travel}<br />
          <b>Out:</b> {fmtDate(r.fromDate)} &nbsp;→&nbsp; <b>Return:</b> {fmtDate(r.toDate)}<br />
          <b>Reason:</b> {r.reason}<br />
          <b>Parent No.:</b> {r.parentPhone}
        </div>
        {renderTimeline()}
        <span className={`gkof-status ${meta.cls}`}>{meta.label}</span>
        {isAccepted && <div className="gkof-outcome accepted">✅ Your Request was successfully Accepted</div>}
        {isDeclined && <div className="gkof-outcome declined">❌ Your Request was declined</div>}

        {/* Approved Out Pass QR Code Display Section */}
        {(isAccepted || r.status === 'returned') && (
          <div className="gkof-qr-card-section" style={{ marginTop: '14px', padding: '12px 16px', background: '#FAF8F2', border: '1px solid #D9A441', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ background: '#FFF', padding: '6px', borderRadius: '10px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <QRCodeSVG value={r.qrToken || r.requestId} size={110} level="H" includeMargin={false} />
            </div>
            <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#9E1B32', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Official Gate Verification QR Code
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#2A2140', marginTop: '2px' }}>
                Token ID: {r.qrToken || r.requestId}
              </div>
              <div style={{ fontSize: '11.5px', color: '#5F6368', marginTop: '4px', lineHeight: 1.35 }}>
                {r.status === 'returned' ? (
                  <span style={{ color: '#5F6368', fontWeight: 700 }}>🔴 Pass Complete &amp; QR Permanently Expired</span>
                ) : r.qrStatus === 'OUT' ? (
                  <span style={{ color: '#B06000', fontWeight: 700 }}>🟡 CURRENTLY OUT — Present at gate for MARK BACK</span>
                ) : (
                  <span style={{ color: '#137333', fontWeight: 700 }}>🟢 ACTIVE — Present at gate for MARK OUT</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* GPS Tracking Section */}
        {(canShareLocation || canViewLocation) && (
          <div className="gkof-gps-section">
            <div className="gkof-gps-header" onClick={() => setShowLocationPanel(!showLocationPanel)}>
              <span className="gkof-gps-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                Track Location
                {hasLocations && <span className="gkof-gps-live-dot"></span>}
              </span>
              <span className={`gkof-gps-arrow ${showLocationPanel ? 'open' : ''}`}>▾</span>
            </div>

            {showLocationPanel && (
              <div className="gkof-gps-body">
                {/* Share Location Button (student only, approved only) */}
                {canShareLocation && (
                  <div className="gkof-gps-share">
                    <button
                      className={`gkof-btn teal gkof-gps-btn ${gpsStatus === 'loading' ? 'loading' : ''}`}
                      onClick={handleShareLocation}
                      disabled={gpsStatus === 'loading'}
                    >
                      {gpsStatus === 'loading' ? (
                        <span className="gkof-gps-btn-content">
                          <span className="gkof-spinner"></span>
                          Getting Location…
                        </span>
                      ) : gpsStatus === 'success' ? (
                        <span className="gkof-gps-btn-content">✓ Location Shared</span>
                      ) : (
                        <span className="gkof-gps-btn-content">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                          Share My Current Location
                        </span>
                      )}
                    </button>
                    {gpsStatus === 'error' && <div className="gkof-gps-error">{gpsError}</div>}
                  </div>
                )}

                {/* Location Display */}
                {hasLocations && (
                  <div className="gkof-gps-info">
                    <div className="gkof-gps-latest">
                      <div className="gkof-gps-coords">
                        <span className="gkof-gps-label">Latest Coordinates</span>
                        <span className="gkof-gps-value">{lastLocation.lat.toFixed(6)}, {lastLocation.lng.toFixed(6)}</span>
                      </div>
                      <div className="gkof-gps-time">
                        <span className="gkof-gps-label">Updated</span>
                        <span className="gkof-gps-value">{fmtTime(lastLocation.timestamp)}</span>
                      </div>
                    </div>
                    <a
                      className="gkof-btn ghost gkof-gps-map-btn"
                      href={`https://www.google.com/maps?q=${lastLocation.lat},${lastLocation.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                        <line x1="8" y1="2" x2="8" y2="18" />
                        <line x1="16" y1="6" x2="16" y2="22" />
                      </svg>
                      View on Google Maps
                    </a>
                    {r.gpsLocations.length > 1 && (
                      <div className="gkof-gps-history-count">
                        {r.gpsLocations.length} location update{r.gpsLocations.length > 1 ? 's' : ''} recorded
                      </div>
                    )}
                  </div>
                )}

                {!hasLocations && viewer === 'staff' && (
                  <div className="gkof-gps-empty">Student hasn't shared their location yet.</div>
                )}
                {!hasLocations && viewer === 'student' && (
                  <div className="gkof-gps-empty">Tap the button above to share your GPS location.</div>
                )}
              </div>
            )}
          </div>
        )}

        {isDownloadable && (
          <div className="gkof-btn-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <button className="gkof-btn gold" onClick={downloadOutPass}>⬇️ Download Out Pass (PDF)</button>
            {onViewQr && (
              <button
                className="gkof-btn teal"
                style={{ background: '#0D9488', color: '#fff', fontWeight: 'bold' }}
                onClick={() => onViewQr(r)}
              >
                📱 View Gate Pass QR
              </button>
            )}
          </div>
        )}
        {r.status === 'notifying_parent' && (
          <div className="gkof-callpulse">
            <span className="dot"></span>
            Auto-call attempt {r.callAttempts || 1} of 3 to {r.parentPhone} · SMS/WhatsApp link sent
          </div>
        )}
        {showFacultyApprove && (
          <div className="gkof-btn-row">
            <button className="gkof-btn green" onClick={() => onAction(displayId, 'faculty_approved')}>Faculty Advisor Approve</button>
            <button className="gkof-btn red" onClick={() => onAction(displayId, 'faculty_rejected')}>Decline</button>
          </div>
        )}
        {showStaffApprove && (
          <div className="gkof-btn-row">
            <button className="gkof-btn green" onClick={() => onAction(displayId, 'staff_approved')}>Approve &amp; Notify Parent</button>
            <button className="gkof-btn red" onClick={() => onAction(displayId, 'staff_rejected')}>Decline</button>
          </div>
        )}
        {showParentRecord && (
          <>
            <div className="gkof-note">Once the parent confirms by call/OTP/link, record their decision here.</div>
            <div className="gkof-btn-row">
              <button className="gkof-btn green" onClick={() => onAction(displayId, 'parent_approved')}>Parent Confirmed — Approve</button>
              <button className="gkof-btn red" onClick={() => onAction(displayId, 'parent_rejected')}>Parent Declined</button>
            </div>
          </>
        )}
        {showReturn && (
          <div className="gkof-btn-row">
            <button className="gkof-btn ghost" onClick={() => onAction(displayId, 'returned')}>Mark Returned to Hostel</button>
          </div>
        )}
        {r.log && r.log.length > 0 && (
          <div className="gkof-note">{r.log.join(' → ')}</div>
        )}
      </div>
      <div className="gkof-perf"></div>
      <div className="gkof-ticket-stub">
        <div>{displayId}</div>
        <div style={{ opacity: 0.75 }}>
          {(r.name || '').slice(0, 1)}{(r.reg || '').slice(-3)}
        </div>
      </div>
    </div>
  );
}
