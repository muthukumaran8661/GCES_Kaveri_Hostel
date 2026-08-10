import React, { useState, useEffect } from 'react';
import TicketCard from './TicketCard';

async function apiFetch(endpoint, method = 'GET', data = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('gkof_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const config = { method, headers };
  if (data) {
    config.body = JSON.stringify(data);
  }
  const url = endpoint.startsWith('http') ? endpoint : `${endpoint}`;
  const res = await fetch(url, config);
  const result = await res.json();
  if (!res.ok) {
    throw new Error(result.message || 'API request failed');
  }
  return result;
}

function normalizeYear(y) {
  if (!y) return 'I Year';
  const s = String(y).trim().toUpperCase();
  if (s.startsWith('1') || (s.startsWith('I') && !s.startsWith('IV'))) return 'I Year';
  if (s.startsWith('2') || s.startsWith('II')) return 'II Year';
  if (s.startsWith('3') || s.startsWith('III')) return 'III Year';
  if (s.startsWith('4') || s.startsWith('IV')) return 'IV Year';
  if (s.includes('ALL')) return 'All Years';
  return y;
}

export default function StaffDashboard({ session, requests, onAction, onRefreshUsers }) {
  const isFaculty = session && session.role === 'faculty';
  const isAdminOrWarden = session && (session.role === 'staff' || session.role === 'admin');

  const facYearDisplay = normalizeYear(session?.year);

  // Filter requests based on status and user role
  const pendingFaculty = requests.filter(r => r.status === 'pending_faculty');
  const pendingStaff = requests.filter(r => r.status === 'pending_staff');
  const notifying = requests.filter(r => r.status === 'notifying_parent');
  const outNow = requests.filter(r => r.status === 'approved_final');
  const returnedToday = requests.filter(r => r.status === 'returned');

  // Queue logic:
  // For Faculty: only show requests awaiting faculty approval (pending_faculty)
  // For Staff/Warden: show pending_staff and notifying_parent
  const queue = isFaculty
    ? pendingFaculty
    : [...pendingFaculty, ...pendingStaff, ...notifying];

  const activeOut = outNow.slice();
  const history = requests.filter(r => ['faculty_rejected', 'staff_rejected', 'parent_rejected', 'returned'].includes(r.status));

  // Admin Control State
  const [staffUsers, setStaffUsers] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({ department: '', year: '', role: '', status: '' });

  useEffect(() => {
    if (isAdminOrWarden) {
      loadStaffList();
    }
  }, [session]);

  async function loadStaffList() {
    try {
      setLoadingStaff(true);
      const res = await apiFetch('/api/users/staff-list');
      setStaffUsers(res.users || []);
    } catch (err) {
      console.error('Error loading staff list:', err);
    } finally {
      setLoadingStaff(false);
    }
  }

  const startEdit = (u) => {
    setEditingUserId(u._id || u.id);
    setEditForm({
      department: u.department || 'CSE',
      year: normalizeYear(u.year) || 'I Year',
      role: u.role || 'faculty',
      status: u.status || 'active'
    });
  };

  const handleAdminUpdate = async (userId) => {
    try {
      const res = await apiFetch(`/api/users/${userId}/admin-update`, 'PUT', editForm);
      setUpdateMsg(res.message || 'Permissions updated successfully!');
      setEditingUserId(null);
      await loadStaffList();
      if (onRefreshUsers) onRefreshUsers();
      setTimeout(() => setUpdateMsg(''), 3000);
    } catch (err) {
      alert(err.message || 'Failed to update user permissions');
    }
  };

  return (
    <>
      {/* Faculty Scope Banner */}
      {isFaculty && (
        <div className="gkof-card" style={{ borderLeft: '4px solid var(--teal)', background: '#F0F9FF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '20px' }}>🛡️</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--ink)' }}>
                Authorized Scope: {session.department || 'CSE'} – {facYearDisplay} Faculty Advisor
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)', marginTop: '2px' }}>
                You are assigned to approve requests for <b>{facYearDisplay} {session.department || 'CSE'}</b> students only. Backend RBAC strictly restricts unauthorized approvals.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="gkof-stats">
        <div className="gkof-stat c1"><div className="n">{pendingFaculty.length + pendingStaff.length}</div><div className="l">Awaiting Approval</div></div>
        <div className="gkof-stat c2"><div className="n">{notifying.length}</div><div className="l">Calling Parent</div></div>
        <div className="gkof-stat c3"><div className="n">{outNow.length}</div><div className="l">Currently Out</div></div>
        <div className="gkof-stat c4"><div className="n">{returnedToday.length}</div><div className="l">Returned</div></div>
      </div>

      {/* Action Queue */}
      <div className="gkof-card">
        <h3>
          Action Queue <span className="count">{queue.length}</span>
          {isFaculty && <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--ink-soft)', marginLeft: '10px' }}>({session.department} - {session.year} only)</span>}
        </h3>
        <div>
          {queue.length ? (
            queue.map(r => <TicketCard key={r.requestId || r.id || r._id} request={r} viewer="staff" onAction={onAction} />)
          ) : (
            <div className="gkof-empty">
              {isFaculty ? `No pending requests for ${session.department || 'CSE'} (${session.year || '1st Year'}) students right now.` : 'Nothing needs action right now.'}
            </div>
          )}
        </div>
      </div>

      {/* Students Currently Out */}
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

      {/* History */}
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

      {/* Admin Control Panel (Visible to Warden / Admin) */}
      {isAdminOrWarden && (
        <div className="gkof-card" style={{ marginTop: '24px', borderColor: 'var(--gold)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0 }}>⚙️ Admin Control – Faculty Approval Permissions</h3>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--ink-soft)' }}>
                Assign or update Faculty Department, Academic Year, Role, or Active/Inactive status.
              </p>
            </div>
            <button className="gkof-btn ghost" onClick={loadStaffList}>🔄 Refresh List</button>
          </div>

          {updateMsg && (
            <div style={{ background: '#E6F4EA', color: 'var(--green)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, marginBottom: '12px' }}>
              ✓ {updateMsg}
            </div>
          )}

          {loadingStaff ? (
            <div className="gkof-empty">Loading faculty permissions list…</div>
          ) : staffUsers.length === 0 ? (
            <div className="gkof-empty">No faculty members found in the system.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--cream-soft)', borderBottom: '2px solid var(--gold-soft)', color: 'var(--ink)' }}>
                    <th style={{ padding: '10px' }}>Name / ID</th>
                    <th style={{ padding: '10px' }}>Role</th>
                    <th style={{ padding: '10px' }}>Department</th>
                    <th style={{ padding: '10px' }}>Assigned Year</th>
                    <th style={{ padding: '10px' }}>Status</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffUsers.map(u => {
                    const isEditing = editingUserId === (u._id || u.id);
                    return (
                      <tr key={u._id || u.id} style={{ borderBottom: '1px solid var(--line)' }}>
                        <td style={{ padding: '10px' }}>
                          <b>{u.name || u.username}</b>
                          <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>ID: {u.staffId || u.username}</div>
                        </td>
                        <td style={{ padding: '10px' }}>
                          {isEditing ? (
                            <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} style={{ padding: '4px', fontSize: '12px' }}>
                              <option value="faculty">Faculty Advisor</option>
                              <option value="staff">Warden / Staff</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{u.role}</span>
                          )}
                        </td>
                        <td style={{ padding: '10px' }}>
                          {isEditing ? (
                            <select value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} style={{ padding: '4px', fontSize: '12px' }}>
                              <option value="CSE">CSE</option>
                              <option value="ECE">ECE</option>
                              <option value="EEE">EEE</option>
                              <option value="Mechanical">Mechanical</option>
                              <option value="Civil">Civil</option>
                              <option value="Mechatronics">Mechatronics</option>
                              <option value="Hostel Administration">Hostel Administration</option>
                            </select>
                          ) : (
                            u.department || '—'
                          )}
                        </td>
                        <td style={{ padding: '10px' }}>
                          {isEditing ? (
                            <select value={editForm.year} onChange={e => setEditForm({ ...editForm, year: e.target.value })} style={{ padding: '4px', fontSize: '12px' }}>
                              <option value="I Year">I Year</option>
                              <option value="II Year">II Year</option>
                              <option value="III Year">III Year</option>
                              <option value="IV Year">IV Year</option>
                              <option value="All Years">All Years</option>
                            </select>
                          ) : (
                            normalizeYear(u.year) || '—'
                          )}
                        </td>
                        <td style={{ padding: '10px' }}>
                          {isEditing ? (
                            <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} style={{ padding: '4px', fontSize: '12px' }}>
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          ) : (
                            <span style={{ color: u.status === 'inactive' ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                              {u.status === 'inactive' ? 'Inactive' : 'Active'}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                              <button className="gkof-btn green" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => handleAdminUpdate(u._id || u.id)}>Save</button>
                              <button className="gkof-btn ghost" style={{ padding: '4px 8px', fontSize: '11px' }} onClick={() => setEditingUserId(null)}>Cancel</button>
                            </div>
                          ) : (
                            <button className="gkof-btn teal" style={{ padding: '4px 10px', fontSize: '11.5px' }} onClick={() => startEdit(u)}>Edit Permissions</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
