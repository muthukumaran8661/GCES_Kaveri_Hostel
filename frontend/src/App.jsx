import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Auth from './components/Auth';
import StudentDashboard from './components/StudentDashboard';
import StaffDashboard from './components/StaffDashboard';
import StaffProfile from './components/StaffProfile';
import StudentProfile from './components/StudentProfile';

// In dev mode, Vite proxy forwards /api to backend. In production, configure accordingly.
const API_BASE_URL = '';

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
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const res = await fetch(url, config);
  const result = await res.json();
  if (!res.ok) {
    const error = new Error(result.message || 'API request failed');
    error.status = res.status;
    error.remainingSeconds = result.remainingSeconds;
    throw error;
  }
  return result;
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState(null);
  const [requests, setRequests] = useState([]);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [authError, setAuthError] = useState('');

  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('gkof_theme') || 'system';
  });

  // Apply Theme Effect
  useEffect(() => {
    const applyTheme = () => {
      let isDark = false;
      if (themeMode === 'dark') {
        isDark = true;
      } else if (themeMode === 'light') {
        isDark = false;
      } else if (themeMode === 'system') {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }

      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    };

    applyTheme();

    if (themeMode === 'system' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme();
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [themeMode]);

  const handleThemeChange = (newTheme) => {
    setThemeMode(newTheme);
    localStorage.setItem('gkof_theme', newTheme);
  };

  // Global Backspace Key Navigation Prevention
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Backspace' || e.keyCode === 8) {
        const active = document.activeElement;
        if (!active) {
          e.preventDefault();
          return;
        }

        const tagName = active.tagName ? active.tagName.toUpperCase() : '';
        const isContentEditable = active.isContentEditable || active.getAttribute('contenteditable') === 'true';
        const nonTextInputTypes = ['CHECKBOX', 'RADIO', 'SUBMIT', 'BUTTON', 'RESET', 'FILE', 'IMAGE', 'COLOR', 'RANGE'];
        const inputType = active.type ? active.type.toUpperCase() : '';

        const isTextInput = (tagName === 'INPUT' && !nonTextInputTypes.includes(inputType)) || tagName === 'TEXTAREA';
        const isEditable = (isTextInput || isContentEditable) && !active.readOnly && !active.disabled;

        if (!isEditable) {
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    loadAll();
  }, []);

  async function refreshSession() {
    try {
      const token = localStorage.getItem('gkof_token');
      if (token) {
        const res = await apiFetch('/api/auth/me');
        if (res && res.user) {
          setSession(res.user);
          return res.user;
        }
      }
    } catch (e) {
      console.error('refreshSession error:', e);
    }
    return null;
  }

  async function loadAll() {
    try {
      const token = localStorage.getItem('gkof_token');
      if (token) {
        try {
          const res = await apiFetch('/api/auth/me');
          setSession(res.user);
          await fetchRequestsForUser(res.user);
        } catch (e) {
          console.warn('Session verification failed, logging out:', e);
          localStorage.removeItem('gkof_token');
          setSession(null);
        }
      }
    } catch (e) {
      console.error('loadAll error:', e);
    } finally {
      setLoaded(true);
    }
  }

  async function refreshData() {
    const latestUser = await refreshSession();
    const currentUser = latestUser || session;
    if (currentUser) {
      await fetchRequestsForUser(currentUser);
    }
  }

  async function fetchRequestsForUser(user) {
    if (!user) return;
    try {
      let endpoint = '/api/requests/student';
      if (user.role === 'faculty') {
        endpoint = '/api/requests/faculty';
      } else if (user.role === 'staff' || user.role === 'admin') {
        endpoint = '/api/requests/warden';
      }
      const res = await apiFetch(endpoint);
      setRequests(res.requests || []);
    } catch (e) {
      console.error('fetchRequests error:', e);
      setRequests([]);
    }
  }

  const handleLogin = async ({ role, username, password }) => {
    try {
      const res = await apiFetch('/api/auth/login', 'POST', { role, username, password });
      localStorage.setItem('gkof_token', res.token);
      setSession(res.user);
      setCurrentTab('dashboard');
      await fetchRequestsForUser(res.user);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleSignup = async (payload) => {
    try {
      const res = await apiFetch('/api/auth/signup', 'POST', payload);
      localStorage.setItem('gkof_token', res.token);
      setSession(res.user);
      setCurrentTab('dashboard');
      await fetchRequestsForUser(res.user);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('gkof_token');
    setSession(null);
    setRequests([]);
    setCurrentTab('dashboard');
    setAuthError('');
  };

  const handleSaveProfileAddress = async (homeAddress, department, year) => {
    try {
      const payload = {};
      if (homeAddress !== undefined) payload.homeAddress = homeAddress;
      if (session && session.role !== 'student') {
        if (department !== undefined) payload.department = department;
        if (year !== undefined) payload.year = year;
      }
      const res = await apiFetch('/api/users/profile', 'PUT', payload);
      setSession(res.user);
    } catch (err) {
      alert(err.message || 'Failed to save profile');
    }
  };

  const handleUpdateYear = async (newYear) => {
    try {
      const res = await apiFetch('/api/users/profile', 'PUT', { year: newYear });
      if (res && res.user) {
        setSession(res.user);
      }
      return res;
    } catch (err) {
      console.error('Update year error:', err);
      alert(err.message || 'Failed to update Year');
      throw err;
    }
  };

  const handleSubmitRequest = async (reqData) => {
    try {
      const res = await apiFetch('/api/requests', 'POST', reqData);
      await refreshData();
      return res;
    } catch (err) {
      console.error('Submit request error:', err);
      throw err;
    }
  };

  const handleAction = async (id, act) => {
    try {
      await apiFetch(`/api/requests/${id}/action`, 'PATCH', { action: act });
      await refreshData();
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  };

  const handleShareLocation = async (id, lat, lng) => {
    try {
      await apiFetch(`/api/requests/${id}/location`, 'PATCH', { lat, lng });
      await refreshData();
    } catch (err) {
      alert(err.message || 'Failed to share location');
    }
  };

  if (!loaded) {
    return (
      <div className="gkof max-w-[1000px] mx-auto mt-6">
        <Header session={null} subtitle="Government College of Engineering, Srirangam · Hostel Gate Pass" />
        <div className="gkof-empty">Loading…</div>
      </div>
    );
  }

  const isStaffOrFaculty = session && ['staff', 'faculty', 'admin'].includes(session.role);
  const isAdminOrWarden = session && (session.role === 'staff' || session.role === 'admin');

  return (
    <div className="gkof max-w-[1000px] mx-auto">
      <Header
        session={session}
        onLogout={handleLogout}
        subtitle="Government College of Engineering, Srirangam · Hostel Gate Pass"
      />

      {!session ? (
        <Auth
          onLogin={handleLogin}
          onSignup={handleSignup}
          error={authError}
          setError={setAuthError}
        />
      ) : (
        <>
          <div className="gkof-tabs">
            <div
              className={`gkof-tab ${currentTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => { setCurrentTab('dashboard'); refreshData(); }}
            >
              Dashboard
            </div>
            <div
              className={`gkof-tab ${currentTab === 'profile' ? 'active' : ''}`}
              onClick={() => { setCurrentTab('profile'); refreshData(); }}
            >
              Profile
            </div>
            {isAdminOrWarden && (
              <div
                className={`gkof-tab ${currentTab === 'admin' ? 'active' : ''}`}
                onClick={() => { setCurrentTab('admin'); refreshData(); }}
              >
                ⚙️ Admin Control
              </div>
            )}
          </div>

          <div className="gkof-content-pad">
            {isStaffOrFaculty ? (
              currentTab === 'profile' ? (
                <StaffProfile session={session} onLogout={handleLogout} themeMode={themeMode} onThemeChange={handleThemeChange} />
              ) : (
                <StaffDashboard
                  session={session}
                  requests={requests}
                  onAction={handleAction}
                  onRefreshUsers={refreshData}
                  activeTab={currentTab}
                  onNavigateTab={(tab) => { setCurrentTab(tab); refreshData(); }}
                />
              )
            ) : currentTab === 'profile' ? (
              <StudentProfile
                session={session}
                onUpdateYear={handleUpdateYear}
                onSaveAddress={handleSaveProfileAddress}
                onLogout={handleLogout}
                themeMode={themeMode}
                onThemeChange={handleThemeChange}
              />
            ) : (
              <StudentDashboard
                session={session}
                requests={requests}
                onSubmitRequest={handleSubmitRequest}
                onAction={handleAction}
                onSaveProfileAddress={handleSaveProfileAddress}
                activeTab={currentTab}
                onNavigateTab={(tab) => { setCurrentTab(tab); refreshData(); }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
