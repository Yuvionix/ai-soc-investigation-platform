import React, { useState } from 'react';

const PHASE_COLORS = [
  '#a78bfa','#f97316','#ef4444','#eab308',
  '#22c55e','#38bdf8','#ec4899','#fb923c',
];
const PHASE_ICONS = ['🔍','🚪','⚡','📦','📡','📤','💥','🔒'];

function parseStory(text) {
  if (!text) return [];
  const phases = [];
  const blocks  = text.split(/^##\s+/m);
  for (const block of blocks) {
    const lines   = block.trim().split('\n');
    const title   = lines[0]?.trim();
    if (!title) continue;
    const content = lines.slice(1).join('\n').trim();

    // Parse sub-sections (**Label:** text)
    const sections = {};
    let cur = 'body';
    for (const line of content.split('\n')) {
      const bm = line.match(/^\*\*(.+?):\*\*/);
      if (bm) { cur = bm[1].toLowerCase().replace(/\s+/g,'_'); sections[cur] = ''; }
      else     { sections[cur] = (sections[cur]||'') + line + '\n'; }
    }
    phases.push({ title, ...sections });
  }
  return phases.length ? phases : [{ title:'Attack Narrative', body:text }];
}

export default function AttackStory({ story }) {
  const [active, setActive] = useState(0);

  if (!story) return (
    <div style={{ color:'#475569', textAlign:'center', padding:'3rem', fontSize:'0.85rem' }}>
      No attack story generated.
    </div>
  );

  const phases  = parseStory(story);
  const isWrap  = (p) => p.title.toLowerCase().includes('overall') ||
                         p.title.toLowerCase().includes('risk');

  const mainPhases = phases.filter(p => !isWrap(p));
  const summary    = phases.find(p => isWrap(p));

  return (
    <div>
      {/* Phase stepper */}
      {mainPhases.length > 1 && (
        <div style={{ display:'flex', gap:6, overflowX:'auto',
                      marginBottom:16, paddingBottom:4 }}>
          {mainPhases.map((phase, i) => {
            const color = PHASE_COLORS[i % PHASE_COLORS.length];
            const isAct = active === i;
            return (
              <button key={i} onClick={() => setActive(i)} style={{
                padding:'7px 14px', borderRadius:8, fontSize:'0.76rem', fontWeight:600,
                cursor:'pointer', border:'none', whiteSpace:'nowrap', flexShrink:0,
                transition:'all .15s',
                background: isAct ? `${color}18` : 'rgba(15,23,42,0.5)',
                color: isAct ? color : '#475569',
                boxShadow: isAct ? `0 0 0 1px ${color}30` : 'none',
                display:'flex', alignItems:'center', gap:6,
              }}>
                <span>{PHASE_ICONS[i % PHASE_ICONS.length]}</span>
                <span>{phase.title.replace(/^Phase \d+:\s*/i,'')}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Active phase content */}
      {mainPhases.length > 0 && (() => {
        const phase = mainPhases[active] || mainPhases[0];
        const color = PHASE_COLORS[active % PHASE_COLORS.length];
        return (
          <div style={{
            background:'rgba(15,23,42,0.6)', borderRadius:12,
            border:`1px solid ${color}25`, borderLeft:`3px solid ${color}`,
            padding:'1.25rem', marginBottom:12,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
              <div style={{
                width:36, height:36, borderRadius:10, flexShrink:0,
                display:'flex', alignItems:'center', justifyContent:'center',
                background:`${color}12`, border:`1px solid ${color}25`,
                fontSize:'1.1rem',
              }}>
                {PHASE_ICONS[active % PHASE_ICONS.length]}
              </div>
              <div>
                <div style={{ fontWeight:700, color:'#f8fafc', fontSize:'0.95rem' }}>
                  {phase.title.replace(/^Phase \d+:\s*/i,'')}
                </div>
                <div style={{ fontSize:'0.68rem', color:'#475569', marginTop:2 }}>
                  Phase {active+1} of {mainPhases.length}
                </div>
              </div>
            </div>

            {[
              { key:'what_happened', label:'What Happened', color:'#e2e8f0' },
              { key:'evidence',      label:'Evidence',      color:'#64748b', mono:true },
              { key:'impact',        label:'Impact',        color:'#f97316' },
              { key:'body',          label:null,            color:'#94a3b8' },
            ].map(({ key, label, color:c, mono }) => {
              const val = phase[key]?.trim();
              if (!val) return null;
              return (
                <div key={key} style={{ marginBottom:10 }}>
                  {label && (
                    <div style={{ fontSize:'0.65rem', color:'#475569', textTransform:'uppercase',
                                  letterSpacing:'.08em', marginBottom:4, fontWeight:600 }}>
                      {label}
                    </div>
                  )}
                  <div style={{
                    fontSize:'0.82rem', color:c, lineHeight:1.65, whiteSpace:'pre-wrap',
                    fontFamily: mono ? 'monospace' : 'inherit',
                    background: mono ? 'rgba(15,23,42,0.5)' : 'transparent',
                    padding: mono ? '8px 10px' : 0,
                    borderRadius: mono ? 7 : 0,
                    border: mono ? '1px solid rgba(51,65,85,0.3)' : 'none',
                  }}>{val}</div>
                </div>
              );
            })}

            {/* Navigation arrows */}
            {mainPhases.length > 1 && (
              <div style={{ display:'flex', gap:8, marginTop:14, paddingTop:12,
                            borderTop:'1px solid rgba(51,65,85,0.2)' }}>
                <button
                  onClick={() => setActive(a => Math.max(0,a-1))}
                  disabled={active===0}
                  style={{
                    padding:'6px 14px', borderRadius:7, fontSize:'0.75rem', cursor:'pointer',
                    background:'rgba(51,65,85,0.25)', color: active===0 ? '#334155' : '#94a3b8',
                    border:'1px solid rgba(51,65,85,0.3)',
                    opacity: active===0 ? 0.5 : 1,
                  }}>
                  ← Previous
                </button>
                <button
                  onClick={() => setActive(a => Math.min(mainPhases.length-1,a+1))}
                  disabled={active===mainPhases.length-1}
                  style={{
                    padding:'6px 14px', borderRadius:7, fontSize:'0.75rem', cursor:'pointer',
                    background:`${color}10`, color,
                    border:`1px solid ${color}25`,
                    opacity: active===mainPhases.length-1 ? 0.5 : 1,
                  }}>
                  Next →
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Risk summary */}
      {summary && (
        <div style={{
          background:'rgba(51,65,85,0.15)', borderRadius:10,
          border:'1px solid rgba(51,65,85,0.3)', padding:'12px 14px',
        }}>
          <div style={{ fontSize:'0.68rem', color:'#64748b', textTransform:'uppercase',
                        letterSpacing:'.08em', marginBottom:6, fontWeight:600 }}>
            Overall Risk Assessment
          </div>
          <div style={{ fontSize:'0.82rem', color:'#94a3b8', lineHeight:1.65, whiteSpace:'pre-wrap' }}>
            {(summary.body||summary.what_happened||'').trim()}
          </div>
        </div>
      )}
    </div>
  );
}
