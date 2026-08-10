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
    throw new Error(result.message || 'API request failed');
  }
  return result;
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState(null);
  const [requests, setRequests] = useState([]);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const token = localStorage.getItem('gkof_token');
      if (token) {
        try {
          const res = await apiFetch('/api/auth/me');
          setSession(res.user);
          await fetchRequestsForUser(res.user);
        } catch (e) {
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

  async function fetchRequestsForUser(user) {
    if (!user) return;
    try {
      const endpoint = user.role === 'staff' ? '/api/requests/staff' : '/api/requests/student';
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

  const handleSaveProfileAddress = async (homeAddress, department) => {
    try {
      const payload = {};
      if (homeAddress !== undefined) payload.homeAddress = homeAddress;
      if (department !== undefined) payload.department = department;
      const res = await apiFetch('/api/users/profile', 'PUT', payload);
      setSession(res.user);
    } catch (err) {
      alert(err.message || 'Failed to save profile');
    }
  };

  const handleSubmitRequest = async (reqData) => {
    try {
      await apiFetch('/api/requests', 'POST', reqData);
      await fetchRequestsForUser(session);
    } catch (err) {
      alert(err.message || 'Failed to submit request');
    }
  };

  const handleAction = async (id, act) => {
    try {
      await apiFetch(`/api/requests/${id}/action`, 'PATCH', { action: act });
      await fetchRequestsForUser(session);
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  };

  const handleShareLocation = async (id, lat, lng) => {
    try {
      await apiFetch(`/api/requests/${id}/location`, 'PATCH', { lat, lng });
      await fetchRequestsForUser(session);
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
              onClick={() => setCurrentTab('dashboard')}
            >
              Dashboard
            </div>
            <div
              className={`gkof-tab ${currentTab === 'profile' ? 'active' : ''}`}
              onClick={() => setCurrentTab('profile')}
            >
              Profile
            </div>
          </div>

          <div className="gkof-content-pad">
            {session.role === 'staff' ? (
              currentTab === 'profile' ? (
                <StaffProfile session={session} onLogout={handleLogout} />
              ) : (
                <StaffDashboard requests={requests} onAction={handleAction} />
              )
            ) : currentTab === 'profile' ? (
              <StudentProfile session={session} onSaveAddress={handleSaveProfileAddress} onLogout={handleLogout} />
            ) : (
              <StudentDashboard
                session={session}
                requests={requests}
                onSubmitRequest={handleSubmitRequest}
                onAction={handleAction}
                onSaveProfileAddress={handleSaveProfileAddress}
                onShareLocation={handleShareLocation}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
