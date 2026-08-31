import React, { useState, useEffect } from 'react';

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
  const [showWardenResetModal, setShowWardenResetModal] = useState(false);
  const [showFacultyResetModal, setShowFacultyResetModal] = useState(false);

  // Form states

  const [year, setYear] = useState('I Year');

  // Student form state
  const [studentId, setStudentId] = useState('');
  const [regNo, setRegNo] = useState('');
  const [roomNo, setRoomNo] = useState('');
  const [name, setName] = useState('');
  const [homeAddress, setHomeAddress] = useState('');

  // Staff/Faculty form state
  const [staffName, setStaffName] = useState('');
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
        setError(role === 'faculty' ? 'Enter your Faculty ID and password.' : 'Enter your Warden ID and password.');
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
      if (role === 'faculty' && !staffName.trim()) {
        setError('Faculty Name is required.');
        return;
      }
      if (!staffId.trim()) {
        setError(role === 'faculty' ? 'Faculty ID is required.' : 'Warden ID is required.');
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
        name: role === 'faculty' ? staffName.trim() : (staffName.trim() || staffId.trim()),
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
          {role === 'student' && (
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
                setAuthMode('login');
                setError('');
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
              <span className="emoji">🛡️</span>Warden
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
                    <label>{role === 'faculty' ? 'Faculty ID' : 'Warden ID'}</label>
                    <input
                      placeholder={role === 'faculty' ? 'e.g. FAC-CSE-01' : 'e.g. Muthu@123'}
                      value={staffId}
                      onChange={(e) => setStaffId(e.target.value)}
                    />
                  </div>
                  <div className="gkof-field" style={{ marginBottom: (role === 'staff' || role === 'faculty') ? '6px' : '16px' }}>
                    <label>Password</label>
                    <PasswordInput
                      placeholder="••••••••"
                      value={staffPass}
                      onChange={(e) => setStaffPass(e.target.value)}
                    />
                  </div>
                  {(role === 'staff' || role === 'faculty') && (
                    <div className="gkof-forgot-wrap">
                      <button
                        type="button"
                        className="gkof-forgot-link"
                        onClick={() => {
                          if (role === 'staff') setShowWardenResetModal(true);
                          else if (role === 'faculty') setShowFacultyResetModal(true);
                        }}
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}
                </>
              )}
              <button className="gkof-btn wide" type="submit">Log In</button>
              {role === 'student' && (
                <div className="gkof-switch">
                  First time here? <a onClick={() => setAuthMode('signup')}>Create an account</a>
                </div>
              )}
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
                  {role === 'faculty' ? (
                    <>
                      <div className="gkof-row">
                        <div className="gkof-field">
                          <label>Faculty Name</label>
                          <input
                            placeholder="Enter Faculty Name"
                            value={staffName}
                            onChange={(e) => setStaffName(e.target.value)}
                          />
                        </div>
                        <div className="gkof-field">
                          <label>Faculty ID</label>
                          <input
                            placeholder="e.g. FAC-CSE-01"
                            value={staffId}
                            onChange={(e) => setStaffId(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="gkof-row">
                        <div className="gkof-field">
                          <label>Designation</label>
                          <input
                            placeholder="Faculty Advisor"
                            value={designation}
                            onChange={(e) => setDesignation(e.target.value)}
                          />
                        </div>
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
                      </div>
                      <div className="gkof-row">
                        <div className="gkof-field">
                          <label>Assigned Year</label>
                          <select value={year} onChange={(e) => setYear(e.target.value)}>
                            <option value="I Year">I Year</option>
                            <option value="II Year">II Year</option>
                            <option value="III Year">III Year</option>
                            <option value="IV Year">IV Year</option>
                            <option value="All Years">All Years</option>
                          </select>
                        </div>
                        <div className="gkof-field">
                          <label>Email</label>
                          <input
                            type="email"
                            placeholder="e.g. faculty@gces.edu"
                            value={staffEmail}
                            onChange={(e) => setStaffEmail(e.target.value)}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="gkof-row">
                        <div className="gkof-field">
                          <label>Warden ID</label>
                          <input
                            placeholder="e.g. Muthu@123"
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
                      <div className="gkof-row">
                        <div className="gkof-field">
                          <label>Department</label>
                          <select value="Hostel Administration" disabled style={{ backgroundColor: '#F1F3F4', cursor: 'not-allowed', color: '#2A2140', fontWeight: 600 }}>
                            <option value="Hostel Administration">Hostel Administration</option>
                          </select>
                        </div>
                        <div className="gkof-field">
                          <label>Academic Year</label>
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
                            placeholder="e.g. warden@gces.edu"
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
                    </>
                  )}
                  {role === 'faculty' && (
                    <div className="gkof-row">
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
                  )}
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
      <WardenForgotPasswordModal
        isOpen={showWardenResetModal}
        onClose={() => setShowWardenResetModal(false)}
        initialWardenId={staffId}
      />
      <FacultyForgotPasswordModal
        isOpen={showFacultyResetModal}
        onClose={() => setShowFacultyResetModal(false)}
        initialFacultyId={staffId}
      />
    </div>
  );
}

function WardenForgotPasswordModal({ isOpen, onClose, initialWardenId = '' }) {
  const [step, setStep] = useState('email'); // 'email' | 'otp' | 'password' | 'success'
  const [wardenId, setWardenId] = useState(initialWardenId);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && initialWardenId) {
      setWardenId(initialWardenId);
    }
  }, [isOpen, initialWardenId]);

  if (!isOpen) return null;

  const handleClose = () => {
    setStep('email');
    setWardenId('');
    setEmail('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setInfoMsg('');
    onClose();
  };

  const handleSendEmail = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMsg('');

    if (!wardenId.trim()) {
      setError('Please enter your Warden ID.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/warden/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: wardenId.trim(),
          email: email.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send OTP.');
      }
      setInfoMsg(data.message || 'OTP has been sent to your registered email address.');
      setStep('otp');
    } catch (err) {
      console.error('Warden Send OTP error:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp.trim()) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/warden/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: wardenId.trim(),
          email: email.trim(),
          otp: otp.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid OTP code.');
      }
      setError('');
      setInfoMsg('');
      setStep('password');
    } catch (err) {
      console.error('Warden Verify OTP error:', err);
      setError(err.message || 'Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!newPassword.trim()) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.trim().length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please confirm your new password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/warden/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: wardenId.trim(),
          email: email.trim(),
          otp: otp.trim(),
          newPassword: newPassword.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to reset password.');
      }
      setStep('success');
    } catch (err) {
      console.error('Warden Reset Password error:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gkof-modal-overlay" onClick={handleClose}>
      <div className="gkof-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="gkof-modal-close" onClick={handleClose} aria-label="Close">
          ✕
        </button>

        <div className="gkof-modal-header">
          <div className="gkof-modal-badge">🛡️ Warden Security</div>
          <h2>Warden Password Reset</h2>
        </div>

        {error && <div className="gkof-auth-error show" style={{ marginBottom: '16px' }}>{error}</div>}
        {infoMsg && step === 'otp' && (
          <div className="gkof-note" style={{ marginBottom: '16px', background: '#DCF3EA', borderColor: '#2E8B57', color: '#127A6E', fontWeight: 600 }}>
            ✉️ {infoMsg}
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleSendEmail}>
            <p className="gkof-modal-desc">
              Enter your Warden ID and its exact registered email address to receive a 6-digit verification OTP.
            </p>
            <div className="gkof-field">
              <label>Warden ID</label>
              <input
                type="text"
                placeholder="e.g. Rajesh@123"
                value={wardenId}
                onChange={(e) => setWardenId(e.target.value)}
                autoFocus
              />
            </div>
            <div className="gkof-field">
              <label>Registered Email Address</label>
              <input
                type="email"
                placeholder="e.g. rajeshwarden30@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button className="gkof-btn wide teal" type="submit" disabled={loading}>
              {loading ? 'Validating & Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <p className="gkof-modal-desc">
              Enter the 6-digit OTP code sent to your email. (OTP expires in 5 minutes).
            </p>
            <div className="gkof-field">
              <label>6-Digit OTP</label>
              <input
                type="text"
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                style={{ letterSpacing: '4px', fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }}
                autoFocus
              />
            </div>
            <button className="gkof-btn wide teal" type="submit" disabled={loading}>
              {loading ? 'Verifying OTP...' : 'Verify OTP'}
            </button>
            <div className="gkof-switch" style={{ marginTop: '12px' }}>
              Didn't receive code? <a onClick={() => handleSendEmail()}>Resend OTP</a>
            </div>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handleResetPassword}>
            <p className="gkof-modal-desc">
              OTP verified! Enter and confirm a new password for Warden ID <strong>{wardenId}</strong>.
            </p>
            <div className="gkof-field">
              <label>New Password</label>
              <PasswordInput
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="gkof-field">
              <label>Confirm New Password</label>
              <PasswordInput
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button className="gkof-btn wide teal" type="submit" disabled={loading}>
              {loading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <h3 style={{ margin: '0 0 8px', color: 'var(--teal)', fontSize: '18px' }}>
              Password Updated Successfully!
            </h3>
            <p className="gkof-modal-desc" style={{ marginBottom: '20px' }}>
              The password for Warden account <strong>{wardenId}</strong> has been updated. You can now log in with your new credentials.
            </p>
            <button className="gkof-btn wide maroon" onClick={handleClose}>
              Back to Warden Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FacultyForgotPasswordModal({ isOpen, onClose, initialFacultyId = '' }) {
  const [step, setStep] = useState('email'); // 'email' | 'otp' | 'password' | 'success'
  const [facultyId, setFacultyId] = useState(initialFacultyId);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && initialFacultyId) {
      setFacultyId(initialFacultyId);
    }
  }, [isOpen, initialFacultyId]);

  if (!isOpen) return null;

  const handleClose = () => {
    setStep('email');
    setFacultyId('');
    setEmail('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setInfoMsg('');
    onClose();
  };

  const handleSendEmail = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setInfoMsg('');

    if (!facultyId.trim()) {
      setError('Please enter your Faculty Advisor ID.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/faculty/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: facultyId.trim(),
          facultyId: facultyId.trim(),
          email: email.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to send OTP.');
      }
      setInfoMsg(data.message || 'OTP has been sent to your registered email address.');
      setStep('otp');
    } catch (err) {
      console.error('Faculty Send OTP error:', err);
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp.trim()) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/faculty/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: facultyId.trim(),
          facultyId: facultyId.trim(),
          email: email.trim(),
          otp: otp.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Invalid OTP code.');
      }
      setError('');
      setInfoMsg('');
      setStep('password');
    } catch (err) {
      console.error('Faculty Verify OTP error:', err);
      setError(err.message || 'Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!newPassword.trim()) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.trim().length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please confirm your new password.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/faculty/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: facultyId.trim(),
          facultyId: facultyId.trim(),
          email: email.trim(),
          otp: otp.trim(),
          newPassword: newPassword.trim()
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to reset password.');
      }
      setStep('success');
    } catch (err) {
      console.error('Faculty Reset Password error:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gkof-modal-overlay" onClick={handleClose}>
      <div className="gkof-modal-box" onClick={(e) => e.stopPropagation()}>
        <button className="gkof-modal-close" onClick={handleClose} aria-label="Close">
          ✕
        </button>

        <div className="gkof-modal-header">
          <div className="gkof-modal-badge">👨‍🏫 Faculty Security</div>
          <h2>Faculty Advisor Password Reset</h2>
        </div>

        {error && <div className="gkof-auth-error show" style={{ marginBottom: '16px' }}>{error}</div>}
        {infoMsg && step === 'otp' && (
          <div className="gkof-note" style={{ marginBottom: '16px', background: '#DCF3EA', borderColor: '#2E8B57', color: '#127A6E', fontWeight: 600 }}>
            ✉️ {infoMsg}
          </div>
        )}

        {step === 'email' && (
          <form onSubmit={handleSendEmail}>
            <p className="gkof-modal-desc">
              Enter your Faculty Advisor ID and its exact registered email address to receive a 6-digit verification OTP.
            </p>
            <div className="gkof-field">
              <label>Faculty Advisor ID</label>
              <input
                type="text"
                placeholder="e.g. ArunKumar@123"
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
                autoFocus
              />
            </div>
            <div className="gkof-field">
              <label>Registered Email Address</label>
              <input
                type="email"
                placeholder="e.g. arunkumarfaculty@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button className="gkof-btn wide teal" type="submit" disabled={loading}>
              {loading ? 'Validating & Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp}>
            <p className="gkof-modal-desc">
              Enter the 6-digit OTP code sent to your email. (OTP expires in 5 minutes).
            </p>
            <div className="gkof-field">
              <label>6-Digit OTP</label>
              <input
                type="text"
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                style={{ letterSpacing: '4px', fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }}
                autoFocus
              />
            </div>
            <button className="gkof-btn wide teal" type="submit" disabled={loading}>
              {loading ? 'Verifying OTP...' : 'Verify OTP'}
            </button>
            <div className="gkof-switch" style={{ marginTop: '12px' }}>
              Didn't receive code? <a onClick={() => handleSendEmail()}>Resend OTP</a>
            </div>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handleResetPassword}>
            <p className="gkof-modal-desc">
              OTP verified! Enter and confirm a new password for Faculty Advisor ID <strong>{facultyId}</strong>.
            </p>
            <div className="gkof-field">
              <label>New Password</label>
              <PasswordInput
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="gkof-field">
              <label>Confirm New Password</label>
              <PasswordInput
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button className="gkof-btn wide teal" type="submit" disabled={loading}>
              {loading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
            <h3 style={{ margin: '0 0 8px', color: 'var(--teal)', fontSize: '18px' }}>
              Password Reset Successfully!
            </h3>
            <p className="gkof-modal-desc" style={{ marginBottom: '20px' }}>
              The password for Faculty Advisor account <strong>{facultyId}</strong> has been updated. You can now log in with your new credentials.
            </p>
            <button className="gkof-btn wide maroon" onClick={handleClose}>
              Back to Faculty Advisor Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}



