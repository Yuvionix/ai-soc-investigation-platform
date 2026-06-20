import React, { useState } from 'react';

const SEV_COLOR = { critical:'#ef4444', high:'#f97316', medium:'#eab308', low:'#22c55e' };

function Section({ title, icon, content, accent }) {
  const [open, setOpen] = useState(true);
  if (!content?.trim()) return null;
  return (
    <div style={{
      borderRadius:10, overflow:'hidden', marginBottom:10,
      border:`1px solid rgba(51,65,85,0.4)`,
      background:'rgba(15,23,42,0.5)',
    }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width:'100%', padding:'10px 14px', background:'none', border:'none',
        cursor:'pointer', display:'flex', alignItems:'center', gap:10, textAlign:'left',
        borderBottom: open ? '1px solid rgba(51,65,85,0.3)' : 'none',
      }}>
        <div style={{
          width:28, height:28, borderRadius:8, fontSize:'0.9rem',
          display:'flex', alignItems:'center', justifyContent:'center',
          background:`${accent}12`, border:`1px solid ${accent}25`,
          flexShrink:0,
        }}>{icon}</div>
        <span style={{ fontWeight:600, color:'#f8fafc', fontSize:'0.85rem', flex:1 }}>{title}</span>
        <span style={{ color:'#475569', fontSize:'0.8rem' }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ padding:'12px 14px', fontSize:'0.82rem', color:'#94a3b8',
                      lineHeight:1.75, whiteSpace:'pre-wrap' }}>
          {content.trim()}
        </div>
      )}
    </div>
  );
}

function parseAnalysis(text) {
  const s = { technical:'', executive:'', beginner:'' };
  if (!text) return s;
  const parts = text.split(/^##\s+/m);
  for (const p of parts) {
    const lower = p.toLowerCase();
    if (lower.startsWith('technical'))  s.technical = p.replace(/^[^\n]+\n/, '');
    if (lower.startsWith('executive'))  s.executive = p.replace(/^[^\n]+\n/, '');
    if (lower.startsWith('beginner'))   s.beginner  = p.replace(/^[^\n]+\n/, '');
  }
  if (!s.technical && !s.executive && !s.beginner) s.technical = text;
  return s;
}

export default function AnalysisResults({ investigation }) {
  if (!investigation) return null;
  const { ai_analysis, severity, attack_types=[], source_ips=[],
          target_ips=[], event_count, timeline, plain_english={} } = investigation;
  const parsed   = parseAnalysis(ai_analysis);
  const sevColor = SEV_COLOR[severity] || '#94a3b8';

  return (
    <div>
      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(110px,1fr))',
                    gap:8, marginBottom:16 }}>
        {[
          { label:'Events',      value:event_count,               color:'#f8fafc' },
          { label:'Severity',    value:(severity||'—').toUpperCase(), color:sevColor },
          { label:'Attack Types',value:attack_types.length||'—',  color:'#f8fafc' },
          { label:'Source IPs',  value:source_ips.length||'—',   color:'#a78bfa' },
          { label:'Target IPs',  value:target_ips.length||'—',   color:'#38bdf8' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background:'rgba(15,23,42,0.7)', borderRadius:8,
            border:'1px solid rgba(51,65,85,0.3)', padding:'10px 12px',
          }}>
            <div style={{ fontSize:'0.62rem', color:'#475569', textTransform:'uppercase',
                          letterSpacing:'.06em', marginBottom:4 }}>{label}</div>
            <div style={{ fontWeight:700, color, fontSize:'1.1rem' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Timeline bar */}
      {timeline && (
        <div style={{
          background:'rgba(15,23,42,0.5)', borderRadius:8,
          border:'1px solid rgba(51,65,85,0.3)', padding:'8px 14px',
          marginBottom:12, display:'flex', alignItems:'center', gap:10,
        }}>
          <span style={{ fontSize:'0.7rem', color:'#475569' }}>Timeline</span>
          <span style={{ fontSize:'0.78rem', color:'#64748b',
                         fontFamily:'monospace' }}>{timeline}</span>
        </div>
      )}

      {/* Attack type chips with plain-english */}
      {attack_types.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:'0.68rem', color:'#475569', textTransform:'uppercase',
                        letterSpacing:'.08em', marginBottom:8, fontWeight:600 }}>
            Detected Attack Types
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {attack_types.map(at => (
              <div key={at} style={{
                background:'rgba(15,23,42,0.6)', borderRadius:8,
                border:'1px solid rgba(51,65,85,0.35)', padding:'8px 12px',
                display:'flex', alignItems:'flex-start', gap:10,
              }}>
                <span style={{
                  fontSize:'0.68rem', padding:'2px 8px', borderRadius:6, fontWeight:600,
                  background:'rgba(56,189,248,0.1)', color:'#38bdf8',
                  border:'1px solid rgba(56,189,248,0.2)', textTransform:'capitalize',
                  flexShrink:0, marginTop:1,
                }}>{at.replace(/_/g,' ')}</span>
                {plain_english[at] && (
                  <span style={{ fontSize:'0.78rem', color:'#64748b', lineHeight:1.55 }}>
                    {plain_english[at]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI sections */}
      <Section title="Technical Analysis"   icon="🔬" content={parsed.technical} accent="#38bdf8" />
      <Section title="Executive Summary"    icon="📊" content={parsed.executive} accent="#a78bfa" />
      <Section title="Beginner Explanation" icon="🎓" content={parsed.beginner}  accent="#22c55e" />
      {!parsed.technical && !parsed.executive && !parsed.beginner && ai_analysis && (
        <Section title="Analysis" icon="🤖" content={ai_analysis} accent="#94a3b8" />
      )}
    </div>
  );
}
