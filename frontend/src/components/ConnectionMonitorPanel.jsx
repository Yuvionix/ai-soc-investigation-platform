/**
 * ConnectionMonitorPanel
 * =======================
 * Shows WebSocket connection state, live event counters,
 * severity filter selector, and auto-refresh graphs for
 * events-per-minute rate.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const STATUS_STYLES = {
  connected:    { color: '#22c55e', label: 'CONNECTED',    dot: '#22c55e', glow: '0 0 8px #22c55e' },
  connecting:   { color: '#eab308', label: 'CONNECTING…',  dot: '#eab308', glow: '0 0 8px #eab308' },
  disconnected: { color: '#ef4444', label: 'DISCONNECTED', dot: '#ef4444', glow: '0 0 8px #ef4444' },
};

function StatBadge({ label, value, color = '#38bdf8' }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color, fontSize: '1.5rem', fontWeight: 700, fontFamily: 'monospace' }}>
        {value.toLocaleString()}
      </div>
      <div style={{ color: '#475569', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
    </div>
  );
}

export default function ConnectionMonitorPanel({
  connectionStatus = 'disconnected',
  streamLogs = [],
  streamPackets = [],
  streamThreats = [],
  setFilter,
}) {
  const [rateHistory, setRateHistory] = useState(
    Array.from({ length: 30 }, (_, i) => ({ t: i, logs: 0, packets: 0, threats: 0 }))
  );
  const prevCounts = useRef({ logs: 0, packets: 0, threats: 0 });
  const [activeSevFilter, setActiveSevFilter] = useState('');

  // Build events-per-5s rate chart
  useEffect(() => {
    const interval = setInterval(() => {
      const dl = streamLogs.length    - prevCounts.current.logs;
      const dp = streamPackets.length - prevCounts.current.packets;
      const dt = streamThreats.length - prevCounts.current.threats;
      prevCounts.current = { logs: streamLogs.length, packets: streamPackets.length, threats: streamThreats.length };

      setRateHistory(prev => {
        const next = [...prev.slice(1), {
          t:       prev[prev.length - 1].t + 1,
          logs:    Math.max(0, dl),
          packets: Math.max(0, dp),
          threats: Math.max(0, dt),
        }];
        return next;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [streamLogs.length, streamPackets.length, streamThreats.length]);

  const ss = STATUS_STYLES[connectionStatus] || STATUS_STYLES.disconnected;

  const handleFilterChange = (sev) => {
    setActiveSevFilter(sev);
    if (setFilter) setFilter(sev || null);
  };

  return (
    <div style={{
      backgroundColor: '#0f172a',
      border: '1px solid rgba(51,65,85,0.5)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        borderBottom: '1px solid rgba(51,65,85,0.4)',
        background: 'rgba(15,23,42,0.8)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            backgroundColor: ss.dot, boxShadow: ss.glow,
          }} />
          <span style={{ color: ss.color, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.06em' }}>
            {ss.label}
          </span>
        </div>
        <span style={{ color: '#475569', fontSize: '0.75rem' }}>Real-Time Stream</span>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        padding: '12px 16px', gap: 8,
        borderBottom: '1px solid rgba(30,41,59,0.6)',
      }}>
        <StatBadge label="Log Events"    value={streamLogs.length}    color="#38bdf8" />
        <StatBadge label="Packets"       value={streamPackets.length} color="#a78bfa" />
        <StatBadge label="Threats"       value={streamThreats.length} color="#ef4444" />
      </div>

      {/* Filter buttons */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(30,41,59,0.6)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ color: '#475569', fontSize: '0.72rem', alignSelf: 'center', marginRight: 4 }}>Filter:</span>
        {['', 'info', 'warning', 'error', 'critical'].map(sev => (
          <button
            key={sev}
            onClick={() => handleFilterChange(sev)}
            style={{
              fontSize: '0.7rem', padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
              backgroundColor: activeSevFilter === sev ? 'rgba(56,189,248,0.15)' : 'transparent',
              color: activeSevFilter === sev ? '#38bdf8' : '#64748b',
              border: `1px solid ${activeSevFilter === sev ? 'rgba(56,189,248,0.4)' : '#1e293b'}`,
              transition: 'all 0.15s',
            }}
          >
            {sev || 'All'}
          </button>
        ))}
      </div>

      {/* Events/5s chart */}
      <div style={{ padding: '8px 0 4px' }}>
        <div style={{ color: '#334155', fontSize: '0.7rem', textTransform: 'uppercase', padding: '0 16px 4px', letterSpacing: '0.06em' }}>
          Events / 5s
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart data={rateHistory} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="gLogs"    x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gPackets" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gThreats" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="t" hide />
            <YAxis tick={{ fontSize: 9, fill: '#334155' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 6, fontSize: '0.72rem' }}
              labelStyle={{ display: 'none' }}
            />
            <Area type="monotone" dataKey="logs"    stroke="#38bdf8" fill="url(#gLogs)"    strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="packets" stroke="#a78bfa" fill="url(#gPackets)" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="threats" stroke="#ef4444" fill="url(#gThreats)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
