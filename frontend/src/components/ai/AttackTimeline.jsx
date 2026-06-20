import React, { useState } from 'react';

const SEV_COLOR = {
  critical:'#ef4444', high:'#f97316', medium:'#eab308',
  low:'#22c55e', warning:'#eab308', info:'#38bdf8',
};
const TYPE_ICON = {
  port_scan:'🔍', brute_force:'🔑', ssh_brute:'🔐', malware:'🦠',
  data_exfil:'📤', dns_exfil:'🌐', ddos:'💥', lateral_movement:'↔️',
  c2:'📡', persistence:'⚓', network_anomaly:'📶', successful_login:'✅',
  file_access:'📁', auth_failure:'🔑', network_scan:'🗺️',
};

export default function AttackTimeline({ events = [] }) {
  const [expanded, setExpanded] = useState(null);

  if (!events.length) return (
    <div style={{ color:'#475569', textAlign:'center', padding:'3rem', fontSize:'0.85rem' }}>
      No timeline events available.
    </div>
  );

  const sorted = [...events].sort((a, b) => {
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return a.timestamp.localeCompare(b.timestamp);
  });

  return (
    <div>
      <div style={{ fontSize:'0.68rem', color:'#475569', textTransform:'uppercase',
                    letterSpacing:'.08em', marginBottom:16, fontWeight:600 }}>
        {sorted.length} events in chronological order
      </div>
      <div style={{ position:'relative', paddingLeft:28 }}>
        {/* Vertical spine */}
        <div style={{
          position:'absolute', left:11, top:8, bottom:8, width:2,
          background:'linear-gradient(to bottom,rgba(56,189,248,0.3),rgba(51,65,85,0.2))',
          borderRadius:2,
        }} />

        {sorted.map((ev, i) => {
          const color = SEV_COLOR[ev.severity] || '#64748b';
          const isOpen = expanded === i;
          return (
            <div key={i} style={{ position:'relative', marginBottom:10 }}>
              {/* Dot */}
              <div style={{
                position:'absolute', left:-20, top:12, width:10, height:10,
                borderRadius:'50%', backgroundColor:color,
                boxShadow:`0 0 8px ${color}60`,
                border:`2px solid ${color}30`,
                zIndex:1,
              }} />

              {/* Card */}
              <div
                onClick={() => setExpanded(isOpen ? null : i)}
                style={{
                  backgroundColor:'rgba(15,23,42,0.6)', borderRadius:9,
                  border:`1px solid ${isOpen ? color+'40' : 'rgba(51,65,85,0.35)'}`,
                  borderLeft:`2px solid ${color}`,
                  padding:'9px 12px', cursor:'pointer',
                  transition:'all .15s',
                }}
              >
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontSize:'1rem' }}>
                    {TYPE_ICON[ev.alert_type] || '⚡'}
                  </span>
                  <code style={{ fontSize:'0.7rem', color:'#475569', fontFamily:'monospace' }}>
                    {ev.timestamp || '—'}
                  </code>
                  <span style={{
                    fontSize:'0.62rem', padding:'1px 7px', borderRadius:6, fontWeight:600,
                    background:`${color}12`, color, border:`1px solid ${color}25`,
                    textTransform:'uppercase',
                  }}>{ev.severity}</span>
                  <span style={{ fontSize:'0.78rem', color:'#94a3b8', textTransform:'capitalize' }}>
                    {(ev.alert_type||'event').replace(/_/g,' ')}
                  </span>
                  <span style={{ marginLeft:'auto', color:'#334155', fontSize:'0.7rem' }}>
                    {isOpen ? '▾' : '▸'}
                  </span>
                </div>

                <div style={{ fontSize:'0.78rem', color:'#64748b', marginTop:5,
                              lineHeight:1.5, paddingRight:20 }}>
                  {ev.message?.slice(0,100)}{ev.message?.length>100?'…':''}
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{
                    marginTop:10, paddingTop:10,
                    borderTop:'1px solid rgba(51,65,85,0.3)',
                    display:'grid', gridTemplateColumns:'1fr 1fr', gap:8,
                  }}>
                    {[
                      { label:'Source IP', value:ev.source_ip, color:'#a78bfa' },
                      { label:'Target IP', value:ev.target_ip, color:'#38bdf8' },
                      { label:'Source',    value:ev.source,    color:'#94a3b8' },
                      { label:'Full Message', value:ev.message, color:'#64748b', full:true },
                    ].filter(f => f.value).map(f => (
                      <div key={f.label}
                        style={{ gridColumn: f.full ? '1/-1' : 'auto' }}>
                        <div style={{ fontSize:'0.6rem', color:'#334155',
                                      textTransform:'uppercase', letterSpacing:'.06em',
                                      marginBottom:2 }}>{f.label}</div>
                        <div style={{ fontSize:'0.75rem', color:f.color,
                                      fontFamily: f.label.includes('IP') ? 'monospace' : 'inherit',
                                      lineHeight:1.5 }}>{f.value}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
