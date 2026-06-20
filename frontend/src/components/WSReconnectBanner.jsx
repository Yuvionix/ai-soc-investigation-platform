/**
 * WSReconnectBanner
 * ==================
 * Shows a visible banner when WebSocket reconnects after a disconnect,
 * informing the analyst they may have missed events.
 */
import React, { useEffect, useRef, useState } from 'react';

export default function WSReconnectBanner({ connectionStatus }) {
  const [show, setShow] = useState(false);
  const [missedCount, setMissedCount] = useState(0);
  const prevStatus = useRef(connectionStatus);
  const disconnectTime = useRef(null);

  useEffect(() => {
    const prev = prevStatus.current;
    const curr = connectionStatus;

    if (prev === 'connected' && curr === 'disconnected') {
      disconnectTime.current = Date.now();
    }

    if (prev === 'disconnected' && curr === 'connected' && disconnectTime.current) {
      const downSecs = Math.round((Date.now() - disconnectTime.current) / 1000);
      // Estimate missed events: ~3 events/sec average
      const estimated = Math.max(1, Math.round(downSecs * 3));
      setMissedCount(estimated);
      setShow(true);
      disconnectTime.current = null;
      // Auto-dismiss after 8 seconds
      setTimeout(() => setShow(false), 8000);
    }

    prevStatus.current = curr;
  }, [connectionStatus]);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 70,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9998,
      backgroundColor: '#0f172a',
      border: '1px solid rgba(234,179,8,0.5)',
      borderRadius: 8,
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      boxShadow: '0 0 20px rgba(234,179,8,0.15)',
      animation: 'slideDown 0.3s ease-out',
    }}>
      <style>{`
        @keyframes slideDown {
          from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
          to   { transform: translateX(-50%) translateY(0);     opacity: 1; }
        }
      `}</style>
      <span style={{ fontSize: '1rem' }}>⚡</span>
      <div>
        <span style={{ color: '#eab308', fontWeight: 700, fontSize: '0.85rem' }}>
          Stream Reconnected
        </span>
        <span style={{ color: '#94a3b8', fontSize: '0.82rem', marginLeft: 8 }}>
          You may have missed ~{missedCount} events while disconnected
        </span>
      </div>
      <button
        onClick={() => setShow(false)}
        style={{
          background: 'none', border: 'none', color: '#475569',
          cursor: 'pointer', fontSize: '1rem', padding: '0 4px',
          marginLeft: 8,
        }}
      >✕</button>
    </div>
  );
}
