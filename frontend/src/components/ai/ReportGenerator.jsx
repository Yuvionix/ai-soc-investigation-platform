import React, { useState } from 'react';
import { aiApi } from '../../api/aiClient';

const VIEWS = [
  { id:'technical',   label:'Technical',   icon:'🔬',
    desc:'Full detail for SOC analysts',          accent:'#38bdf8' },
  { id:'management',  label:'Management',  icon:'📊',
    desc:'Business impact for leadership',        accent:'#a78bfa' },
  { id:'educational', label:'Educational', icon:'🎓',
    desc:'Plain English for students',            accent:'#22c55e' },
];

export default function ReportGenerator({ sessionId, model }) {
  const [view,    setView]    = useState('technical');
  const [report,  setReport]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const generate = async () => {
    setLoading(true); setError(''); setReport('');
    try {
      const { data } = await aiApi.generateReport({ session_id:sessionId, view, model });
      setReport(data.report);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  };

  const download = () => {
    const blob = new Blob([report], { type:'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `soc-report-${view}-${Date.now()}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const activeView = VIEWS.find(v => v.id === view);

  return (
    <div>
      {/* View selector */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
        {VIEWS.map(v => (
          <button key={v.id} onClick={() => { setView(v.id); setReport(''); }} style={{
            padding:'12px 10px', borderRadius:10, cursor:'pointer', textAlign:'left',
            background: view===v.id
              ? `linear-gradient(135deg,${v.accent}12,${v.accent}06)`
              : 'rgba(15,23,42,0.5)',
            border:`1px solid ${view===v.id ? v.accent+'35' : 'rgba(51,65,85,0.4)'}`,
            transition:'all .15s',
          }}>
            <div style={{ fontSize:'1.2rem', marginBottom:4 }}>{v.icon}</div>
            <div style={{ fontWeight:600, fontSize:'0.82rem',
                          color: view===v.id ? v.accent : '#e2e8f0', marginBottom:2 }}>
              {v.label}
            </div>
            <div style={{ fontSize:'0.7rem', color:'#475569', lineHeight:1.4 }}>{v.desc}</div>
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <button onClick={generate} disabled={loading} style={{
          padding:'9px 20px', borderRadius:9, fontSize:'0.82rem', fontWeight:600,
          cursor: loading ? 'not-allowed' : 'pointer', border:'none',
          background: loading
            ? 'rgba(51,65,85,0.3)'
            : `linear-gradient(135deg,${activeView?.accent || '#38bdf8'},${activeView?.accent || '#38bdf8'}cc)`,
          color: loading ? '#475569' : '#0f172a',
          boxShadow: loading ? 'none' : `0 4px 14px ${activeView?.accent || '#38bdf8'}30`,
          transition:'all .15s',
        }}>
          {loading ? '⏳ Generating…' : `Generate ${activeView?.label} Report`}
        </button>
        {report && (
          <button onClick={download} style={{
            padding:'9px 16px', borderRadius:9, fontSize:'0.82rem', fontWeight:600,
            cursor:'pointer', background:'rgba(34,197,94,0.1)', color:'#22c55e',
            border:'1px solid rgba(34,197,94,0.25)',
          }}>
            ⬇ Download
          </button>
        )}
      </div>

      {error && (
        <div style={{
          padding:'9px 12px', borderRadius:8, marginBottom:12, fontSize:'0.78rem',
          background:'rgba(239,68,68,0.08)', color:'#fca5a5',
          border:'1px solid rgba(239,68,68,0.2)',
        }}>⚠ {error}</div>
      )}

      {report && (
        <div style={{
          background:'rgba(10,15,28,0.8)', borderRadius:10,
          border:`1px solid ${activeView?.accent || '#38bdf8'}20`,
          padding:'1.25rem',
          fontSize: view==='technical' ? '0.76rem' : '0.82rem',
          color:'#cbd5e1', lineHeight:1.8, whiteSpace:'pre-wrap',
          maxHeight:460, overflowY:'auto',
          fontFamily: view==='technical' ? "'Fira Code',monospace" : 'inherit',
        }}>
          {report}
        </div>
      )}
    </div>
  );
}
