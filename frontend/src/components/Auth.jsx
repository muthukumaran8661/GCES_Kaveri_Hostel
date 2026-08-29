import React, { useState } from 'react';

function PasswordInput({ value, onChange, placeholder, readOnly, maxLength, inputMode, style, id, name }) {
  const [show, setShow] = useState(false);

  const toggleShow = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setShow((prev) => !prev);
  };

  return (
    <div className="gkof-pass-wrap">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
        maxLength={maxLength}
        inputMode={inputMode}
        id={id}
        name={name}
        style={style}
      />
      <button
        type="button"
        onClick={toggleShow}
        onMouseDown={(e) => e.preventDefault()}
        tabIndex={-1}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        className="gkof-pass-toggle-btn"
      >
        {show ? (
          /* Eye-Off Icon (Password is currently visible; click to hide) */
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        ) : (
          /* Eye Icon (Password is currently hidden; click to show) */
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        )}
      </button>
    </div>
  );
}

export default function Auth({ onLogin, onSignup, error, setError }) {
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'
  const [role, setRole] = useState('student'); // 'student' | 'staff'

  // Form states
  const [year, setYear] = useState('I Year');

  // Student form state
  const [studentId, setStudentId] = useState('');
  const [regNo, setRegNo] = useState('');
  const [roomNo, setRoomNo] = useState('');
  const [name, setName] = useState('');
  const [homeAddress, setHomeAddress] = useState('');

  // Staff/Faculty form state
  const [staffId, setStaffId] = useState('');
  const [designation, setDesignation] = useState('');
  const [department, setDepartment] = useState('CSE');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPass, setStaffPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  const handleRegChange = (val) => {
    const v = val.replace(/[^0-9]/g, '').slice(0, 12);
    setRegNo(v);
  };

  const handleRoomChange = (val) => {
    setRoomNo(val.replace(/[^0-9]/g, ''));
  };

  const handleStaffPhoneChange = (val) => {
    setStaffPhone(val.replace(/[^0-9]/g, '').slice(0, 10));
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
        setError(role === 'faculty' ? 'Enter your Faculty ID and password.' : 'Enter your Warden / Admin ID and password.');
        return;
      }
      onLogin({ role: role, username: staffId.trim(), password: staffPass.trim() });
    }
  };

  const handleSignupSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (role === 'student') {
      if (!name.trim() || !regNo.trim() || !roomNo.trim() || !studentId.trim()) {
        setError('Please fill in every required field.');
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
        department: department.trim(),
        year: year.trim(),
        homeAddress: homeAddress.trim()
      });
    } else {
      if (!staffId.trim()) {
        setError(role === 'faculty' ? 'Faculty ID is required.' : 'Warden / Admin ID is required.');
        return;
      }
      if (!staffEmail.trim()) {
        setError('Email is required.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail.trim())) {
        setError('Please enter a valid email address.');
        return;
      }
      if (!staffPhone.trim()) {
        setError('Phone number is required.');
        return;
      }
      if (!/^[0-9]{10}$/.test(staffPhone.trim())) {
        setError('Phone number must be exactly 10 digits.');
        return;
      }
      if (!staffPass.trim()) {
        setError('Password is required.');
        return;
      }
      onSignup({
        role: role,
        username: staffId.trim(),
        password: staffPass.trim(),
        name: staffId.trim(),
        staffId: staffId.trim(),
        designation: designation.trim() || (role === 'faculty' ? 'Faculty Advisor' : 'Hostel Warden'),
        department: role === 'staff' ? 'Hostel Administration' : department.trim(),
        year: year.trim(),
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
          {role !== 'staff' && (
            <div
              className={`gkof-auth-tab ${authMode === 'signup' ? 'active' : ''}`}
              onClick={() => { setAuthMode('signup'); setError(''); }}
            >
              Create Account
            </div>
          )}
        </div>

        {error && <div className="gkof-auth-error show">{error}</div>}

        <div className="gkof-card" style={{ marginBottom: 0 }}>
          <div className="gkof-role-pick">
            <div
              className={`gkof-role-opt ${role === 'student' ? 'active' : ''}`}
              onClick={() => {
                setRole('student');
                if (department === 'Hostel Administration') setDepartment('CSE');
              }}
            >
              <span className="emoji">🎓</span>Student
            </div>
            <div
              className={`gkof-role-opt ${role === 'faculty' ? 'active' : ''}`}
              onClick={() => {
                setRole('faculty');
                if (department === 'Hostel Administration') setDepartment('CSE');
              }}
            >
              <span className="emoji">👨‍🏫</span>Faculty Advisor
            </div>
            <div
              className={`gkof-role-opt ${role === 'staff' ? 'active' : ''}`}
              onClick={() => {
                setRole('staff');
                setDepartment('Hostel Administration');
                setAuthMode('login');
                setError('');
              }}
            >
              <span className="emoji">🛡️</span>Warden / Admin
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
                    <PasswordInput
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
                    <label>{role === 'faculty' ? 'Faculty ID' : 'Warden / Admin ID'}</label>
                    <input
                      placeholder={role === 'faculty' ? 'e.g. FAC-CSE-01' : 'e.g. STF-014'}
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
                    />
                  </div>
                  <div className="gkof-field">
                    <label>Password</label>
                    <PasswordInput
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
                  <div className="gkof-row">
                    <div className="gkof-field">
                      <label>Department</label>
                      <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                        <option value="CSE">CSE</option>
                        <option value="ECE">ECE</option>
                        <option value="EEE">EEE</option>
                        <option value="Mechanical">Mechanical</option>
                        <option value="Civil">Civil</option>
                        <option value="Mechatronics">Mechatronics</option>
                      </select>
                    </div>
                    <div className="gkof-field">
                      <label>Academic Year</label>
                      <select value={year} onChange={(e) => setYear(e.target.value)}>
                        <option value="I Year">I Year</option>
                        <option value="II Year">II Year</option>
                        <option value="III Year">III Year</option>
                        <option value="IV Year">IV Year</option>
                      </select>
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
                    <PasswordInput
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
                      <label>{role === 'faculty' ? 'Faculty ID' : 'Warden / Admin ID'}</label>
                      <input
                        placeholder={role === 'faculty' ? 'e.g. FAC-CSE-01' : 'e.g. STF-014'}
                        value={staffId}
                        onChange={(e) => setStaffId(e.target.value)}
                      />
                    </div>
                    <div className="gkof-field">
                      <label>Designation</label>
                      <input
                        placeholder={role === 'faculty' ? 'Faculty Advisor' : 'Hostel Warden'}
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="gkof-row">
                    <div className="gkof-field">
                      <label>Department</label>
                      {role === 'staff' ? (
                        <select value="Hostel Administration" disabled style={{ backgroundColor: '#F1F3F4', cursor: 'not-allowed', color: '#2A2140', fontWeight: 600 }}>
                          <option value="Hostel Administration">Hostel Administration</option>
                        </select>
                      ) : (
                        <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                          <option value="CSE">CSE</option>
                          <option value="ECE">ECE</option>
                          <option value="EEE">EEE</option>
                          <option value="Mechanical">Mechanical</option>
                          <option value="Civil">Civil</option>
                          <option value="Mechatronics">Mechatronics</option>
                        </select>
                      )}
                    </div>
                    <div className="gkof-field">
                      <label>{role === 'faculty' ? 'Assigned Year' : 'Academic Year'}</label>
                      <select value={year} onChange={(e) => setYear(e.target.value)}>
                        <option value="I Year">I Year</option>
                        <option value="II Year">II Year</option>
                        <option value="III Year">III Year</option>
                        <option value="IV Year">IV Year</option>
                        <option value="All Years">All Years</option>
                      </select>
                    </div>
                  </div>
                  <div className="gkof-row">
                    <div className="gkof-field">
                      <label>Email</label>
                      <input
                        type="email"
                        placeholder="e.g. faculty@gces.edu"
                        value={staffEmail}
                        onChange={(e) => setStaffEmail(e.target.value)}
                      />
                    </div>
                    <div className="gkof-field">
                      <label>Phone</label>
                      <input
                        type="tel"
                        placeholder="10-digit mobile"
                        maxLength={10}
                        pattern="[0-9]{10}"
                        inputMode="numeric"
                        title="Phone number must be exactly 10 digits"
                        value={staffPhone}
                        onChange={(e) => handleStaffPhoneChange(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="gkof-field">
                    <label>Choose Password</label>
                    <PasswordInput
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
