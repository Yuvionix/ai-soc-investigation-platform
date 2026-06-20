/**
 * IPReputationBadge
 * ==================
 * Shows an inline threat intelligence badge for any IP address.
 * Uses a local heuristic + known threat IP list since we're offline.
 * In a production environment this would call AbuseIPDB / VirusTotal.
 */
import React, { useState, useEffect } from 'react';

// Known malicious IPs from our seeded alerts + common threat actors
const THREAT_IP_DB = {
  '45.22.11.9':      { score: 97, category: 'Brute Force / APT',    country: 'RU', reports: 342 },
  '188.43.2.1':      { score: 89, category: 'Port Scanner',          country: 'CN', reports: 187 },
  '91.195.240.44':   { score: 99, category: 'Malware C2',            country: 'RU', reports: 891 },
  '92.118.160.11':   { score: 95, category: 'Credential Stuffing',   country: 'UA', reports: 423 },
  '185.220.101.46':  { score: 98, category: 'Tor Exit Node',         country: 'DE', reports: 1204 },
  '172.16.0.4':      { score: 20, category: 'Internal Host',         country: 'LAN', reports: 0 },
  '10.0.0.5':        { score: 15, category: 'Internal Host',         country: 'LAN', reports: 0 },
  '10.0.0.7':        { score: 30, category: 'Internal (Suspicious)', country: 'LAN', reports: 0 },
  '10.0.0.8':        { score: 25, category: 'Internal Host',         country: 'LAN', reports: 0 },
  '10.0.0.12':       { score: 40, category: 'Internal (Scanning)',   country: 'LAN', reports: 0 },
};

function scoreColor(score) {
  if (score >= 80) return '#ef4444';
  if (score >= 50) return '#f97316';
  if (score >= 20) return '#eab308';
  return '#22c55e';
}

function scoreLabel(score) {
  if (score >= 80) return 'MALICIOUS';
  if (score >= 50) return 'SUSPICIOUS';
  if (score >= 20) return 'LOW RISK';
  return 'CLEAN';
}

export default function IPReputationBadge({ ip, inline = false }) {
  const [rep, setRep] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!ip) return;
    // Check local threat DB first
    if (THREAT_IP_DB[ip]) {
      setRep(THREAT_IP_DB[ip]);
      return;
    }
    // Heuristic for unknown IPs
    const isPrivate = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
    const isLoopback = ip === '127.0.0.1';
    if (isPrivate || isLoopback) {
      setRep({ score: 5, category: 'Internal / Private', country: 'LAN', reports: 0 });
    } else {
      setRep({ score: 45, category: 'Unknown External', country: '??', reports: 0 });
    }
  }, [ip]);

  if (!ip || !rep) return null;

  const color = scoreColor(rep.score);
  const label = scoreLabel(rep.score);

  if (inline) {
    return (
      <span
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer',
          fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4,
          backgroundColor: `${color}15`, color, border: `1px solid ${color}30`,
          fontWeight: 700, letterSpacing: '0.04em', userSelect: 'none',
        }}
        title="Click for threat intel"
      >
        ⚑ {label} {rep.score}/100
      </span>
    );
  }

  return (
    <div style={{
      backgroundColor: `${color}08`,
      border: `1px solid ${color}30`,
      borderRadius: 8,
      padding: '10px 14px',
      marginTop: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color, fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⚑ Threat Intelligence: {label}
          </span>
        </div>
        <span style={{
          fontSize: '1.1rem', fontWeight: 800, color,
          backgroundColor: `${color}15`, padding: '2px 10px', borderRadius: 6,
        }}>
          {rep.score}/100
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: '0.78rem' }}>
        <div>
          <div style={{ color: '#475569', fontSize: '0.68rem', textTransform: 'uppercase', marginBottom: 2 }}>Category</div>
          <div style={{ color: '#cbd5e1' }}>{rep.category}</div>
        </div>
        <div>
          <div style={{ color: '#475569', fontSize: '0.68rem', textTransform: 'uppercase', marginBottom: 2 }}>Origin</div>
          <div style={{ color: '#cbd5e1' }}>{rep.country}</div>
        </div>
        <div>
          <div style={{ color: '#475569', fontSize: '0.68rem', textTransform: 'uppercase', marginBottom: 2 }}>Reports</div>
          <div style={{ color: '#cbd5e1' }}>{rep.reports.toLocaleString()}</div>
        </div>
      </div>

      {/* Score bar */}
      <div style={{ marginTop: 8, height: 4, backgroundColor: '#1e293b', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${rep.score}%`,
          backgroundColor: color, borderRadius: 2,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}
