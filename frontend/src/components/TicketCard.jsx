import React from 'react';
import { jsPDF } from 'jspdf';

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

export default function TicketCard({ request: r, viewer, onAction }) {
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

  function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' +
      dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
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

  function downloadOutPass() {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const maroon = [158, 27, 50];
    const gold = [217, 164, 65];
    const ink = [42, 33, 64];
    const inkSoft = [122, 114, 144];

    doc.setFillColor(...maroon);
    doc.rect(0, 0, pageW, 86, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    doc.text('GCES Kaveri Girls Hostel', 40, 36);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
    doc.text('Government College of Engineering, Srirangam · Hostel Gate Pass', 40, 53);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
    doc.text(r.status === 'returned' ? 'RETURNED — PASS COMPLETE' : 'APPROVED OUT PASS', 40, 73);

    doc.setFillColor(...gold);
    doc.roundedRect(pageW - 150, 26, 110, 26, 6, 6, 'F');
    doc.setTextColor(74, 52, 16);
    doc.setFont('courier', 'bold'); doc.setFontSize(11);
    doc.text(displayId, pageW - 95, 43, { align: 'center' });

    let y = 120;
    const labelX = 40, valueX = 200;
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
    row('Hostel / Room No.', r.room);
    row('Destination (Hometown)', r.dest);
    row('Mode of Travel', r.travel);
    row('Parent Mobile No.', r.parentPhone);
    row('Out Date & Time', fmtDate(r.fromDate));
    row('Expected Return', fmtDate(r.toDate));
    row('Reason', r.reason);
    row('Pass Type', r.type === 'weekday' ? 'Weekday Out Pass' : 'Weekend Out Pass');
    row('Current Status', (STATUS_META[r.status] || {}).label || r.status);

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

  return (
    <div className="gkof-ticket">
      <div className="gkof-ticket-main">
        {justStamped && (
          <div className="gkof-stamp">
            {r.status === 'returned' ? <>BACK<br />SAFE</> : <>OUT<br />PASS<br />OK</>}
          </div>
        )}
        <div className="gkof-name">{r.name}</div>
        <div className="gkof-meta">{r.reg} · {r.room || '—'} · {typeLabel}</div>
        <div className="gkof-detail-line">
          <b>Destination (Hometown Address):</b> {r.dest} &nbsp;·&nbsp; <b>Travel:</b> {r.travel}<br />
          <b>Out:</b> {fmtDate(r.fromDate)} &nbsp;→&nbsp; <b>Return:</b> {fmtDate(r.toDate)}<br />
          <b>Reason:</b> {r.reason}<br />
          <b>Parent No.:</b> {r.parentPhone}
        </div>
        {renderTimeline()}
        <span className={`gkof-status ${meta.cls}`}>{meta.label}</span>
        {isAccepted && <div className="gkof-outcome accepted">✅ Your Request was successfully Accepted</div>}
        {isDeclined && <div className="gkof-outcome declined">❌ Your Request was declined</div>}
        {isDownloadable && (
          <div className="gkof-btn-row">
            <button className="gkof-btn gold" onClick={downloadOutPass}>⬇️ Download Out Pass (PDF)</button>
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
