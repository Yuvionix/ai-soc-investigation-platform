/**
 * LiveLogTerminal
 * ================
 * Terminal-style real-time log viewer.
 * Receives streamed log entries and renders them as a scrolling feed
 * with color-coded severity, animated new-entry highlight, and auto-scroll.
 */

import React, { useRef, useEffect, useState } from 'react';

const SEV_COLORS = {
  critical: { fg: '#ef4444', bg: 'rgba(239,68,68,0.08)',  label: 'CRIT' },
  error:    { fg: '#f97316', bg: 'rgba(249,115,22,0.08)', label: 'ERR ' },
  warning:  { fg: '#eab308', bg: 'rgba(234,179,8,0.08)',  label: 'WARN' },
  info:     { fg: '#38bdf8', bg: 'rgba(56,189,248,0.05)', label: 'INFO' },
};

function getSev(sev = 'info') {
  return SEV_COLORS[sev.toLowerCase()] || SEV_COLORS.info;
}

function LogRow({ entry, isNew }) {
  const c = getSev(entry.severity);
  return (
    <div
      style={{
        fontFamily: '"Fira Code", "Courier New", monospace',
        fontSize: '0.78rem',
        lineHeight: '1.6',
        padding: '2px 10px',
        backgroundColor: isNew ? c.bg : 'transparent',
        borderLeft: isNew ? `2px solid ${c.fg}` : '2px solid transparent',
        transition: 'background-color 1.5s ease, border-color 1.5s ease',
        display: 'flex',
        gap: '10px',
        alignItems: 'baseline',
        whiteSpace: 'pre',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      <span style={{ color: '#475569', flexShrink: 0, width: '55px' }}>
        {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour12: false })}
      </span>
      <span style={{ color: c.fg, flexShrink: 0, width: '38px', fontWeight: 700 }}>
        [{c.label}]
      </span>
      <span style={{ color: '#64748b', flexShrink: 0, width: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {(entry.source || '').padEnd(20)}
      </span>
      {entry.ip_address && (
        <span style={{ color: '#a78bfa', flexShrink: 0, width: '120px' }}>
          {entry.ip_address.padEnd(15)}
        </span>
      )}
      <span style={{ color: '#cbd5e1', flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {entry._dedupMsg || entry.message}
      </span>
    </div>
  );
}

export default function LiveLogTerminal({ logs = [], title = 'Live Host Log Stream' }) {
  const bottomRef   = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter]         = useState('');
  const [sevFilter, setSevFilter]   = useState('');
  const newestIdRef = useRef(null);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Deduplicate: collapse identical consecutive messages into one with [xN] counter
  const deduped = logs.reduce((acc, l) => {
    if (acc.length > 0 && acc[acc.length-1].message === l.message &&
        acc[acc.length-1].source === l.source) {
      const last = {...acc[acc.length-1]};
      last.count = (last.count || 1) + 1;
      last.message = l.message.replace(/^\[x\d+\] /, '') ;
      last._dedupMsg = '[x'+last.count+'] ' + last.message;
      acc[acc.length-1] = last;
      return acc;
    }
    return [...acc, {...l, count:1, _dedupMsg: l.message}];
  }, []);

  const filtered = deduped.filter(l => {
    if (sevFilter && l.severity !== sevFilter) return false;
    if (filter && !(l.message || '').toLowerCase().includes(filter.toLowerCase()) &&
                  !(l.source  || '').toLowerCase().includes(filter.toLowerCase()) &&
                  !(l.ip_address || '').includes(filter)) return false;
    return true;
  });

  // Track newest id for flash animation
  const newestId = filtered[0]?.id;

  return (
    <div style={{
      backgroundColor: '#0a0e1a',
      border: '1px solid rgba(56,189,248,0.2)',
      borderRadius: '10px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '420px',
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px',
        background: 'rgba(15,23,42,0.9)',
        borderBottom: '1px solid rgba(51,65,85,0.5)',
        gap: '10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Traffic-light dots */}
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#eab308', display: 'inline-block' }} />
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginLeft: 6 }}>{title}</span>
          <span style={{
            fontSize: '0.7rem', padding: '1px 6px', borderRadius: 10,
            backgroundColor: 'rgba(56,189,248,0.12)', color: '#38bdf8',
            border: '1px solid rgba(56,189,248,0.3)',
          }}>
            {logs.length} events
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            placeholder="Search…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              background: 'rgba(30,41,59,0.6)', border: '1px solid #334155',
              color: '#cbd5e1', borderRadius: 6, padding: '3px 8px',
              fontSize: '0.75rem', width: 130,
            }}
          />
          <select
            value={sevFilter}
            onChange={e => setSevFilter(e.target.value)}
            style={{
              background: 'rgba(30,41,59,0.6)', border: '1px solid #334155',
              color: '#94a3b8', borderRadius: 6, padding: '3px 6px', fontSize: '0.75rem',
            }}
          >
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="error">Error</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: '#94a3b8', fontSize: '0.75rem' }}>
            <input
              type="checkbox" checked={autoScroll}
              onChange={e => setAutoScroll(e.target.checked)}
              style={{ accentColor: '#38bdf8' }}
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Log area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {filtered.length === 0 ? (
          <div style={{ color: '#475569', padding: '1rem', textAlign: 'center', fontFamily: 'monospace' }}>
            Waiting for log events…
          </div>
        ) : (
          filtered.map((entry) => (
            <LogRow key={entry.id} entry={entry} isNew={entry.id === newestId} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
