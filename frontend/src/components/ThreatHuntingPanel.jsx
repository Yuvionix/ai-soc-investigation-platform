/**
 * ThreatHuntingPanel
 * ===================
 * Query interface allowing analysts to search across all data sources.
 * Supports structured queries like: ip:45.22.11.9 severity:critical source:firewall
 * Also supports free-text search.
 */
import React, { useState, useRef } from 'react';
import { api } from '../api/apiClient';

const EXAMPLES = [
  'ip:45.22.11.9',
  'severity:critical source:EDR',
  'brute force',
  'type:malware last:1h',
  'ip:10.0.0.5 status:open',
];

function parseQuery(q) {
  const params = { severity: null, source: null, ip: null, search: null, status: null };
  let remaining = q;

  const extract = (key, aliases = []) => {
    const keys = [key, ...aliases];
    for (const k of keys) {
      const m = remaining.match(new RegExp(`${k}:([\\w\\.\\-]+)`, 'i'));
      if (m) { remaining = remaining.replace(m[0], '').trim(); return m[1]; }
    }
    return null;
  };

  params.ip       = extract('ip', ['src', 'dst']);
  params.severity = extract('severity', ['sev']);
  params.source   = extract('source', ['src_system']);
  params.status   = extract('status');
  params.search   = remaining.trim() || null;
  return params;
}

function ResultRow({ item, type }) {
  const SEV = { critical:'#ef4444', high:'#f97316', medium:'#eab308', low:'#22c55e', warning:'#eab308', info:'#38bdf8' };
  const color = SEV[item.severity] || '#94a3b8';
  return (
    <div style={{
      padding: '8px 12px', borderRadius: 6, marginBottom: 4,
      backgroundColor: 'rgba(15,23,42,0.6)', border: '1px solid rgba(51,65,85,0.3)',
      borderLeft: `3px solid ${color}`,
      display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize:'0.65rem', padding:'1px 6px', borderRadius:4, flexShrink:0,
                     backgroundColor:`${color}15`, color, border:`1px solid ${color}25`,
                     fontWeight:700, alignSelf:'center', textTransform:'uppercase' }}>
        {type}
      </span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ color:'#f8fafc', fontSize:'0.82rem', fontWeight:500 }}>
          {item.title || item.message?.slice(0,80) || '—'}
        </div>
        <div style={{ color:'#64748b', fontSize:'0.72rem', marginTop:2, display:'flex', gap:10 }}>
          {item.ip_address && <span style={{ fontFamily:'monospace', color:'#a78bfa' }}>{item.ip_address}</span>}
          {item.source && <span>{item.source}</span>}
          {item.severity && <span style={{ color }}>{item.severity}</span>}
          {item.created_at && <span>{new Date(item.created_at).toLocaleTimeString()}</span>}
        </div>
      </div>
    </div>
  );
}

export default function ThreatHuntingPanel() {
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const inputRef = useRef(null);

  const hunt = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true); setError('');
    try {
      const p = parseQuery(q);
      const alertParams = {};
      const logParams   = {};

      if (p.severity) { alertParams.severity = p.severity; logParams.severity = p.severity; }
      if (p.source)   { alertParams.source   = p.source;   logParams.source   = p.source;   }
      if (p.status)   { alertParams.status   = p.status; }
      if (p.ip)       { alertParams.source   = p.ip;       logParams.ip_address = p.ip;     }
      if (p.search)   { alertParams.source   = alertParams.source || p.search; logParams.search = p.search; }

      const [alertsR, logsR, incsR] = await Promise.all([
        api.getAlerts({ ...alertParams, limit:20 }),
        api.getLogs({ ...logParams, limit:20 }),
        api.getIncidents({ severity: p.severity, status: p.status, limit:10 }),
      ]);

      const alerts    = (alertsR.data  || []).filter(a =>
        !p.ip || (a.ip_address||'').includes(p.ip) ||
        !p.search || (a.title||'').toLowerCase().includes(p.search.toLowerCase()) ||
        (a.description||'').toLowerCase().includes(p.search.toLowerCase())
      );
      const logs      = logsR.data    || [];
      const incidents = (incsR.data   || []).filter(i =>
        !p.search || (i.title||'').toLowerCase().includes(p.search.toLowerCase())
      );

      setResults({ alerts, logs, incidents, query: q, parsed: p });
    } catch (err) {
      setError('Search failed. Check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  const totalResults = results ? results.alerts.length + results.logs.length + results.incidents.length : 0;

  return (
    <div style={{
      backgroundColor: '#0a0e1a', border: '1px solid rgba(51,65,85,0.5)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', background: 'rgba(15,23,42,0.9)',
                    borderBottom: '1px solid rgba(51,65,85,0.4)',
                    display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: '1rem' }}>🔎</span>
        <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
          Threat Hunting
        </span>
        <span style={{ color: '#334155', fontSize: '0.72rem', marginLeft: 4 }}>
          Search across logs, alerts, and incidents
        </span>
      </div>

      <div style={{ padding: '1rem' }}>
        {/* Search bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && hunt()}
            placeholder='Search: ip:45.22.11.9  severity:critical  brute force  source:firewall'
            style={{ flex: 1, fontFamily: '"Fira Code", monospace', fontSize: '0.85rem', padding: '8px 12px' }}
          />
          <button onClick={() => hunt()} disabled={loading} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            backgroundColor: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '0.85rem',
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? '…' : 'Hunt'}
          </button>
        </div>

        {/* Example queries */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: '1rem' }}>
          <span style={{ color: '#475569', fontSize: '0.7rem', alignSelf: 'center' }}>Examples:</span>
          {EXAMPLES.map(ex => (
            <button key={ex} onClick={() => { setQuery(ex); hunt(ex); }} style={{
              fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
              backgroundColor: 'rgba(51,65,85,0.3)', color: '#64748b',
              border: '1px solid rgba(51,65,85,0.4)', fontFamily: 'monospace',
            }}>
              {ex}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: '0.75rem' }}>⚠ {error}</div>
        )}

        {/* Results */}
        {results && (
          <div>
            <div style={{ color: '#475569', fontSize: '0.75rem', marginBottom: '0.75rem',
                          display: 'flex', justifyContent: 'space-between' }}>
              <span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{totalResults}</span> results for:
                <span style={{ fontFamily: 'monospace', color: '#94a3b8', marginLeft: 6 }}>"{results.query}"</span>
              </span>
              <span>{results.alerts.length} alerts · {results.logs.length} logs · {results.incidents.length} incidents</span>
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {totalResults === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#334155' }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>🔍</div>
                  No results found. Try different search terms.
                </div>
              )}
              {results.incidents.map(i => <ResultRow key={`inc-${i.id}`} item={i} type="incident" />)}
              {results.alerts.map(a    => <ResultRow key={`alt-${a.id}`} item={a} type="alert"    />)}
              {results.logs.map(l      => <ResultRow key={`log-${l.id}`} item={l} type="log"      />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
