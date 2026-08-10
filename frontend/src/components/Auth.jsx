import React, { useState } from 'react';

export default function Auth({ onLogin, onSignup, error, setError }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [role, setRole] = useState('student'); // 'student' | 'staff'

  // Student form state
  const [studentId, setStudentId] = useState('');
  const [regNo, setRegNo] = useState('');
  const [roomNo, setRoomNo] = useState('');
  const [name, setName] = useState('');
  const [homeAddress, setHomeAddress] = useState('');

  // Staff form state
  const [staffId, setStaffId] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPass, setStaffPass] = useState('');

  const handleRegChange = (val) => {
    const v = val.replace(/[^0-9]/g, '').slice(0, 12);
    setRegNo(v);
  };

  const handleRoomChange = (val) => {
    setRoomNo(val.replace(/[^0-9]/g, ''));
  };

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (role === 'student') {
      if (!studentId.trim() || !regNo.trim()) {
        setError('Enter your Student ID and Register No. as password.');
        return;
      }
      if (!/^8301[0-9]{8}$/.test(regNo.trim())) {
        setError('Register No. must be 12 digits, starting with 8301.');
        return;
      }
      onLogin({ role: 'student', username: studentId.trim(), password: regNo.trim() });
    } else {
      if (!staffId.trim() || !staffPass.trim()) {
        setError('Enter your Staff ID and password.');
        return;
      }
      onLogin({ role: 'staff', username: staffId.trim(), password: staffPass.trim() });
    }
  };

  const handleSignupSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (role === 'student') {
      if (!name.trim() || !regNo.trim() || !roomNo.trim() || !studentId.trim()) {
        setError('Please fill in every field.');
        return;
      }
      if (!/^8301[0-9]{8}$/.test(regNo.trim())) {
        setError('Register No. must be 12 digits, starting with 8301.');
        return;
      }
      if (!/^[0-9]+$/.test(roomNo.trim())) {
        setError('Room No. must be numbers only.');
        return;
      }
      onSignup({
        role: 'student',
        username: studentId.trim(),
        password: regNo.trim(),
        name: name.trim(),
        reg: regNo.trim(),
        room: roomNo.trim(),
        studentId: studentId.trim(),
        homeAddress: homeAddress.trim()
      });
    } else {
      if (!staffId.trim() || !designation.trim() || !staffPass.trim()) {
        setError('Please fill in every field.');
        return;
      }
      onSignup({
        role: 'staff',
        username: staffId.trim(),
        password: staffPass.trim(),
        name: staffId.trim(),
        staffId: staffId.trim(),
        designation: designation.trim(),
        department: department.trim(),
        email: staffEmail.trim(),
        phone: staffPhone.trim()
      });
    }
  };

  return (
    <div className="gkof-auth-wrap">
      <div className="gkof-auth-box">
        <div className="gkof-auth-tabs">
          <div
            className={`gkof-auth-tab ${authMode === 'login' ? 'active' : ''}`}
            onClick={() => { setAuthMode('login'); setError(''); }}
          >
            Login
          </div>
          <div
            className={`gkof-auth-tab ${authMode === 'signup' ? 'active' : ''}`}
            onClick={() => { setAuthMode('signup'); setError(''); }}
          >
            Create Account
          </div>
        </div>

        {error && <div className="gkof-auth-error show">{error}</div>}

        <div className="gkof-card" style={{ marginBottom: 0 }}>
          <div className="gkof-role-pick">
            <div
              className={`gkof-role-opt ${role === 'student' ? 'active' : ''}`}
              onClick={() => setRole('student')}
            >
              <span className="emoji">🎓</span>Student
            </div>
            <div
              className={`gkof-role-opt ${role === 'staff' ? 'active' : ''}`}
              onClick={() => setRole('staff')}
            >
              <span className="emoji">🛡️</span>Staff / Warden
            </div>
          </div>

          {authMode === 'login' ? (
            <form onSubmit={handleLoginSubmit}>
              {role === 'student' ? (
                <>
                  <div className="gkof-field">
                    <label>Student ID</label>
                    <input
                      placeholder="e.g. 24cs526"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                    />
                  </div>
                  <div className="gkof-field">
                    <label>Password (your Register No.)</label>
                    <input
                      placeholder="8301XXXXXXXX"
                      maxLength={12}
                      inputMode="numeric"
                      value={regNo}
                      onChange={(e) => handleRegChange(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="gkof-field">
                    <label>Staff ID</label>
                    <input
                      placeholder="e.g. STF-014"
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
                    />
                  </div>
                  <div className="gkof-field">
                    <label>Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={staffPass}
                      onChange={(e) => setStaffPass(e.target.value)}
                    />
                  </div>
                </>
              )}
              <button className="gkof-btn wide" type="submit">Log In</button>
              <div className="gkof-switch">
                First time here? <a onClick={() => setAuthMode('signup')}>Create an account</a>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignupSubmit}>
              {role === 'student' ? (
                <>
                  <div className="gkof-field">
                    <label>Full Name</label>
                    <input
                      placeholder="e.g. R. Priya"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="gkof-row">
                    <div className="gkof-field">
                      <label>Register No.</label>
                      <input
                        placeholder="8301XXXXXXXX"
                        maxLength={12}
                        inputMode="numeric"
                        value={regNo}
                        onChange={(e) => handleRegChange(e.target.value)}
                      />
                    </div>
                    <div className="gkof-field">
                      <label>Room No.</label>
                      <input
                        placeholder="e.g. 214"
                        inputMode="numeric"
                        value={roomNo}
                        onChange={(e) => handleRoomChange(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="gkof-field">
                    <label>Home Address (Permanent)</label>
                    <input
                      placeholder="e.g. 123 Main Street, Thanjavur"
                      value={homeAddress}
                      onChange={(e) => setHomeAddress(e.target.value)}
                    />
                  </div>
                  <div className="gkof-field">
                    <label>Student ID</label>
                    <input
                      placeholder="e.g. 24cs526"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                    />
                  </div>
                  <div className="gkof-field">
                    <label>Password</label>
                    <input
                      readOnly
                      placeholder="Auto-set to your Register No."
                      value={regNo}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="gkof-row">
                    <div className="gkof-field">
                      <label>Staff ID</label>
                      <input
                        placeholder="e.g. STF-014"
                        value={staffId}
                        onChange={(e) => setStaffId(e.target.value)}
                      />
                    </div>
                    <div className="gkof-field">
                      <label>Designation</label>
                      <input
                        placeholder="Hostel Warden"
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="gkof-field">
                    <label>Department</label>
                    <input
                      placeholder="e.g. Hostel Administration"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>
                  <div className="gkof-row">
                    <div className="gkof-field">
                      <label>Email</label>
                      <input
                        type="email"
                        placeholder="e.g. staff@gces.edu"
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                      />
                    </div>
                    <div className="gkof-field">
                      <label>Phone</label>
                      <input
                        type="tel"
                        placeholder="e.g. 98765 43210"
                        value={staffPhone}
                        onChange={(e) => setStaffPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="gkof-field">
                    <label>Choose Password</label>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={staffPass}
                      onChange={(e) => setStaffPass(e.target.value)}
                    />
                  </div>
                </>
              )}
              <button className="gkof-btn wide teal" type="submit">Create Account</button>
              <div className="gkof-switch">
                Already have an account? <a onClick={() => setAuthMode('login')}>Log in</a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
