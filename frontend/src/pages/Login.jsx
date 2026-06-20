import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login }                   = useAuth();
  const [form,    setForm]          = useState({ username: '', password: '' });
  const [error,   setError]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [visible, setVisible]       = useState(false);
  const [mounted, setMounted]       = useState(false);

  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(form.username, form.password);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid username or password.');
      setLoading(false);
    }
  };

  // FIX: passwords now match what the backend actually expects
  const fillDemo = (role) => {
    if (role === 'admin')   setForm({ username: 'admin',   password: 'Admin@123'   });
    if (role === 'analyst') setForm({ username: 'analyst', password: 'Analyst@123' });
  };

  const glowStyle = {
    position: 'absolute', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none',
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#060b14', overflow: 'hidden', position: 'relative',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>

      {/* Ambient background glows */}
      <div style={{ ...glowStyle, width: 500, height: 500, top: -100, left: -150,
        backgroundColor: 'rgba(56,189,248,0.07)' }} />
      <div style={{ ...glowStyle, width: 400, height: 400, bottom: -80, right: -100,
        backgroundColor: 'rgba(167,139,250,0.06)' }} />
      <div style={{ ...glowStyle, width: 300, height: 300, top: '40%', left: '60%',
        backgroundColor: 'rgba(239,68,68,0.04)' }} />

      {/* Subtle grid overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(rgba(56,189,248,0.03) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(56,189,248,0.03) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }} />

      {/* Main card */}
      <div style={{
        width: '100%', maxWidth: 440, padding: '0 1.25rem', position: 'relative', zIndex: 1,
        opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>

        {/* Logo section */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          {/* Animated shield */}
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: '0 auto 1rem',
            background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(167,139,250,0.1))',
            border: '1px solid rgba(56,189,248,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem',
            boxShadow: '0 0 30px rgba(56,189,248,0.12), 0 0 60px rgba(56,189,248,0.06)',
          }}>
            🛡️
          </div>
          <h1 style={{
            margin: '0 0 6px', color: '#f8fafc', fontSize: '1.6rem', fontWeight: 700,
            letterSpacing: '-0.02em',
          }}>
            SOC Real-Time SIEM
          </h1>
          <p style={{ margin: 0, color: '#475569', fontSize: '0.85rem', letterSpacing: '0.02em' }}>
            Offline Security Operations Center
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'linear-gradient(145deg, rgba(15,23,42,0.95), rgba(10,18,35,0.98))',
          border: '1px solid rgba(51,65,85,0.5)',
          borderRadius: 16,
          padding: '2rem',
          boxShadow: '0 32px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03) inset',
          backdropFilter: 'blur(20px)',
        }}>

          <div style={{
            color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase',
            letterSpacing: '0.12em', textAlign: 'center', marginBottom: '1.75rem', fontWeight: 600,
          }}>
            Sign In to Continue
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            {/* Username */}
            <div>
              <label style={{
                display: 'block', color: '#64748b', fontSize: '0.72rem',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600,
              }}>Username</label>
              <input
                type="text" required autoFocus
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                placeholder="Enter username"
                style={{
                  width: '100%', padding: '11px 14px', fontSize: '0.9rem', boxSizing: 'border-box',
                  background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)',
                  borderRadius: 10, color: '#f8fafc', outline: 'none',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(56,189,248,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(56,189,248,0.08)'; }}
                onBlur={e  => { e.target.style.borderColor = 'rgba(51,65,85,0.6)';   e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block', color: '#64748b', fontSize: '0.72rem',
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontWeight: 600,
              }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={visible ? 'text' : 'password'} required
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Enter password"
                  style={{
                    width: '100%', padding: '11px 42px 11px 14px', fontSize: '0.9rem', boxSizing: 'border-box',
                    background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(51,65,85,0.6)',
                    borderRadius: 10, color: '#f8fafc', outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(56,189,248,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(56,189,248,0.08)'; }}
                  onBlur={e  => { e.target.style.borderColor = 'rgba(51,65,85,0.6)';   e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setVisible(v => !v)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#475569', fontSize: '0.85rem', padding: 0,
                }}>
                  {visible ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '10px 14px', color: '#fca5a5', fontSize: '0.82rem',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span>⚠</span> {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px', borderRadius: 10, border: 'none',
              background: loading
                ? 'rgba(30,41,59,0.8)'
                : 'linear-gradient(135deg, #38bdf8, #0ea5e9)',
              color: loading ? '#475569' : '#0f172a',
              fontWeight: 700, fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', marginTop: 4,
              boxShadow: loading ? 'none' : '0 4px 15px rgba(56,189,248,0.3)',
            }}
            onMouseEnter={e => { if (!loading) e.target.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{
                    width: 14, height: 14, border: '2px solid #475569',
                    borderTopColor: '#94a3b8', borderRadius: '50%',
                    display: 'inline-block', animation: 'spin 0.8s linear infinite',
                  }} />
                  Authenticating…
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Demo credentials */}
          <div style={{ marginTop: '1.75rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(51,65,85,0.35)' }}>
            <div style={{
              color: '#334155', fontSize: '0.7rem', textTransform: 'uppercase',
              letterSpacing: '0.1em', textAlign: 'center', marginBottom: 12, fontWeight: 600,
            }}>
              Demo Credentials
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button onClick={() => fillDemo('admin')} style={{
                padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontSize: '0.8rem',
                background: 'rgba(167,139,250,0.06)', color: '#a78bfa',
                border: '1px solid rgba(167,139,250,0.2)', fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.background = 'rgba(167,139,250,0.12)'; e.target.style.borderColor = 'rgba(167,139,250,0.4)'; }}
              onMouseLeave={e => { e.target.style.background = 'rgba(167,139,250,0.06)'; e.target.style.borderColor = 'rgba(167,139,250,0.2)'; }}
              >
                👑 SOC Admin
              </button>
              <button onClick={() => fillDemo('analyst')} style={{
                padding: '10px 8px', borderRadius: 10, cursor: 'pointer', fontSize: '0.8rem',
                background: 'rgba(56,189,248,0.06)', color: '#38bdf8',
                border: '1px solid rgba(56,189,248,0.2)', fontWeight: 600,
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.background = 'rgba(56,189,248,0.12)'; e.target.style.borderColor = 'rgba(56,189,248,0.4)'; }}
              onMouseLeave={e => { e.target.style.background = 'rgba(56,189,248,0.06)'; e.target.style.borderColor = 'rgba(56,189,248,0.2)'; }}
              >
                🔍 L1 Analyst
              </button>
            </div>
            <p style={{ color: '#1e293b', fontSize: '0.7rem', textAlign: 'center', margin: '10px 0 0', lineHeight: 1.5 }}>
              Click a role to auto-fill credentials, then click Sign In
            </p>
          </div>
        </div>

        {/* Version tag */}
        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: '#1e293b', fontSize: '0.7rem' }}>
          SOC SIEM v5 · Offline Mode · All data stays on your machine
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: #334155; }
      `}</style>
    </div>
  );
}
