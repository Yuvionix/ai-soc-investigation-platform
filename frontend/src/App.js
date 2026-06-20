import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Dashboard  from './pages/Dashboard';
import ReplayMode from './pages/ReplayMode';
import AIInvestigationCenter from './pages/ai/AIInvestigationCenter';
import Login      from './pages/Login';
import NotificationInbox from './components/NotificationInbox';
import { useRealtimeStream } from './hooks/useRealtimeStream';
import './App.css';

// ── Protected route wrapper ───────────────────────────────────────────────────
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      backgroundColor:'#060b14', flexDirection:'column', gap:16,
    }}>
      <div style={{
        width:40, height:40, border:'2px solid rgba(56,189,248,0.2)',
        borderTopColor:'#38bdf8', borderRadius:'50%',
        animation:'spin 0.8s linear infinite',
      }}/>
      <div style={{ color:'#475569', fontSize:'0.82rem' }}>Authenticating…</div>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}' }</style>
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

// ── App shell with nav ────────────────────────────────────────────────────────
function AppShell() {
  // Clear stale tokens from old versions
  useEffect(() => {
    const V = 'soc_v5';
    if (localStorage.getItem('soc_version') !== V) {
      localStorage.removeItem('soc_token');
      localStorage.removeItem('soc_user');
      localStorage.setItem('soc_version', V);
    }
  }, []);
  const { user, logout }  = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('soc_theme') || 'dark');
  const { streamThreats, streamLogs } = useRealtimeStream();

  // Theme toggle
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('soc_theme', theme);
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '1' && !e.ctrlKey) window.location.href = '/';
      if (e.key === '2' && !e.ctrlKey) window.location.href = '/replay';
      if (e.key === '3' && !e.ctrlKey) window.location.href = '/ai';
      if (e.key === 't' && !e.ctrlKey) setTheme(p => p === 'dark' ? 'light' : 'dark');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="App" data-theme={theme}>
      {user && (
        <header className="App-header">
          <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
            <span style={{ fontSize:'1.2rem' }}>🛡️</span>
            <h1>SOC Real-Time SIEM</h1>
          </div>
          <nav>
            <a href="/"      className={window.location.pathname==='/'       ? 'active':''}>Dashboard</a>
            <a href="/replay" className={window.location.pathname==='/replay' ? 'active':''}>Attack Replay</a>
            <a href="/ai" className={window.location.pathname.startsWith('/ai') ? 'active':''} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span>🧠</span> AI Investigate
            </a>
          </nav>
          <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
            {/* Notification inbox */}
            <NotificationInbox streamThreats={streamThreats} streamLogs={streamLogs} />

            {/* Theme toggle */}
            <button onClick={() => setTheme(p => p==='dark'?'light':'dark')}
              title="Toggle theme (T)" style={{
                background:'none', border:'1px solid rgba(51,65,85,0.5)',
                borderRadius:8, padding:'6px 10px', cursor:'pointer',
                color:'#94a3b8', fontSize:'0.9rem',
              }}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* User badge + logout */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:'0.78rem', color:'#64748b' }}>
                {user.name}
              </span>
              <span style={{
                fontSize:'0.68rem', padding:'2px 8px', borderRadius:8,
                backgroundColor: user.role==='Admin' ? 'rgba(167,139,250,0.12)' : 'rgba(56,189,248,0.1)',
                color: user.role==='Admin' ? '#a78bfa' : '#38bdf8',
                border: `1px solid ${user.role==='Admin' ? 'rgba(167,139,250,0.3)' : 'rgba(56,189,248,0.25)'}`,
              }}>
                {user.role}
              </span>
              <button onClick={logout} style={{
                fontSize:'0.75rem', padding:'5px 10px', borderRadius:6, cursor:'pointer',
                backgroundColor:'rgba(239,68,68,0.08)', color:'#ef4444',
                border:'1px solid rgba(239,68,68,0.2)',
              }}>
                Logout
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Keyboard shortcut hint */}
      {user && (
        <div style={{ backgroundColor:'rgba(15,23,42,0.6)', borderBottom:'1px solid rgba(51,65,85,0.3)',
                      padding:'3px 2rem', display:'flex', gap:'1.5rem', flexWrap:'wrap' }}>
          {[['1','Dashboard'],['2','Attack Replay'],['T','Toggle Theme']].map(([k,l]) => (
            <span key={k} style={{ fontSize:'0.65rem', color:'#334155' }}>
              <kbd style={{ backgroundColor:'rgba(51,65,85,0.4)', color:'#64748b', padding:'0 5px',
                            borderRadius:3, border:'1px solid rgba(51,65,85,0.6)',
                            fontFamily:'monospace', fontSize:'0.65rem' }}>{k}</kbd>
              {' '}{l}
            </span>
          ))}
        </div>
      )}

      <main>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
          <Route path="/"      element={<PrivateRoute><Dashboard  /></PrivateRoute>} />
          <Route path="/replay" element={<PrivateRoute><ReplayMode /></PrivateRoute>} />
          <Route path="/ai"     element={<PrivateRoute><AIInvestigationCenter /></PrivateRoute>} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppShell />
      </Router>
    </AuthProvider>
  );
}
