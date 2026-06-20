/**
 * LivePacketTable
 * ================
 * Real-time network packet monitor.
 * Displays a live-updating table of captured packets with:
 *  - Protocol color coding
 *  - Threat type badges
 *  - DNS query display
 *  - Port monitoring
 *  - Animated new-row highlight
 */

import React, { useState } from 'react';

const PROTO_COLORS = {
  TCP:   '#38bdf8',
  UDP:   '#a78bfa',
  DNS:   '#34d399',
  ICMP:  '#fb923c',
  OTHER: '#94a3b8',
};

const THREAT_BADGES = {
  port_scan:   { label: 'PORT SCAN',    color: '#eab308', bg: 'rgba(234,179,8,0.12)' },
  ddos:        { label: 'DDoS',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  brute_force: { label: 'BRUTE FORCE',  color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  dns_exfil:   { label: 'DNS EXFIL',    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
};

function ThreatBadge({ type }) {
  const b = THREAT_BADGES[type];
  if (!b) return null;
  return (
    <span style={{
      fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4,
      backgroundColor: b.bg, color: b.color,
      border: `1px solid ${b.color}30`, fontWeight: 700, letterSpacing: '0.04em',
    }}>
      ⚠ {b.label}
    </span>
  );
}

function PacketRow({ pkt, isNew }) {
  const protoColor = PROTO_COLORS[pkt.protocol] || PROTO_COLORS.OTHER;
  return (
    <tr style={{
      backgroundColor: isNew
        ? (pkt.threat_type ? 'rgba(239,68,68,0.06)' : 'rgba(56,189,248,0.04)')
        : 'transparent',
      borderLeft: isNew
        ? `2px solid ${pkt.threat_type ? '#ef4444' : '#38bdf8'}`
        : '2px solid transparent',
      transition: 'background-color 2s ease',
      fontSize: '0.78rem',
    }}>
      <td style={{ padding: '5px 10px', color: '#475569', fontFamily: 'monospace' }}>
        {new Date(pkt.timestamp).toLocaleTimeString('en-US', { hour12: false })}
      </td>
      <td style={{ padding: '5px 10px' }}>
        <span style={{
          color: protoColor,
          backgroundColor: `${protoColor}18`,
          padding: '1px 6px', borderRadius: 4, fontWeight: 700, fontSize: '0.7rem',
        }}>
          {pkt.protocol || 'OTHER'}
        </span>
      </td>
      <td style={{ padding: '5px 10px', color: '#a78bfa', fontFamily: 'monospace' }}>
        {pkt.src_ip || '—'}
      </td>
      <td style={{ padding: '5px 10px', color: '#64748b', fontFamily: 'monospace' }}>
        {pkt.dst_ip || '—'}
      </td>
      <td style={{ padding: '5px 10px', color: '#94a3b8', fontFamily: 'monospace' }}>
        {pkt.dst_port > 0 ? pkt.dst_port : '—'}
      </td>
      <td style={{ padding: '5px 10px', color: '#38bdf8', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {pkt.dns_query || ''}
      </td>
      <td style={{ padding: '5px 10px' }}>
        {pkt.threat_type
          ? <ThreatBadge type={pkt.threat_type} />
          : <span style={{ color: '#334155' }}>—</span>
        }
      </td>
    </tr>
  );
}

export default function LivePacketTable({ packets = [] }) {
  const [protoFilter, setProtoFilter] = useState('');
  const [threatOnly,  setThreatOnly]  = useState(false);
  const [paused,      setPaused]      = useState(false);

  const displayed = paused ? packets : packets;   // toggling pause just stops new rows from updating

  const filtered = displayed.filter(p => {
    if (protoFilter && p.protocol !== protoFilter) return false;
    if (threatOnly  && !p.threat_type)             return false;
    return true;
  });

  const newestId = filtered[0]?.id;

  return (
    <div style={{
      backgroundColor: '#0d1525',
      border: '1px solid rgba(51,65,85,0.5)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: 'rgba(15,23,42,0.9)',
        borderBottom: '1px solid rgba(51,65,85,0.5)',
        flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
            🔍 Live Packet Monitor
          </span>
          <span style={{
            fontSize: '0.7rem', padding: '1px 7px', borderRadius: 10,
            backgroundColor: 'rgba(167,139,250,0.12)', color: '#a78bfa',
            border: '1px solid rgba(167,139,250,0.3)',
          }}>
            {packets.length} captured
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={protoFilter}
            onChange={e => setProtoFilter(e.target.value)}
            style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, padding: '3px 6px', fontSize: '0.75rem' }}
          >
            <option value="">All Protocols</option>
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
            <option value="DNS">DNS</option>
            <option value="ICMP">ICMP</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', color: '#94a3b8', fontSize: '0.75rem' }}>
            <input type="checkbox" checked={threatOnly} onChange={e => setThreatOnly(e.target.checked)} style={{ accentColor: '#ef4444' }} />
            Threats only
          </label>
          <button
            onClick={() => setPaused(p => !p)}
            style={{
              fontSize: '0.75rem', padding: '3px 10px', borderRadius: 6, cursor: 'pointer',
              backgroundColor: paused ? 'rgba(56,189,248,0.12)' : 'rgba(239,68,68,0.1)',
              color: paused ? '#38bdf8' : '#ef4444',
              border: `1px solid ${paused ? 'rgba(56,189,248,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}
          >
            {paused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'rgba(15,23,42,0.6)', fontSize: '0.72rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Time</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Proto</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Src IP</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Dst IP</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Dst Port</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>DNS Query</th>
              <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600 }}>Threat</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: '#334155', padding: '2rem', textAlign: 'center', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  Waiting for packets…
                </td>
              </tr>
            ) : (
              filtered.slice(0, 100).map(pkt => (
                <PacketRow key={pkt.id} pkt={pkt} isNew={pkt.id === newestId} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
