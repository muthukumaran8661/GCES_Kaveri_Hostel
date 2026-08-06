import React from 'react';
import TicketCard from './TicketCard';

export default function StaffDashboard({ requests, onAction }) {
  const pendingFaculty = requests.filter(r => r.status === 'pending_faculty');
  const pendingStaff = requests.filter(r => r.status === 'pending_staff');
  const notifying = requests.filter(r => r.status === 'notifying_parent');
  const outNow = requests.filter(r => r.status === 'approved_final');
  const returnedToday = requests.filter(r => r.status === 'returned');

  const queue = [...pendingFaculty, ...pendingStaff, ...notifying];
  const activeOut = outNow.slice();
  const history = requests.filter(r => ['faculty_rejected', 'staff_rejected', 'parent_rejected', 'returned'].includes(r.status));

  return (
    <>
      <div className="gkof-stats">
        <div className="gkof-stat c1"><div className="n">{pendingFaculty.length + pendingStaff.length}</div><div className="l">Awaiting Approval</div></div>
        <div className="gkof-stat c2"><div className="n">{notifying.length}</div><div className="l">Calling Parent</div></div>
        <div className="gkof-stat c3"><div className="n">{outNow.length}</div><div className="l">Currently Out</div></div>
        <div className="gkof-stat c4"><div className="n">{returnedToday.length}</div><div className="l">Returned</div></div>
      </div>

      <div className="gkof-card">
        <h3>Action Queue <span className="count">{queue.length}</span></h3>
        <div>
          {queue.length ? (
            queue.map(r => <TicketCard key={r.requestId || r.id || r._id} request={r} viewer="staff" onAction={onAction} />)
          ) : (
            <div className="gkof-empty">Nothing needs action right now.</div>
          )}
        </div>
      </div>

      <div className="gkof-card">
        <h3>Students Currently Out <span className="count">{activeOut.length}</span></h3>
        <div>
          {activeOut.length ? (
            activeOut.map(r => <TicketCard key={r.requestId || r.id || r._id} request={r} viewer="staff" onAction={onAction} />)
          ) : (
            <div className="gkof-empty">No one is out right now.</div>
          )}
        </div>
      </div>

      <div className="gkof-card">
        <h3>History <span className="count">{history.length}</span></h3>
        <div>
          {history.length ? (
            history.map(r => <TicketCard key={r.requestId || r.id || r._id} request={r} viewer="staff" onAction={onAction} />)
          ) : (
            <div className="gkof-empty">No completed or declined records yet.</div>
          )}
        </div>
      </div>
    </>
  );
}
