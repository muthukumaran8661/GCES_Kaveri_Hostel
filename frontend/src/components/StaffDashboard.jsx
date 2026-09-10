import React, { useState, useEffect } from 'react';
import TicketCard from './TicketCard';
import StudentRequestReport, { exportRequestsToExcel } from './StudentRequestReport';
import { generateHistoryPdf } from '../utils/historyPdfGenerator';
import { generateStaffDetailsPdf } from '../utils/staffDetailsPdfGenerator';

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

import { normalizeDepartment, normalizeYear, matchesDepartment, matchesYear } from '../utils/normalization';

export default function StaffDashboard({ session, requests, onAction, onRefreshUsers, activeTab = 'dashboard', onNavigateTab }) {
  const isFaculty = session && session.role === 'faculty';
  const isAdminOrWarden = session && (session.role === 'staff' || session.role === 'admin');

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

  // Filter requests based on status, dynamic assignment, and user role
  const scopedRequests = requests.filter(r => {
    if (session?.role === 'admin') return true;
    const sessionUserId = (session?._id || session?.id)?.toString();

    if (isFaculty) {
      const isAssignedDirectly = (r.assignedFacultyAdvisorId && r.assignedFacultyAdvisorId.toString() === sessionUserId) ||
        (r.assignedFacultyId && r.assignedFacultyId.toString() === sessionUserId);
      if (isAssignedDirectly) return true;
      return matchesDepartment(session?.department, r.department) &&
        matchesYear(session?.year, r.year);
    }

    if (isAdminOrWarden) {
      const isAssignedDirectly = (r.assignedWardenId && r.assignedWardenId.toString() === sessionUserId);
      if (isAssignedDirectly) {
        // Wardens must not see weekday requests before Faculty Advisor approval
        if (r.type === 'weekday' && (r.status === 'pending_faculty' || r.currentApprovalStage === 'FACULTY')) {
          return false;
        }
        return true;
      }

      const wardenDept = normalizeDepartment(session?.department);
      const isGeneralWarden = !wardenDept || wardenDept === 'HOSTEL ADMINISTRATION' || wardenDept === 'ALL DEPARTMENTS';
      const yearMatches = matchesYear(session?.year, r.year);
      const deptMatches = isGeneralWarden || matchesDepartment(wardenDept, r.department);

      // Year Wardens manage their assigned Year across all departments
      if (yearMatches || (deptMatches && yearMatches)) {
        if (r.type === 'weekday' && (r.status === 'pending_faculty' || r.currentApprovalStage === 'FACULTY')) {
          return false;
        }
        return true;
      }

      return false;
    }
    return true;
  });

  const pendingFaculty = scopedRequests.filter(r =>
    r.status === 'pending_faculty' ||
    r.currentApprovalStage === 'FACULTY'
  );

  const pendingStaff = scopedRequests.filter(r =>
    r.status === 'pending_staff' ||
    r.status === 'pending_warden' ||
    r.status === 'faculty_approved' ||
    r.currentApprovalStage === 'WARDEN'
  );

  const notifying = scopedRequests.filter(r =>
    r.status === 'notifying_parent' ||
    r.currentApprovalStage === 'PARENT'
  );

  const outNow = scopedRequests.filter(r => r.qrStatus === 'OUT');
  const returnedToday = scopedRequests.filter(r => r.status === 'returned');

  // Queue logic:
  // For Faculty: show requests awaiting faculty advisor approval (pending_faculty / stage: FACULTY)
  // For Staff/Warden: show requests awaiting warden approval (pending_staff / stage: WARDEN) and parent calls (stage: PARENT)
  const queue = isFaculty
    ? pendingFaculty
    : [...pendingStaff, ...notifying];

  const activeOut = outNow.slice();
  const history = scopedRequests.filter(r =>
    ['faculty_rejected', 'staff_rejected', 'parent_rejected', 'returned'].includes(r.status) ||
    r.currentApprovalStage === 'REJECTED' ||
    r.currentApprovalStage === 'RETURNED' ||
    (r.status === 'approved_final' && r.qrStatus !== 'OUT')
  );

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadHistoryPdf = async () => {
    if (!history || history.length === 0) {
      alert('No history records available to download.');
      return;
    }
    try {
      setIsGeneratingPdf(true);
      await generateHistoryPdf({
        role: isFaculty ? 'faculty' : 'warden',
        session,
        records: history
      });
    } catch (err) {
      console.error('Failed to download staff history:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

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
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [downloadingStaffPdf, setDownloadingStaffPdf] = useState(false);

  // Delete Staff Modal State
  const [deletingUser, setDeletingUser] = useState(null);
  const [deletingStaff, setDeletingStaff] = useState(false);

  // Faculty Control State
  const [facultyStudents, setFacultyStudents] = useState([]);
  const [unassignedStudents, setUnassignedStudents] = useState([]);
  const [loadingFacultyStudents, setLoadingFacultyStudents] = useState(false);
  const [facultySearchQuery, setFacultySearchQuery] = useState('');
  const [facultyMsg, setFacultyMsg] = useState('');
  const [facultyError, setFacultyError] = useState('');

  // Add Student Modal State for Faculty
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [addStudentMode, setAddStudentMode] = useState('assign'); // 'assign' | 'create'
  const [selectedStudentToAssign, setSelectedStudentToAssign] = useState('');
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [assigningStudent, setAssigningStudent] = useState(false);
  const [newStudentForm, setNewStudentForm] = useState({
    name: '',
    registerNumber: '',
    room: '',
    email: '',
    phone: '',
    password: ''
  });
  const [addStudentError, setAddStudentError] = useState('');

  // Remove Student Confirmation Modal State
  const [confirmRemoveStudent, setConfirmRemoveStudent] = useState(null);
  const [removingStudent, setRemovingStudent] = useState(false);

  const WARDEN_ORDER_LIST = [];
  const DEPARTMENT_OPTIONS = ['CSE', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Mechatronics', 'Chemistry', 'Maths', 'Physics', 'English'];
  const DEPT_ORDER_MAP = {
    'cse': 1,
    'ece': 2,
    'eee': 3,
    'mechanical': 4,
    'mech': 4,
    'civil': 5,
    'mechatronics': 6,
    'chemistry': 7,
    'maths': 8,
    'physics': 9,
    'english': 10
  };

  function getWardenRank(u) {
    const yearRank = getYearRank(u.year || u.assignedYear);
    if (yearRank !== 99) return yearRank;
    const uname = (u.username || u.staffId || '').toLowerCase();
    const name = (u.name || '').toLowerCase();
    if (uname.includes('rajesh') || name.includes('rajesh')) return 1;
    if (uname.includes('deva') || name.includes('deva')) return 2;
    if (uname.includes('prince') || name.includes('prince')) return 3;
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

  useEffect(() => {
    if (isFaculty) {
      loadFacultyStudents();
    }
  }, [isFaculty, session]);

  async function loadFacultyStudents() {
    try {
      setLoadingFacultyStudents(true);
      setFacultyError('');
      const res = await apiFetch('/api/faculty/students');
      if (res.success) {
        setFacultyStudents(res.assignedStudents || []);
        setUnassignedStudents(res.unassignedStudents || []);
      }
    } catch (err) {
      console.error('Error loading faculty students:', err);
      setFacultyError(err.message || 'Failed to load assigned students.');
    } finally {
      setLoadingFacultyStudents(false);
    }
  }

  async function handleAssignStudent(studentId) {
    if (!studentId) {
      setAddStudentError('Please select a student to assign.');
      return;
    }
    try {
      setAssigningStudent(true);
      setAddStudentError('');
      const res = await apiFetch('/api/faculty/students/assign', 'POST', { studentId });
      if (res.success) {
        setFacultyMsg(res.message);
        setShowAddStudentModal(false);
        setSelectedStudentToAssign('');
        await loadFacultyStudents();
        setTimeout(() => setFacultyMsg(''), 4000);
      }
    } catch (err) {
      setAddStudentError(err.message || 'Failed to assign student.');
    } finally {
      setAssigningStudent(false);
    }
  }

  async function handleCreateAndAssignStudent(e) {
    e.preventDefault();
    try {
      setCreatingStudent(true);
      setAddStudentError('');
      const res = await apiFetch('/api/faculty/students/create-and-assign', 'POST', newStudentForm);
      if (res.success) {
        setFacultyMsg(res.message);
        setShowAddStudentModal(false);
        setNewStudentForm({
          name: '',
          registerNumber: '',
          room: '',
          email: '',
          phone: '',
          password: ''
        });
        await loadFacultyStudents();
        setTimeout(() => setFacultyMsg(''), 4000);
      }
    } catch (err) {
      setAddStudentError(err.message || 'Failed to create student.');
    } finally {
      setCreatingStudent(false);
    }
  }

  async function handleUnassignStudent() {
    if (!confirmRemoveStudent) return;
    try {
      setRemovingStudent(true);
      const studentId = confirmRemoveStudent._id || confirmRemoveStudent.id;
      const res = await apiFetch(`/api/faculty/students/${studentId}/unassign`, 'POST');
      if (res.success) {
        setFacultyMsg(res.message);
        setConfirmRemoveStudent(null);
        await loadFacultyStudents();
        setTimeout(() => setFacultyMsg(''), 4000);
      }
    } catch (err) {
      alert(err.message || 'Failed to remove student assignment.');
    } finally {
      setRemovingStudent(false);
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
    if (!editForm.department || !editForm.department.trim()) {
      alert('Department selection is required.');
      return;
    }
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
      department: prev.department && prev.department !== 'Hostel Administration' ? prev.department : 'CSE'
    }));
  };

  const handleCreateStaff = async (e) => {
    if (e) e.preventDefault();
    setAddFormError('');

    // Validation
    if (!addForm.name.trim()) return setAddFormError('Full Name is required.');
    if (!addForm.username.trim()) return setAddFormError('Login ID is required.');
    if (!addForm.role.trim()) return setAddFormError('Role selection is required.');
    if (!addForm.department.trim()) return setAddFormError('Department selection is required.');
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
        department: addForm.department.trim(),
        year: addForm.year.trim(),
        email: addForm.email.trim(),
        phone: addForm.phone.trim(),
        password: addForm.password.trim()
      };

      const res = await apiFetch('/api/users/add-staff', 'POST', payload);
      setUpdateMsg(res.message || 'New staff account added successfully.');
      setShowAddModal(false);
      setShowAddPassword(false);
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

  const handleDownloadStaffPdf = async () => {
    try {
      setDownloadingStaffPdf(true);
      await generateStaffDetailsPdf({
        staffList: staffUsers,
        currentSession: session
      });
    } catch (err) {
      console.error('Failed to generate staff PDF:', err);
      alert('Failed to generate Staff & Warden Details PDF. Please try again.');
    } finally {
      setDownloadingStaffPdf(false);
    }
  };

  const renderAdminControlTable = () => (
    <div className="gkof-card" style={{ borderColor: 'var(--gold)' }}>
      <div style={{ marginBottom: '14px' }}>
        <h3 style={{ margin: 0 }}>⚙️ Warden Control – Staff Permissions &amp; Management</h3>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--ink-soft)' }}>
          Manage Wardens &amp; Faculty Advisors. Add new staff, edit permissions, department, assigned year, or delete accounts.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="gkof-btn ghost" onClick={loadStaffList}>🔄 Refresh List</button>
          <button
            type="button"
            className="gkof-btn"
            onClick={handleDownloadStaffPdf}
            disabled={downloadingStaffPdf || loadingStaff}
            style={{
              background: '#FFF8EC',
              color: 'var(--maroon)',
              border: '1px solid var(--gold)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: downloadingStaffPdf ? 'wait' : 'pointer'
            }}
            title="Download all Staff & Warden account details as PDF"
          >
            {downloadingStaffPdf ? '⏳ Generating PDF…' : '📄 Download Staff & Warden Details (PDF)'}
          </button>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            className="gkof-btn green"
            onClick={() => { setShowAddModal(true); setAddFormError(''); setShowAddPassword(false); }}
          >
            + Add Staff
          </button>
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
                              role: r
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
                        <select
                          value={editForm.department}
                          onChange={e => setEditForm({ ...editForm, department: e.target.value })}
                          style={{ padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--line)' }}
                        >
                          {editForm.department === 'Hostel Administration' && (
                            <option value="Hostel Administration">Hostel Administration</option>
                          )}
                          {DEPARTMENT_OPTIONS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
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
                  <select
                    value={addForm.department}
                    onChange={e => setAddForm({ ...addForm, department: e.target.value })}
                    required
                  >
                    {DEPARTMENT_OPTIONS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
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
                <div className="gkof-pass-wrap">
                  <input
                    type={showAddPassword ? 'text' : 'password'}
                    placeholder="Enter login password"
                    value={addForm.password}
                    onChange={e => setAddForm({ ...addForm, password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(prev => !prev)}
                    onMouseDown={(e) => e.preventDefault()}
                    tabIndex={-1}
                    aria-label={showAddPassword ? 'Hide password' : 'Show password'}
                    title={showAddPassword ? 'Hide password' : 'Show password'}
                    className="gkof-pass-toggle-btn"
                  >
                    {showAddPassword ? (
                      /* Eye-Off Icon (click to hide) */
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                      </svg>
                    ) : (
                      /* Eye Icon (click to show) */
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  className="gkof-btn ghost"
                  onClick={() => { setShowAddModal(false); setShowAddPassword(false); }}
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

  const renderFacultyControlTable = () => {
    const filteredStudents = facultyStudents.filter(s => {
      if (!facultySearchQuery.trim()) return true;
      const q = facultySearchQuery.trim().toLowerCase();
      const name = (s.name || '').toLowerCase();
      const reg = (s.registerNumber || s.reg || s.username || '').toLowerCase();
      return name.includes(q) || reg.includes(q);
    });

    return (
      <div className="gkof-card" style={{ borderColor: 'var(--gold)' }}>
        <div style={{ marginBottom: '14px' }}>
          <h3 style={{ margin: 0 }}>⚙️ Faculty Control – Student Management</h3>
          <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--ink-soft)' }}>
            Manage students assigned to your department and year: <b>{session?.department} ({facYearDisplay})</b>
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
            <input
              type="text"
              placeholder="🔍 Search by Name or Register No…"
              value={facultySearchQuery}
              onChange={e => setFacultySearchQuery(e.target.value)}
              style={{
                padding: '7px 12px',
                fontSize: '12.5px',
                borderRadius: '8px',
                border: '1px solid var(--line)',
                minWidth: '220px',
                maxWidth: '320px',
                outline: 'none'
              }}
            />
            <button className="gkof-btn ghost" onClick={loadFacultyStudents} title="Reload assigned students">
              🔄 Refresh
            </button>
            <span style={{ fontSize: '12px', color: 'var(--ink-soft)', fontWeight: 500 }}>
              {filteredStudents.length} of {facultyStudents.length} student{facultyStudents.length !== 1 ? 's' : ''} assigned
            </span>
          </div>

          <div>
            <button
              className="gkof-btn green"
              onClick={() => {
                setShowAddStudentModal(true);
                setAddStudentError('');
                setAddStudentMode(unassignedStudents.length > 0 ? 'assign' : 'create');
              }}
            >
              + Add Student
            </button>
          </div>
        </div>

        {facultyMsg && (
          <div style={{ background: '#E6F4EA', color: 'var(--green)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '14px', border: '1px solid var(--green)' }}>
            ✓ {facultyMsg}
          </div>
        )}

        {facultyError && (
          <div style={{ background: '#FBE4E1', color: 'var(--danger)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '14px', border: '1px solid var(--danger)' }}>
            ⚠️ {facultyError}
          </div>
        )}

        {loadingFacultyStudents ? (
          <div className="gkof-empty">Loading assigned students…</div>
        ) : facultyStudents.length === 0 ? (
          <div className="gkof-empty" style={{ padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '8px' }}>👨‍🎓</div>
            <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--ink)', marginBottom: '4px' }}>
              No students currently assigned
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', maxWidth: '420px', margin: '0 auto 16px' }}>
              You do not have any students assigned to your account in {session?.department} ({facYearDisplay}) yet.
              {unassignedStudents.length > 0 && ` There are ${unassignedStudents.length} unassigned student(s) available.`}
            </p>
            <button
              className="gkof-btn green"
              onClick={() => {
                setShowAddStudentModal(true);
                setAddStudentError('');
                setAddStudentMode(unassignedStudents.length > 0 ? 'assign' : 'create');
              }}
            >
              + Add Student
            </button>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="gkof-empty" style={{ padding: '28px 20px' }}>
            No students matching "{facultySearchQuery}" found in your assigned list.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--cream-soft)', borderBottom: '2px solid var(--gold-soft)', color: 'var(--ink)' }}>
                  <th style={{ padding: '10px' }}>Student Name</th>
                  <th style={{ padding: '10px' }}>Register Number</th>
                  <th style={{ padding: '10px' }}>Department</th>
                  <th style={{ padding: '10px' }}>Year</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map(s => (
                  <tr key={s._id || s.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '10px' }}>
                      <b>{s.name}</b>
                      {s.room && <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>Room: {s.room}</div>}
                    </td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
                      {s.registerNumber || s.reg || s.username || '—'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {s.department || '—'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {normalizeYear(s.year) || '—'}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        backgroundColor: s.status === 'inactive' ? '#FCE8E6' : '#E6F4EA',
                        color: s.status === 'inactive' ? 'var(--red)' : 'var(--green)'
                      }}>
                        {s.status === 'inactive' ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <button
                        className="gkof-btn red"
                        style={{ padding: '4px 10px', fontSize: '11.5px' }}
                        onClick={() => setConfirmRemoveStudent(s)}
                      >
                        🗑 Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Student Modal */}
        {showAddStudentModal && (
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
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
              border: '1px solid var(--line)',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--maroon-dark)', fontFamily: 'Roboto Slab, serif' }}>
                  ➕ Add Student Assignment
                </h3>
                <button
                  onClick={() => setShowAddStudentModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--ink-soft)' }}
                >
                  ✕
                </button>
              </div>

              {/* Department & Year Scope Info Banner */}
              <div style={{
                background: '#F9F6F0',
                border: '1px solid var(--gold-soft)',
                borderRadius: '8px',
                padding: '10px 12px',
                fontSize: '12px',
                marginBottom: '16px',
                color: 'var(--ink)'
              }}>
                <b>Your Assigned Scope:</b> {session?.department} · {facYearDisplay}
                <div style={{ fontSize: '11px', color: 'var(--ink-soft)', marginTop: '2px' }}>
                  Students added or assigned will strictly belong to this Department and Year.
                </div>
              </div>

              {/* Mode Toggle */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
                <button
                  type="button"
                  className={`gkof-btn ${addStudentMode === 'assign' ? 'teal' : 'ghost'}`}
                  style={{ flex: 1, fontSize: '12px', padding: '6px 10px' }}
                  onClick={() => { setAddStudentMode('assign'); setAddStudentError(''); }}
                >
                  Assign Existing Student ({unassignedStudents.length})
                </button>
                <button
                  type="button"
                  className={`gkof-btn ${addStudentMode === 'create' ? 'teal' : 'ghost'}`}
                  style={{ flex: 1, fontSize: '12px', padding: '6px 10px' }}
                  onClick={() => { setAddStudentMode('create'); setAddStudentError(''); }}
                >
                  Register New Student
                </button>
              </div>

              {addStudentError && (
                <div style={{ background: '#FBE4E1', color: 'var(--danger)', padding: '10px 12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, marginBottom: '14px', border: '1px solid var(--danger)' }}>
                  ⚠️ {addStudentError}
                </div>
              )}

              {addStudentMode === 'assign' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>
                    Select Unassigned Student from {session?.department} ({facYearDisplay})
                  </label>
                  {unassignedStudents.length === 0 ? (
                    <div style={{ padding: '16px', background: '#F9F9F9', borderRadius: '8px', fontSize: '12.5px', color: 'var(--ink-soft)', textAlign: 'center', marginBottom: '16px' }}>
                      No unassigned students available in {session?.department} ({facYearDisplay}).
                      <div style={{ marginTop: '8px' }}>
                        <button
                          type="button"
                          className="gkof-btn ghost"
                          style={{ fontSize: '11.5px', padding: '4px 10px' }}
                          onClick={() => setAddStudentMode('create')}
                        >
                          Switch to "Register New Student"
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ marginBottom: '16px' }}>
                      <select
                        value={selectedStudentToAssign}
                        onChange={e => setSelectedStudentToAssign(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: '8px',
                          border: '1px solid var(--line)',
                          fontSize: '13px',
                          backgroundColor: '#FFF'
                        }}
                      >
                        <option value="">-- Choose a student to assign --</option>
                        {unassignedStudents.map(st => (
                          <option key={st._id} value={st._id}>
                            {st.name} ({st.registerNumber || st.reg || st.username}) {st.room ? `· Room: ${st.room}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <button
                      type="button"
                      className="gkof-btn ghost"
                      onClick={() => setShowAddStudentModal(false)}
                      disabled={assigningStudent}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="gkof-btn green"
                      onClick={() => handleAssignStudent(selectedStudentToAssign)}
                      disabled={assigningStudent || !selectedStudentToAssign}
                    >
                      {assigningStudent ? 'Assigning…' : 'Assign Student'}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateAndAssignStudent}>
                  <div className="gkof-row">
                    <div className="gkof-field">
                      <label>Student Full Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. S. Kavitha"
                        value={newStudentForm.name}
                        onChange={e => setNewStudentForm({ ...newStudentForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="gkof-field">
                      <label>Register Number *</label>
                      <input
                        type="text"
                        placeholder="12 digits, starts with 8301"
                        value={newStudentForm.registerNumber}
                        onChange={e => setNewStudentForm({ ...newStudentForm, registerNumber: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="gkof-row">
                    <div className="gkof-field">
                      <label>Department (Locked to your scope)</label>
                      <input
                        type="text"
                        value={session?.department || 'CSE'}
                        disabled
                        style={{ background: '#F5F5F5', color: '#666', cursor: 'not-allowed' }}
                      />
                    </div>
                    <div className="gkof-field">
                      <label>Academic Year (Locked to your scope)</label>
                      <input
                        type="text"
                        value={facYearDisplay}
                        disabled
                        style={{ background: '#F5F5F5', color: '#666', cursor: 'not-allowed' }}
                      />
                    </div>
                  </div>

                  <div className="gkof-row">
                    <div className="gkof-field">
                      <label>Room Number</label>
                      <input
                        type="text"
                        placeholder="e.g. 102"
                        value={newStudentForm.room}
                        onChange={e => setNewStudentForm({ ...newStudentForm, room: e.target.value })}
                      />
                    </div>
                    <div className="gkof-field">
                      <label>Student Phone</label>
                      <input
                        type="tel"
                        placeholder="10-digit number"
                        value={newStudentForm.phone}
                        onChange={e => setNewStudentForm({ ...newStudentForm, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="gkof-field">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="student@example.com"
                      value={newStudentForm.email}
                      onChange={e => setNewStudentForm({ ...newStudentForm, email: e.target.value })}
                    />
                  </div>

                  <p style={{ fontSize: '11px', color: 'var(--ink-soft)', margin: '8px 0 16px' }}>
                    * Initial login password defaults to the student's Register Number.
                  </p>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="gkof-btn ghost"
                      onClick={() => setShowAddStudentModal(false)}
                      disabled={creatingStudent}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="gkof-btn green"
                      disabled={creatingStudent}
                    >
                      {creatingStudent ? 'Creating…' : 'Create & Assign'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Remove Student Confirmation Modal */}
        {confirmRemoveStudent && (
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
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
              border: '2px solid var(--danger)',
              padding: '24px'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '44px', display: 'block', marginBottom: '8px' }}>⚠️</span>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--danger)', fontFamily: 'Roboto Slab, serif' }}>
                  Confirm Removal
                </h3>
              </div>

              <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--ink)', margin: '0 0 16px', fontWeight: 500 }}>
                Are you sure you want to remove this student's assignment from your Faculty Advisor account?
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
                <div><b>Student Name:</b> {confirmRemoveStudent.name}</div>
                <div><b>Register Number:</b> {confirmRemoveStudent.registerNumber || confirmRemoveStudent.reg}</div>
                <div><b>Department:</b> {confirmRemoveStudent.department}</div>
                <div><b>Year:</b> {confirmRemoveStudent.year}</div>
                <div style={{ marginTop: '8px', fontSize: '11.5px', color: 'var(--ink-soft)' }}>
                  ℹ️ Note: This only removes the student's assignment to you. The student's login account and history remain intact.
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="gkof-btn ghost"
                  style={{ flex: 1 }}
                  onClick={() => setConfirmRemoveStudent(null)}
                  disabled={removingStudent}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="gkof-btn red"
                  style={{ flex: 1 }}
                  onClick={handleUnassignStudent}
                  disabled={removingStudent}
                >
                  {removingStudent ? 'Removing…' : 'Remove Assignment'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (activeTab === 'admin') {
    return (
      <>
        {isAdminOrWarden && renderAdminControlTable()}
      </>
    );
  }

  if (activeTab === 'faculty-control') {
    return (
      <>
        {isFaculty && renderFacultyControlTable()}
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
              <h2 style={{ margin: 0, fontSize: '18px', color: '#FFF' }}>
                {isFaculty ? '📜 Faculty Advisor Approval History' : '📜 Warden Out Pass History'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--gold-soft)' }}>
                {isFaculty
                  ? `View completed and processed approval records for ${facYearDisplay} ${session?.department || 'CSE'} (${history.length} records)`
                  : `View all completed "Outpass Ready", returned, and archived student out pass records (${history.length} records)`}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                id="download-staff-history-btn"
                className="gkof-btn"
                style={{
                  background: 'var(--gold)',
                  color: '#2A2140',
                  border: 'none',
                  fontWeight: 700,
                  padding: '9px 16px',
                  fontSize: '13px',
                  cursor: isGeneratingPdf ? 'not-allowed' : 'pointer',
                  opacity: isGeneratingPdf ? 0.8 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                onClick={handleDownloadHistoryPdf}
                disabled={isGeneratingPdf}
                title={`Download ${isFaculty ? 'faculty approval' : 'warden outpass'} history as PDF`}
              >
                {isGeneratingPdf ? '⏳ Generating PDF...' : '📥 Download History'}
              </button>
              {onNavigateTab && (
                <button
                  className="gkof-btn ghost"
                  style={{ color: '#FFF', borderColor: 'rgba(255,255,255,0.4)', padding: '9px 16px', fontSize: '13px', cursor: 'pointer' }}
                  onClick={() => onNavigateTab('dashboard')}
                >
                  ← Back to Dashboard
                </button>
              )}
            </div>
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
