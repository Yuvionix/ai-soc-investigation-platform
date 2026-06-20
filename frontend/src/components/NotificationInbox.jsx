/**
 * NotificationInbox
 * ==================
 * Persistent notification bell that accumulates unread alerts/threats.
 * Threats don't disappear after 5s — they stay in the inbox until dismissed.
 */
import React, { useState, useEffect, useRef } from 'react';

const SEV_COLORS = {
  critical: '#ef4444', error: '#f97316', high: '#f97316',
  warning: '#eab308', medium: '#eab308', info: '#38bdf8', low: '#22c55e',
};

export default function NotificationInbox({ streamThreats, streamLogs }) {
  const [open,        setOpen]        = useState(false);
  const [inbox,       setInbox]       = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const prevThreats = useRef(0);
  const prevCritical = useRef(0);
  const panelRef = useRef(null);

  // Add new threats to inbox
  useEffect(() => {
    if (streamThreats.length > prevThreats.current) {
      const newOnes = streamThreats.slice(0, streamThreats.length - prevThreats.current);
      setInbox(prev => [
        ...newOnes.map(t => ({ ...t, _key: Math.random(), read: false, inboxTime: new Date() })),
        ...prev,
      ].slice(0, 100));
      setUnreadCount(c => c + newOnes.length);
    }
    prevThreats.current = streamThreats.length;
  }, [streamThreats.length]);

  // Also add critical log events to inbox
  useEffect(() => {
    const critical = streamLogs.filter(l => l.severity === 'critical');
    if (critical.length > prevCritical.current) {
      const newOnes = critical.slice(0, critical.length - prevCritical.current);
      setInbox(prev => [
        ...newOnes.map(l => ({ ...l, _key: Math.random(), read: false, inboxTime: new Date() })),
        ...prev,
      ].slice(0, 100));
      setUnreadCount(c => c + newOnes.length);
    }
    prevCritical.current = critical.length;
  }, [streamLogs]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = () => {
    setInbox(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const dismiss = (key) => setInbox(prev => prev.filter(n => n._key !== key));
  const clearAll = () => { setInbox([]); setUnreadCount(0); };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) { setUnreadCount(0); setInbox(p => p.map(n=>({...n,read:true}))); } }}
        style={{
          position: 'relative', background: 'none', border: '1px solid rgba(51,65,85,0.5)',
          borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#94a3b8',
          backgroundColor: open ? 'rgba(56,189,248,0.08)' : 'transparent',
          transition: 'all 0.15s',
        }}
        title="Notification Inbox"
      >
        🔔
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18,
            borderRadius: 9, backgroundColor: '#ef4444', color: '#fff',
            fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '0 4px',
            boxShadow: '0 0 8px rgba(239,68,68,0.5)',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Inbox panel */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          width: 360, maxHeight: 480, backgroundColor: '#0f172a',
          border: '1px solid rgba(51,65,85,0.6)', borderRadius: 10,
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)', zIndex: 9997,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'slideDown 0.2s ease-out',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px', borderBottom: '1px solid rgba(51,65,85,0.4)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'rgba(15,23,42,0.9)',
          }}>
            <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.85rem' }}>
              🔔 Notifications ({inbox.length})
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={markAllRead} style={{ fontSize:'0.7rem', color:'#38bdf8', background:'none',
                border:'none', cursor:'pointer', padding:'2px 6px' }}>
                Mark all read
              </button>
              <button onClick={clearAll} style={{ fontSize:'0.7rem', color:'#64748b', background:'none',
                border:'none', cursor:'pointer', padding:'2px 6px' }}>
                Clear
              </button>
            </div>
          </div>

          {/* Items */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {inbox.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#334155', fontSize: '0.82rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>✅</div>
                No new notifications
              </div>
            ) : inbox.map(item => {
              const color = SEV_COLORS[item.severity] || '#94a3b8';
              return (
                <div key={item._key} style={{
                  padding: '10px 14px', borderBottom: '1px solid rgba(30,41,59,0.5)',
                  backgroundColor: item.read ? 'transparent' : `${color}06`,
                  borderLeft: `3px solid ${item.read ? 'transparent' : color}`,
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ color, fontSize: '0.72rem', fontWeight: 700,
                                  textTransform: 'uppercase', marginBottom: 3 }}>
                      {(item.threat_type || item.severity || '').replace(/_/g,' ')}
                    </div>
                    <div style={{ color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.4 }}>
                      {(item.message || '').slice(0, 90)}{item.message?.length > 90 ? '…' : ''}
                    </div>
                    {item.ip_address && (
                      <div style={{ color: '#475569', fontSize: '0.68rem', marginTop: 3, fontFamily: 'monospace' }}>
                        {item.ip_address} · {item.inboxTime?.toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                  <button onClick={() => dismiss(item._key)}
                    style={{ background:'none', border:'none', color:'#334155',
                             cursor:'pointer', fontSize:'0.9rem', padding:'0 2px', flexShrink:0 }}>
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
