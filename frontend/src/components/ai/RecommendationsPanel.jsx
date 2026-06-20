import React, { useState } from 'react';

const ICONS = {
  port_scan:'🔍', brute_force:'🔑', ssh_brute:'🔐', malware:'🦠',
  data_exfil:'📤', dns_exfil:'🌐', ddos:'💥', lateral_movement:'↔️',
  c2:'📡', persistence:'⚓', network_anomaly:'📶', auth_failure:'🔑',
  network_scan:'🗺️',
};
const PRIORITY = ['critical','high','medium','low'];

export default function RecommendationsPanel({ recommendations = {} }) {
  const entries = Object.entries(recommendations);
  const [open,   setOpen]   = useState(entries[0]?.[0] || null);
  const [done,   setDone]   = useState({});   // checked steps

  if (!entries.length) return (
    <div style={{ color:'#475569', textAlign:'center', padding:'3rem', fontSize:'0.85rem' }}>
      No remediation recommendations generated.
    </div>
  );

  const totalSteps = entries.reduce((s, [, v]) => s + v.length, 0);
  const doneCount  = Object.values(done).filter(Boolean).length;

  const toggleStep = (key) =>
    setDone(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div>
      {/* Progress header */}
      <div style={{
        background:'rgba(15,23,42,0.6)', borderRadius:10,
        border:'1px solid rgba(51,65,85,0.35)', padding:'12px 16px',
        marginBottom:12, display:'flex', alignItems:'center', gap:16,
      }}>
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', justifyContent:'space-between',
                        alignItems:'center', marginBottom:6 }}>
            <span style={{ fontSize:'0.78rem', fontWeight:600, color:'#f8fafc' }}>
              Remediation Progress
            </span>
            <span style={{ fontSize:'0.75rem', color: doneCount===totalSteps ? '#22c55e' : '#64748b' }}>
              {doneCount} / {totalSteps} steps
            </span>
          </div>
          <div style={{ height:4, background:'rgba(51,65,85,0.4)', borderRadius:4, overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:4, transition:'width .4s ease',
              width:`${totalSteps ? (doneCount/totalSteps)*100 : 0}%`,
              background:'linear-gradient(90deg,#22c55e,#16a34a)',
              boxShadow:'0 0 8px rgba(34,197,94,0.4)',
            }} />
          </div>
        </div>
      </div>

      {/* Accordion list */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {entries.map(([atype, steps]) => {
          const isOpen = open === atype;
          const doneHere = steps.filter((_, idx) => done[`${atype}-${idx}`]).length;
          return (
            <div key={atype} style={{
              background:'rgba(15,23,42,0.5)', borderRadius:10,
              border:'1px solid rgba(51,65,85,0.35)', overflow:'hidden',
            }}>
              {/* Accordion header */}
              <button onClick={() => setOpen(isOpen ? null : atype)} style={{
                width:'100%', padding:'11px 14px', background:'none', border:'none',
                cursor:'pointer', display:'flex', alignItems:'center', gap:10,
                textAlign:'left', transition:'background .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background='rgba(51,65,85,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background='none'}
              >
                <div style={{
                  width:32, height:32, borderRadius:8, flexShrink:0,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'1.1rem',
                  background:'rgba(51,65,85,0.3)',
                  border:'1px solid rgba(51,65,85,0.4)',
                }}>
                  {ICONS[atype] || '🛡️'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:500, color:'#e2e8f0', fontSize:'0.85rem',
                                textTransform:'capitalize', marginBottom:2 }}>
                    {atype.replace(/_/g,' ')}
                  </div>
                  <div style={{ fontSize:'0.68rem', color:'#475569' }}>
                    {doneHere}/{steps.length} steps completed
                  </div>
                </div>
                {/* Mini progress */}
                <div style={{ width:40, height:4, background:'rgba(51,65,85,0.4)',
                              borderRadius:4, overflow:'hidden', flexShrink:0 }}>
                  <div style={{
                    height:'100%', borderRadius:4,
                    width:`${steps.length ? (doneHere/steps.length)*100 : 0}%`,
                    background:'#22c55e', transition:'width .3s',
                  }} />
                </div>
                <span style={{ color:'#334155', fontSize:'0.85rem' }}>
                  {isOpen ? '▾' : '▸'}
                </span>
              </button>

              {/* Steps */}
              {isOpen && (
                <div style={{ padding:'4px 14px 14px',
                              borderTop:'1px solid rgba(51,65,85,0.25)' }}>
                  {steps.map((step, idx) => {
                    const key  = `${atype}-${idx}`;
                    const done_ = !!done[key];
                    return (
                      <div key={idx} onClick={() => toggleStep(key)} style={{
                        display:'flex', alignItems:'flex-start', gap:10,
                        padding:'8px 6px', cursor:'pointer', borderRadius:7,
                        marginTop:4, transition:'background .15s',
                        opacity: done_ ? 0.55 : 1,
                      }}
                      onMouseEnter={e => e.currentTarget.style.background='rgba(51,65,85,0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background='transparent'}
                      >
                        {/* Checkbox */}
                        <div style={{
                          width:18, height:18, borderRadius:5, flexShrink:0, marginTop:1,
                          border:`1.5px solid ${done_ ? '#22c55e' : 'rgba(51,65,85,0.6)'}`,
                          background: done_ ? 'rgba(34,197,94,0.15)' : 'transparent',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:'0.65rem', color:'#22c55e',
                          transition:'all .15s',
                        }}>
                          {done_ ? '✓' : ''}
                        </div>
                        <span style={{
                          fontSize:'0.8rem', color: done_ ? '#475569' : '#94a3b8',
                          lineHeight:1.55,
                          textDecoration: done_ ? 'line-through' : 'none',
                        }}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
