import React, { useState, useEffect } from 'react';
import TicketCard from './TicketCard';
import StudentRequestReport, { exportRequestsToExcel } from './StudentRequestReport';

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
  const s = String(y).trim();
  if (/^I(\s+Year)?$/i.test(s) || /^1(st)?(\s+Year)?$/i.test(s)) return 'I Year';
  if (/^II(\s+Year)?$/i.test(s) || /^2(nd)?(\s+Year)?$/i.test(s)) return 'II Year';
  if (/^III(\s+Year)?$/i.test(s) || /^3(rd)?(\s+Year)?$/i.test(s)) return 'III Year';
  if (/^IV(\s+Year)?$/i.test(s) || /^4(th)?(\s+Year)?$/i.test(s)) return 'IV Year';
  if (/ALL/i.test(s)) return 'All Years';
  return s;
}

export default function StaffDashboard({ session, requests, onAction, onRefreshUsers, activeTab = 'dashboard', onNavigateTab }) {
  const isFaculty = session && session.role === 'faculty';
  const isAdminOrWarden = session && (session.role === 'staff' || session.role === 'admin');

  const WARDEN_ALLOWLIST = ['muthu@123', 'rajesh@123', 'deva@123', 'prince@123'];
  const FACULTY_ALLOWLIST = [
    'arunkumar@123', 'balakumar@123', 'dineshkumar@123', 'karthikraj@123',
    'anandkumar@123', 'ganeshraj@123', 'harikumar@123', 'manojkumar@123',
    'prakashraj@123', 'ravikumar@123', 'sureshbabu@123', 'vigneshkumar@123',
    'ajaykumar@123', 'bharathraj@123', 'naveenkumar@123', 'santhoshkumar@123',
    'ashokkumar@123', 'deepakraj@123', 'mohankumar@123', 'praveenkumar@123',
    'gokulraj@123', 'lokeshkumar@123', 'sanjaykumar@123', 'vijayraj@123'
  ];
  const userUname = (session?.username || session?.staffId || '').trim().toLowerCase();
  const isAuthorizedWarden = !isAdminOrWarden || session?.status !== 'inactive';
  const isAuthorizedFaculty = !isFaculty || session?.status !== 'inactive';

  const facYearDisplay = normalizeYear(session?.year);
  const [showReportModal, setShowReportModal] = useState(false);

  if ((isAdminOrWarden && !isAuthorizedWarden) || (isFaculty && !isAuthorizedFaculty)) {
    return (
      <div className="gkof-card" style={{ textAlign: 'center', padding: '40px 20px', borderLeft: '4px solid var(--red)' }}>
        <span style={{ fontSize: '48px', display: 'block', marginBottom: '12px' }}>🛑</span>
        <h2 style={{ color: 'var(--red)', fontSize: '20px', margin: '0 0 8px' }}>Account Inactive</h2>
        <p style={{ color: 'var(--ink-soft)', fontSize: '13px', maxWidth: '480px', margin: '0 auto 16px' }}>
          Your account (<b>{session?.username || session?.staffId}</b>) is currently set to Inactive. Please contact the Hostel Admin.
        </p>
        <button
          className="gkof-btn red"
          onClick={() => { localStorage.clear(); window.location.reload(); }}
        >
          Log Out
        </button>
      </div>
    );
  }

  // Filter requests based on status and user role
  const pendingFaculty = requests.filter(r => r.status === 'pending_faculty');
  const pendingStaff = requests.filter(r => r.status === 'pending_staff');
  const notifying = requests.filter(r => r.status === 'notifying_parent');
  const outNow = requests.filter(r => r.qrStatus === 'OUT');
  const returnedToday = requests.filter(r => r.status === 'returned');

  // Queue logic:
  // For Faculty: show requests awaiting faculty advisor approval (pending_faculty)
  // For Staff/Warden: show requests awaiting warden approval (pending_staff) and parent calls (notifying_parent)
  const queue = isFaculty
    ? pendingFaculty
    : [...pendingStaff, ...notifying];

  const activeOut = outNow.slice();
  const history = requests.filter(r =>
    ['faculty_rejected', 'staff_rejected', 'parent_rejected', 'returned'].includes(r.status) ||
    (r.status === 'approved_final' && r.qrStatus !== 'OUT')
  );

  // Admin Control State
  const [staffUsers, setStaffUsers] = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({ department: '', year: '', role: '', status: '' });

  // Add Staff Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    username: '',
    role: 'faculty',
    department: 'CSE',
    year: 'I Year',
    email: '',
    phone: '',
    password: ''
  });
  const [addFormError, setAddFormError] = useState('');
  const [addingStaff, setAddingStaff] = useState(false);

  // Delete Staff Modal State
  const [deletingUser, setDeletingUser] = useState(null);
  const [deletingStaff, setDeletingStaff] = useState(false);

  const WARDEN_ORDER_LIST = ['muthu@123', 'rajesh@123', 'deva@123', 'prince@123'];
  const DEPT_ORDER_MAP = {
    'cse': 1,
    'ece': 2,
    'eee': 3,
    'mechanical': 4,
    'mech': 4,
    'civil': 5,
    'mechatronics': 6
  };

  function getWardenRank(u) {
    const uname = (u.username || u.staffId || '').toLowerCase();
    const name = (u.name || '').toLowerCase();
    if (uname.includes('muthu') || name.includes('muthukumaran')) return 1;
    if (uname.includes('rajesh') || name.includes('rajesh')) return 2;
    if (uname.includes('deva') || name.includes('deva')) return 3;
    if (uname.includes('prince') || name.includes('prince')) return 4;
    return 99;
  }

  function getYearRank(y) {
    if (!y) return 99;
    const s = String(y).trim();
    if (/^I(\s+Year)?$/i.test(s) || /^1(st)?(\s+Year)?$/i.test(s)) return 1;
    if (/^II(\s+Year)?$/i.test(s) || /^2(nd)?(\s+Year)?$/i.test(s)) return 2;
    if (/^III(\s+Year)?$/i.test(s) || /^3(rd)?(\s+Year)?$/i.test(s)) return 3;
    if (/^IV(\s+Year)?$/i.test(s) || /^4(th)?(\s+Year)?$/i.test(s)) return 4;
    return 99;
  }

  function sortStaffUsers(users) {
    if (!Array.isArray(users)) return [];
    return [...users].sort((a, b) => {
      const unameA = (a.username || a.staffId || '').toLowerCase();
      const unameB = (b.username || b.staffId || '').toLowerCase();
      const isWardenA = a.role === 'staff' || a.role === 'admin' || (a.department || '').toLowerCase() === 'hostel administration' || WARDEN_ORDER_LIST.includes(unameA);
      const isWardenB = b.role === 'staff' || b.role === 'admin' || (b.department || '').toLowerCase() === 'hostel administration' || WARDEN_ORDER_LIST.includes(unameB);

      if (isWardenA && !isWardenB) return -1;
      if (!isWardenA && isWardenB) return 1;

      if (isWardenA && isWardenB) {
        return getWardenRank(a) - getWardenRank(b);
      }

      const deptA = DEPT_ORDER_MAP[(a.department || '').toLowerCase()] || 99;
      const deptB = DEPT_ORDER_MAP[(b.department || '').toLowerCase()] || 99;
      if (deptA !== deptB) return deptA - deptB;

      const yearA = getYearRank(a.year);
      const yearB = getYearRank(b.year);
      if (yearA !== yearB) return yearA - yearB;

      return (a.name || '').localeCompare(b.name || '');
    });
  }

  useEffect(() => {
    if (isAdminOrWarden) {
      loadStaffList();
    }
  }, [session]);

  async function loadStaffList() {
    try {
      setLoadingStaff(true);
      const res = await apiFetch('/api/users/staff-list');
      setStaffUsers(sortStaffUsers(res.users || []));
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
      setTimeout(() => setUpdateMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to update user permissions');
    }
  };

  const handleRoleChange = (newRole) => {
    setAddForm(prev => ({
      ...prev,
      role: newRole,
      department: newRole === 'staff' ? 'Hostel Administration' : (prev.department === 'Hostel Administration' ? 'CSE' : prev.department)
    }));
  };

  const handleCreateStaff = async (e) => {
    if (e) e.preventDefault();
    setAddFormError('');

    // Validation
    if (!addForm.name.trim()) return setAddFormError('Full Name is required.');
    if (!addForm.username.trim()) return setAddFormError('Login ID is required.');
    if (!addForm.role.trim()) return setAddFormError('Role selection is required.');
    if (addForm.role === 'faculty' && !addForm.department.trim()) return setAddFormError('Department selection is required.');
    if (!addForm.year.trim()) return setAddFormError('Assigned Year selection is required.');
    if (!addForm.email.trim()) return setAddFormError('Registered Email Address is required.');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(addForm.email.trim())) return setAddFormError('Please enter a valid email address.');
    if (!addForm.phone.trim()) return setAddFormError('Phone Number is required.');
    if (!/^[0-9]{10}$/.test(addForm.phone.trim())) return setAddFormError('Phone Number must be exactly 10 digits.');
    if (!addForm.password.trim()) return setAddFormError('Password is required.');

    try {
      setAddingStaff(true);
      const payload = {
        name: addForm.name.trim(),
        username: addForm.username.trim(),
        role: addForm.role.trim(),
        department: addForm.role === 'staff' ? 'Hostel Administration' : addForm.department.trim(),
        year: addForm.year.trim(),
        email: addForm.email.trim(),
        phone: addForm.phone.trim(),
        password: addForm.password.trim()
      };

      const res = await apiFetch('/api/users/add-staff', 'POST', payload);
      setUpdateMsg(res.message || 'New staff account added successfully.');
      setShowAddModal(false);
      setAddForm({
        name: '',
        username: '',
        role: 'faculty',
        department: 'CSE',
        year: 'I Year',
        email: '',
        phone: '',
        password: ''
      });
      await loadStaffList();
      if (onRefreshUsers) onRefreshUsers();
      setTimeout(() => setUpdateMsg(''), 4000);
    } catch (err) {
      setAddFormError(err.message || 'Failed to create staff account');
    } finally {
      setAddingStaff(false);
    }
  };

  const confirmDeleteUser = (u) => {
    setDeletingUser(u);
  };

  const handleDeleteStaff = async () => {
    if (!deletingUser) return;
    try {
      setDeletingStaff(true);
      const userId = deletingUser._id || deletingUser.id;
      const res = await apiFetch(`/api/users/staff/${userId}`, 'DELETE');
      setUpdateMsg(res.message || 'Staff account deleted successfully.');
      setDeletingUser(null);
      await loadStaffList();
      if (onRefreshUsers) onRefreshUsers();
      setTimeout(() => setUpdateMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to delete staff account');
    } finally {
      setDeletingStaff(false);
    }
  };

  const renderAdminControlTable = () => (
    <div className="gkof-card" style={{ borderColor: 'var(--gold)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 style={{ margin: 0 }}>⚙️ Admin Control – Staff Permissions &amp; Management</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--ink-soft)' }}>
            Manage Wardens &amp; Faculty Advisors. Add new staff, edit permissions, department, assigned year, or delete accounts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="gkof-btn ghost" onClick={loadStaffList}>🔄 Refresh List</button>
          <button className="gkof-btn green" onClick={() => { setShowAddModal(true); setAddFormError(''); }}>+ Add Staff</button>
        </div>
      </div>

      {updateMsg && (
        <div style={{ background: '#E6F4EA', color: 'var(--green)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '14px', border: '1px solid var(--green)' }}>
          ✓ {updateMsg}
        </div>
      )}

      {loadingStaff ? (
        <div className="gkof-empty">Loading faculty permissions list…</div>
      ) : staffUsers.length === 0 ? (
        <div className="gkof-empty">No faculty or warden members found in the system.</div>
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
              {sortStaffUsers(staffUsers).map(u => {
                const isEditing = editingUserId === (u._id || u.id);
                return (
                  <tr key={u._id || u.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px' }}>
                      <b>{u.name || u.username}</b>
                      <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>ID: {u.staffId || u.username}</div>
                      {u.email && <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>✉ {u.email}</div>}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {isEditing ? (
                        <select
                          value={editForm.role}
                          onChange={e => {
                            const r = e.target.value;
                            setEditForm({
                              ...editForm,
                              role: r,
                              department: (r === 'staff' || r === 'admin') ? 'Hostel Administration' : (editForm.department === 'Hostel Administration' ? 'CSE' : editForm.department)
                            });
                          }}
                          style={{ padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--line)' }}
                        >
                          <option value="faculty">Faculty Advisor</option>
                          <option value="staff">Warden</option>
                        </select>
                      ) : (
                        <span style={{ textTransform: 'capitalize', fontWeight: 600, color: u.role === 'staff' ? 'var(--maroon)' : 'var(--teal)' }}>
                          {u.role === 'staff' ? 'Warden' : u.role === 'faculty' ? 'Faculty Advisor' : u.role}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {isEditing ? (
                        (editForm.role === 'staff' || editForm.role === 'admin') ? (
                          <select value="Hostel Administration" disabled style={{ padding: '6px', fontSize: '12px', backgroundColor: '#F1F3F4', cursor: 'not-allowed', borderRadius: '6px', border: '1px solid var(--line)' }}>
                            <option value="Hostel Administration">Hostel Administration</option>
                          </select>
                        ) : (
                          <select value={editForm.department} onChange={e => setEditForm({ ...editForm, department: e.target.value })} style={{ padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                            <option value="CSE">CSE</option>
                            <option value="ECE">ECE</option>
                            <option value="EEE">EEE</option>
                            <option value="Mechanical">Mechanical</option>
                            <option value="Civil">Civil</option>
                            <option value="Mechatronics">Mechatronics</option>
                          </select>
                        )
                      ) : (
                        u.department || '—'
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {isEditing ? (
                        <select value={editForm.year} onChange={e => setEditForm({ ...editForm, year: e.target.value })} style={{ padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--line)' }}>
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
                        <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} style={{ padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--line)' }}>
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
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <button className="gkof-btn teal" style={{ padding: '4px 10px', fontSize: '11.5px' }} onClick={() => startEdit(u)}>Edit Permissions</button>
                          <button className="gkof-btn red" style={{ padding: '4px 10px', fontSize: '11.5px' }} onClick={() => confirmDeleteUser(u)}>🗑 Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Staff Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px',
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '540px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
            border: '1px solid var(--line)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--maroon-dark)', fontFamily: 'Roboto Slab, serif' }}>
                ➕ Add New Staff Account
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--ink-soft)' }}
              >
                ✕
              </button>
            </div>

            {addFormError && (
              <div style={{ background: '#FBE4E1', color: 'var(--danger)', padding: '10px 12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, marginBottom: '14px', border: '1px solid var(--danger)' }}>
                ⚠️ {addFormError}
              </div>
            )}

            <form onSubmit={handleCreateStaff}>
              <div className="gkof-row">
                <div className="gkof-field">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. K. Ramesh"
                    value={addForm.name}
                    onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="gkof-field">
                  <label>Login ID (Username) *</label>
                  <input
                    type="text"
                    placeholder="e.g. ramesh@123"
                    value={addForm.username}
                    onChange={e => setAddForm({ ...addForm, username: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="gkof-row">
                <div className="gkof-field">
                  <label>Role *</label>
                  <select
                    value={addForm.role}
                    onChange={e => handleRoleChange(e.target.value)}
                    required
                  >
                    <option value="faculty">Faculty Advisor</option>
                    <option value="staff">Warden</option>
                  </select>
                </div>
                <div className="gkof-field">
                  <label>Department *</label>
                  {addForm.role === 'staff' ? (
                    <select value="Hostel Administration" disabled style={{ backgroundColor: '#F1F3F4', cursor: 'not-allowed' }}>
                      <option value="Hostel Administration">Hostel Administration</option>
                    </select>
                  ) : (
                    <select
                      value={addForm.department}
                      onChange={e => setAddForm({ ...addForm, department: e.target.value })}
                      required
                    >
                      <option value="CSE">CSE</option>
                      <option value="ECE">ECE</option>
                      <option value="EEE">EEE</option>
                      <option value="Mechanical">Mechanical</option>
                      <option value="Civil">Civil</option>
                      <option value="Mechatronics">Mechatronics</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="gkof-row">
                <div className="gkof-field">
                  <label>Assigned Year *</label>
                  <select
                    value={addForm.year}
                    onChange={e => setAddForm({ ...addForm, year: e.target.value })}
                    required
                  >
                    <option value="I Year">I Year</option>
                    <option value="II Year">II Year</option>
                    <option value="III Year">III Year</option>
                    <option value="IV Year">IV Year</option>
                    <option value="All Years">All Years</option>
                  </select>
                </div>
                <div className="gkof-field">
                  <label>Phone Number (10 digits) *</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    maxLength={10}
                    value={addForm.phone}
                    onChange={e => setAddForm({ ...addForm, phone: e.target.value.replace(/[^0-9]/g, '') })}
                    required
                  />
                </div>
              </div>

              <div className="gkof-field">
                <label>Registered Email Address *</label>
                <input
                  type="email"
                  placeholder="e.g. ramesh@gces.edu.in"
                  value={addForm.email}
                  onChange={e => setAddForm({ ...addForm, email: e.target.value })}
                  required
                />
              </div>

              <div className="gkof-field">
                <label>Password *</label>
                <input
                  type="password"
                  placeholder="Enter login password"
                  value={addForm.password}
                  onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  className="gkof-btn ghost"
                  onClick={() => setShowAddModal(false)}
                  disabled={addingStaff}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="gkof-btn green"
                  disabled={addingStaff}
                >
                  {addingStaff ? 'Creating Account…' : 'Save Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Staff Confirmation Modal */}
      {deletingUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          zIndex: 1000,
          padding: '16px',
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '16px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
            border: '2px solid var(--danger)',
            padding: '24px'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '44px', display: 'block', marginBottom: '8px' }}>⚠️</span>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--danger)', fontFamily: 'Roboto Slab, serif' }}>
                Confirm Account Deletion
              </h3>
            </div>

            <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--ink)', margin: '0 0 16px', fontWeight: 500 }}>
              Are you sure you want to delete this account?
            </p>

            <div style={{
              background: '#FDF2F2',
              border: '1px solid #F8DAD5',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '20px',
              fontSize: '13px',
              lineHeight: 1.6
            }}>
              <div><b>Name:</b> {deletingUser.name || deletingUser.username}</div>
              <div><b>Role:</b> {deletingUser.role === 'staff' ? 'Warden' : deletingUser.role === 'faculty' ? 'Faculty Advisor' : deletingUser.role}</div>
              <div><b>Login ID:</b> {deletingUser.staffId || deletingUser.username}</div>
              <div><b>Department:</b> {deletingUser.department || '—'}</div>
              <div><b>Assigned Year:</b> {normalizeYear(deletingUser.year) || '—'}</div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="gkof-btn ghost"
                style={{ flex: 1 }}
                onClick={() => setDeletingUser(null)}
                disabled={deletingStaff}
              >
                Cancel
              </button>
              <button
                type="button"
                className="gkof-btn red"
                style={{ flex: 1 }}
                onClick={handleDeleteStaff}
                disabled={deletingStaff}
              >
                {deletingStaff ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (activeTab === 'admin') {
    return (
      <>
        {isAdminOrWarden && renderAdminControlTable()}
      </>
    );
  }

  if (activeTab === 'history') {
    return (
      <>
        {/* Separate History Page Banner */}
        <div className="gkof-card" style={{ background: 'linear-gradient(135deg, #2A2140 0%, #3B2D59 100%)', color: '#FFF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#FFF' }}>📜 Out Pass History</h2>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--gold-soft)' }}>
                View all completed "Outpass Ready", returned, and declined student out pass records ({history.length} records)
              </p>
            </div>
            {onNavigateTab && (
              <button
                className="gkof-btn"
                style={{ background: 'var(--gold)', color: '#2A2140', border: 'none', fontWeight: 700, padding: '9px 16px', fontSize: '13px', cursor: 'pointer' }}
                onClick={() => onNavigateTab('dashboard')}
              >
                ← Back to Dashboard
              </button>
            )}
          </div>
        </div>

        {/* Completed History List */}
        <div className="gkof-card">
          <h3>Completed &amp; Archived Records <span className="count">{history.length}</span></h3>
          <div>
            {history.length ? (
              history.map(r => <TicketCard key={r.requestId || r.id || r._id} request={r} viewer="staff" onAction={onAction} />)
            ) : (
              <div className="gkof-empty">No completed or archived history records found.</div>
            )}
          </div>
        </div>
      </>
    );
  }

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

      {/* Report & History Quick Access Card */}
      <div className="gkof-card" style={{ background: 'linear-gradient(135deg, #2A2140 0%, #3B2D59 100%)', color: '#FFF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.15)', width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
              📊
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#FFF' }}>
                Reports &amp; Archive
              </div>
              <div style={{ fontSize: '12px', color: 'var(--gold-soft)', marginTop: '2px' }}>
                View, filter and export student out pass request and approval data
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {onNavigateTab && (
              <button
                className="gkof-btn"
                style={{ background: 'var(--maroon)', color: '#FFF', border: '1px solid var(--gold-soft)', fontWeight: 700, padding: '9px 16px', fontSize: '13px', cursor: 'pointer' }}
                onClick={() => onNavigateTab('history')}
              >
                📜 View History ({history.length})
              </button>
            )}
            <button
              className="gkof-btn"
              style={{ background: 'var(--gold)', color: '#2A2140', border: 'none', fontWeight: 700, padding: '9px 16px', fontSize: '13px', cursor: 'pointer' }}
              onClick={() => setShowReportModal(true)}
            >
              👁️ View Report
            </button>
            <button
              className="gkof-btn"
              style={{ background: '#16a34a', color: '#FFF', border: 'none', fontWeight: 700, padding: '9px 16px', fontSize: '13px', cursor: 'pointer' }}
              onClick={() => {
                let scoped = requests;
                if (isFaculty) {
                  const facDept = (session?.department || '').trim().toLowerCase();
                  const facYr = normalizeYear(session?.year);
                  scoped = requests.filter(r => (r.department || '').trim().toLowerCase() === facDept && (facYr === 'All Years' || normalizeYear(r.year) === facYr));
                }
                exportRequestsToExcel(scoped);
              }}
            >
              📊 Export Excel
            </button>
          </div>
        </div>
      </div>

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

      {/* History Clean Summary Card */}
      <div className="gkof-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0 }}>📜 Completed Request History <span className="count">{history.length}</span></h3>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--ink-soft)' }}>
            All completed "Outpass Ready", returned, and declined records are archived safely in History.
          </p>
        </div>
        {onNavigateTab && (
          <button
            className="gkof-btn maroon"
            onClick={() => onNavigateTab('history')}
          >
            📜 Open History Page ({history.length})
          </button>
        )}
      </div>

      {showReportModal && (
        <StudentRequestReport
          session={session}
          requests={requests}
          onClose={() => setShowReportModal(false)}
          onRefresh={onRefreshUsers}
        />
      )}
    </>
  );
}
