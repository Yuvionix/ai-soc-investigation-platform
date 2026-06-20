import React from 'react';

const TACTIC_COLORS = {
  'Reconnaissance':        '#a78bfa',
  'Initial Access':        '#f97316',
  'Execution':             '#ef4444',
  'Persistence':           '#eab308',
  'Privilege Escalation':  '#f97316',
  'Defense Evasion':       '#64748b',
  'Credential Access':     '#ec4899',
  'Discovery':             '#38bdf8',
  'Lateral Movement':      '#fb923c',
  'Collection':            '#22c55e',
  'Exfiltration':          '#ef4444',
  'Command and Control':   '#a78bfa',
  'Impact':                '#ef4444',
};

export default function MitrePanel({ mitreMappings = [] }) {
  if (!mitreMappings.length) return (
    <div style={{ color:'#475569', textAlign:'center', padding:'3rem', fontSize:'0.85rem' }}>
      No MITRE ATT&amp;CK techniques identified in this evidence.
    </div>
  );

  return (
    <div>
      <div style={{ fontSize:'0.68rem', color:'#475569', textTransform:'uppercase',
                    letterSpacing:'.08em', marginBottom:16, fontWeight:600 }}>
        {mitreMappings.length} technique{mitreMappings.length!==1?'s':''} identified
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:10 }}>
        {mitreMappings.map((t, i) => {
          const color = TACTIC_COLORS[t.tactic] || '#94a3b8';
          return (
            <div key={i} style={{
              background:'rgba(15,23,42,0.65)', borderRadius:10,
              border:`1px solid rgba(51,65,85,0.35)`,
              borderLeft:`3px solid ${color}`,
              padding:'14px 15px',
              transition:'transform .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform='translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
            >
              {/* Header row */}
              <div style={{ display:'flex', justifyContent:'space-between',
                            alignItems:'flex-start', marginBottom:8 }}>
                <code style={{
                  fontSize:'0.82rem', fontWeight:700, color,
                  fontFamily:'monospace', letterSpacing:'.02em',
                }}>{t.technique_id}</code>
                <span style={{
                  fontSize:'0.62rem', padding:'2px 8px', borderRadius:8, fontWeight:600,
                  background:`${color}12`, color, border:`1px solid ${color}25`,
                  textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap',
                }}>{t.tactic}</span>
              </div>

              {/* Technique name */}
              <div style={{ fontWeight:600, color:'#f8fafc', fontSize:'0.85rem', marginBottom:7 }}>
                {t.technique_name}
              </div>

              {/* Description */}
              <div style={{ fontSize:'0.75rem', color:'#64748b', lineHeight:1.55 }}>
                {t.description}
              </div>

              {/* ATT&CK link pill */}
              <div style={{ marginTop:10 }}>
                <a
                  href={`https://attack.mitre.org/techniques/${t.technique_id?.replace('.','/')}/`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    fontSize:'0.65rem', color:'#475569', textDecoration:'none',
                    display:'inline-flex', alignItems:'center', gap:4,
                    padding:'2px 8px', borderRadius:5,
                    border:'1px solid rgba(51,65,85,0.4)',
                    background:'rgba(15,23,42,0.5)',
                    transition:'color .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color=color}
                  onMouseLeave={e => e.currentTarget.style.color='#475569'}
                >
                  🔗 View on MITRE ATT&amp;CK
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
