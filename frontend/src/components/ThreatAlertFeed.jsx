/**
 * ThreatAlertFeed
 * ================
 * Shows real-time detected threats as:
 *  1. Animated toast notification (top-right, auto-dismisses after 5 s)
 *  2. Scrolling threat feed panel with severity animations
 */

import React, { useEffect, useRef, useState } from 'react';

const SEVERITY_STYLES = {
  critical: {
    border:  'rgba(239,68,68,0.6)',
    bg:      'rgba(239,68,68,0.08)',
    icon:    '🔴',
    glow:    '0 0 20px rgba(239,68,68,0.3)',
    pulse:   '#ef4444',
  },
  error: {
    border:  'rgba(249,115,22,0.5)',
    bg:      'rgba(249,115,22,0.07)',
    icon:    '🟠',
    glow:    '0 0 15px rgba(249,115,22,0.2)',
    pulse:   '#f97316',
  },
  warning: {
    border:  'rgba(234,179,8,0.5)',
    bg:      'rgba(234,179,8,0.06)',
    icon:    '🟡',
    glow:    '0 0 12px rgba(234,179,8,0.15)',
    pulse:   '#eab308',
  },
  info: {
    border:  'rgba(56,189,248,0.4)',
    bg:      'rgba(56,189,248,0.05)',
    icon:    '🔵',
    glow:    'none',
    pulse:   '#38bdf8',
  },
};

function getSev(s = 'info') {
  return SEVERITY_STYLES[s.toLowerCase()] || SEVERITY_STYLES.info;
}

// ── Toast notification ────────────────────────────────────────────────────────
function Toast({ threat, onDismiss }) {
  const sev = getSev(threat.severity);
  useEffect(() => {
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      style={{
        backgroundColor: '#0f172a',
        border: `1px solid ${sev.border}`,
        boxShadow: sev.glow,
        borderRadius: 10,
        padding: '12px 18px',
        minWidth: 320,
        maxWidth: 420,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        animation: 'slideInRight 0.3s ease-out',
        cursor: 'pointer',
      }}
      onClick={onDismiss}
    >
      <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{sev.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: sev.pulse, fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
          {(threat.threat_type || threat.severity || '').replace(/_/g, ' ')}
        </div>
        <div style={{ color: '#cbd5e1', fontSize: '0.8rem', lineHeight: 1.4 }}>
          {threat.message}
        </div>
        {threat.ip_address && (
          <div style={{ color: '#64748b', fontSize: '0.72rem', marginTop: 4, fontFamily: 'monospace' }}>
            IP: {threat.ip_address}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Toast container ───────────────────────────────────────────────────────────
export function ThreatToastContainer({ threats }) {
  const [visible, setVisible] = useState([]);
  const prevLen = useRef(0);

  useEffect(() => {
    if (threats.length > prevLen.current) {
      const newThreats = threats.slice(0, threats.length - prevLen.current);
      setVisible(v => [...newThreats.map(t => ({ ...t, _key: Math.random() })), ...v].slice(0, 5));
    }
    prevLen.current = threats.length;
  }, [threats]);

  const dismiss = (key) => setVisible(v => v.filter(t => t._key !== key));

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
      <div style={{
        position: 'fixed', top: 80, right: 20,
        display: 'flex', flexDirection: 'column', gap: 10,
        zIndex: 9999, pointerEvents: 'none',
      }}>
        {visible.map(t => (
          <div key={t._key} style={{ pointerEvents: 'all' }}>
            <Toast threat={t} onDismiss={() => dismiss(t._key)} />
          </div>
        ))}
      </div>
    </>
  );
}

// ── Threat feed panel ─────────────────────────────────────────────────────────
export function ThreatFeedPanel({ threats = [] }) {
  return (
    <div style={{
      backgroundColor: '#0a0e1a',
      border: '1px solid rgba(239,68,68,0.2)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 14px',
        background: 'rgba(15,23,42,0.9)',
        borderBottom: '1px solid rgba(51,65,85,0.5)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          backgroundColor: '#ef4444',
          display: 'inline-block',
          boxShadow: '0 0 8px #ef4444',
          animation: 'pulse-dot 1.5s ease-in-out infinite',
        }} />
        <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
          Real-Time Attack Feed
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: '0.7rem', padding: '1px 7px',
          borderRadius: 10, backgroundColor: 'rgba(239,68,68,0.12)',
          color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)',
        }}>
          {threats.length} threats
        </span>
      </div>

      <div style={{ maxHeight: 360, overflowY: 'auto', padding: '6px 0' }}>
        {threats.length === 0 ? (
          <div style={{ color: '#1e293b', padding: '1.5rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.8rem' }}>
            No threats detected…
          </div>
        ) : (
          threats.slice(0, 50).map((threat, idx) => {
            const sev = getSev(threat.severity);
            return (
              <div
                key={threat.id || idx}
                style={{
                  padding: '10px 14px',
                  backgroundColor: idx === 0 ? sev.bg : 'transparent',
                  borderLeft: `3px solid ${idx === 0 ? sev.pulse : '#1e293b'}`,
                  borderBottom: '1px solid rgba(30,41,59,0.5)',
                  transition: 'all 0.5s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.85rem' }}>{sev.icon}</span>
                    <span style={{ color: sev.pulse, fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      {(threat.threat_type || threat.severity || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span style={{ color: '#475569', fontSize: '0.7rem', fontFamily: 'monospace' }}>
                    {new Date(threat.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.78rem', lineHeight: 1.4 }}>
                  {threat.message}
                </div>
                {threat.ip_address && (
                  <div style={{ color: '#475569', fontSize: '0.7rem', marginTop: 4, fontFamily: 'monospace' }}>
                    ↳ {threat.ip_address}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
