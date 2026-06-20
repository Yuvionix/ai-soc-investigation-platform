import React, { useState, useEffect } from 'react';
import { api, downloadCsv } from '../api/apiClient';

const SEV = { critical:'#ef4444', high:'#f97316', medium:'#eab308', low:'#22c55e' };
const STS = { open:'#ef4444', investigating:'#eab308', resolved:'#22c55e' };

export default function IncidentCorrelationView({ filters, userRole }) {
  const [incidents,    setIncidents]    = useState([]);
  const [selected,     setSelected]     = useState(null);
  const [correlation,  setCorrelation]  = useState(null);
  const [notes,        setNotes]        = useState([]);
  const [newNote,      setNewNote]      = useState('');
  const [loading,      setLoading]      = useState(true);
  const [corrLoading,  setCorrLoading]  = useState(false);
  const [statusMsg,    setStatusMsg]    = useState('');

  useEffect(() => { loadIncidents(); }, [filters]);

  const loadIncidents = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters?.severity) params.severity = filters.severity;
      if (filters?.status)   params.status   = filters.status;
      const r = await api.getIncidents(params);
      setIncidents(r.data || []);
    } catch { setIncidents([]); }
    finally  { setLoading(false); }
  };

  const selectIncident = async (inc) => {
    setSelected(inc); setCorrelation(null); setNotes([]);
    setCorrLoading(true);
    try {
      const [corrR, notesR] = await Promise.all([
        api.correlateIncident(inc.id),
        api.getIncidentNotes(inc.id),
      ]);
      setCorrelation(corrR.data);
      setNotes(notesR.data || []);
    } catch { setCorrelation(null); }
    finally { setCorrLoading(false); }
  };

  const doUpdate = async (id, patch) => {
    try {
      await api.updateIncident(id, patch);
      setIncidents(prev => prev.map(i => i.id===id ? {...i,...patch} : i));
      if (selected?.id===id) setSelected(p => ({...p,...patch}));
      setStatusMsg('✓ Updated'); setTimeout(() => setStatusMsg(''), 2000);
    } catch { setStatusMsg('Error'); }
  };

  const addNote = async () => {
    if (!newNote.trim() || !selected) return;
    try {
      const r = await api.addIncidentNote(selected.id, {
        author: userRole === 'Admin' ? 'SOC Admin' : 'L1 Analyst',
        note: newNote.trim(),
      });
      setNotes(prev => [r.data, ...prev]);
      setNewNote('');
    } catch { setStatusMsg('Error adding note'); }
  };

  const doExportCsv = async () => {
    try {
      const r = await api.exportIncidentsCsv();
      downloadCsv(r.data, 'soc_incidents.csv');
    } catch { alert('Export failed'); }
  };

  return (
    <div className="panel" style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:0, minHeight:460 }}>

      {/* Left: Incident list */}
      <div style={{ borderRight:'1px solid rgba(51,65,85,0.4)', padding:'1rem' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
          <h3 style={{ margin:0, fontSize:'0.95rem', color:'#f8fafc' }}>Incident Analysis</h3>
          <div style={{ display:'flex', gap:6 }}>
            {statusMsg && <span style={{ color:'#22c55e', fontSize:'0.75rem' }}>{statusMsg}</span>}
            <button onClick={doExportCsv} style={{
              fontSize:'0.7rem', padding:'3px 8px', borderRadius:5, cursor:'pointer',
              backgroundColor:'rgba(56,189,248,0.08)', color:'#38bdf8',
              border:'1px solid rgba(56,189,248,0.2)',
            }}>⬇ CSV</button>
          </div>
        </div>

        {loading ? (
          <div className="loading" style={{ padding:'1rem' }}>Loading incidents...</div>
        ) : incidents.length === 0 ? (
          <div style={{ color:'#475569', padding:'1rem', textAlign:'center', fontSize:'0.85rem' }}>
            No incidents match filters.
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:420, overflowY:'auto' }}>
            {incidents.map(inc => (
              <div key={inc.id}
                onClick={() => selectIncident(inc)}
                style={{
                  padding:'10px 12px', borderRadius:8, cursor:'pointer',
                  backgroundColor: selected?.id===inc.id ? 'rgba(56,189,248,0.08)' : 'rgba(15,23,42,0.5)',
                  border:`1px solid ${selected?.id===inc.id ? 'rgba(56,189,248,0.3)' : 'rgba(51,65,85,0.3)'}`,
                  borderLeft:`3px solid ${SEV[inc.severity]||'#475569'}`,
                  transition:'all 0.15s',
                }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ color:SEV[inc.severity], fontSize:'0.7rem', fontWeight:700,
                                 textTransform:'uppercase' }}>{inc.severity}</span>
                  <span style={{ color:STS[inc.status]||'#94a3b8', fontSize:'0.68rem' }}>{inc.status}</span>
                </div>
                <div style={{ color:'#e2e8f0', fontSize:'0.8rem', lineHeight:1.3, marginBottom:4 }}>
                  {inc.title}
                </div>
                <div style={{ color:'#475569', fontSize:'0.7rem' }}>
                  {new Date(inc.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Correlation + notes */}
      <div style={{ padding:'1rem', overflowY:'auto', maxHeight:600 }}>
        {!selected ? (
          <div style={{ textAlign:'center', padding:'3rem', color:'#334155' }}>
            <div style={{ fontSize:'2rem', marginBottom:8 }}>🔍</div>
            Select an incident to view deep-dive analysis.
          </div>
        ) : (
          <>
            {/* Incident header */}
            <div style={{ marginBottom:'1rem', paddingBottom:'1rem', borderBottom:'1px solid rgba(51,65,85,0.4)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <span style={{ fontSize:'0.72rem', color:SEV[selected.severity], fontWeight:700,
                                 textTransform:'uppercase', marginRight:8 }}>{selected.severity}</span>
                  <span style={{ fontSize:'0.72rem', color:STS[selected.status]||'#94a3b8' }}>{selected.status}</span>
                  <h4 style={{ margin:'6px 0 4px', color:'#f8fafc', fontSize:'0.95rem' }}>{selected.title}</h4>
                  <p style={{ color:'#94a3b8', fontSize:'0.82rem', margin:0, lineHeight:1.5 }}>{selected.description}</p>
                </div>
              </div>

              {/* Quick actions */}
              {selected.status !== 'resolved' && (
                <div style={{ display:'flex', gap:6, marginTop:10, flexWrap:'wrap' }}>
                  <button onClick={()=>doUpdate(selected.id,{status:'investigating'})}
                    disabled={selected.status==='investigating'}
                    style={{ fontSize:'0.75rem', padding:'4px 10px', borderRadius:5, cursor:'pointer',
                             backgroundColor:'rgba(234,179,8,0.1)', color:'#eab308',
                             border:'1px solid rgba(234,179,8,0.25)',
                             opacity:selected.status==='investigating'?0.4:1 }}>
                    🔍 Investigate
                  </button>
                  <button onClick={()=>doUpdate(selected.id,{status:'resolved'})}
                    style={{ fontSize:'0.75rem', padding:'4px 10px', borderRadius:5, cursor:'pointer',
                             backgroundColor:'rgba(34,197,94,0.1)', color:'#22c55e',
                             border:'1px solid rgba(34,197,94,0.25)' }}>
                    ✓ Resolve
                  </button>
                  {userRole==='Admin' && (
                    <button onClick={()=>alert('SOAR Playbook triggered for incident #'+selected.id)}
                      style={{ fontSize:'0.75rem', padding:'4px 10px', borderRadius:5, cursor:'pointer',
                               backgroundColor:'rgba(167,139,250,0.1)', color:'#a78bfa',
                               border:'1px solid rgba(167,139,250,0.25)' }}>
                      ⚡ SOAR Playbook
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Correlation results */}
            {corrLoading && <div className="loading">Correlating...</div>}
            {correlation && !corrLoading && (
              <div style={{ marginBottom:'1rem' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <div style={{ backgroundColor:'rgba(15,23,42,0.6)', borderRadius:8, padding:'10px',
                                border:'1px solid rgba(51,65,85,0.3)', textAlign:'center' }}>
                    <div style={{ color:'#94a3b8', fontSize:'0.68rem', textTransform:'uppercase', marginBottom:4 }}>
                      Confidence Score
                    </div>
                    <div style={{
                      fontSize:'1.6rem', fontWeight:800, fontFamily:'monospace',
                      color: correlation.correlation_score > 0.8 ? '#ef4444' :
                             correlation.correlation_score > 0.6 ? '#f97316' : '#eab308',
                    }}>
                      {Math.round(correlation.correlation_score * 100)}%
                    </div>
                  </div>
                  <div style={{ backgroundColor:'rgba(15,23,42,0.6)', borderRadius:8, padding:'10px',
                                border:'1px solid rgba(51,65,85,0.3)' }}>
                    <div style={{ color:'#94a3b8', fontSize:'0.68rem', textTransform:'uppercase', marginBottom:4 }}>
                      Attack Pattern
                    </div>
                    {(correlation.attack_pattern||[]).map((p,i) => (
                      <div key={i} style={{ color:'#f97316', fontSize:'0.73rem', marginBottom:2 }}>• {p}</div>
                    ))}
                  </div>
                </div>

                {/* AI analysis rules */}
                {(correlation.ai_analysis||[]).map((r,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between',
                                        backgroundColor:'rgba(56,189,248,0.04)',
                                        border:'1px solid rgba(56,189,248,0.1)',
                                        borderRadius:6, padding:'6px 10px', marginBottom:4 }}>
                    <span style={{ color:'#cbd5e1', fontSize:'0.78rem' }}>{r.rule}</span>
                    <span style={{ color:'#22c55e', fontSize:'0.75rem', fontFamily:'monospace', fontWeight:700 }}>{r.weight}</span>
                  </div>
                ))}

                {/* Timeline */}
                {correlation.timeline?.length > 0 && (
                  <div style={{ marginTop:10 }}>
                    <div style={{ color:'#475569', fontSize:'0.7rem', textTransform:'uppercase',
                                  letterSpacing:'0.06em', marginBottom:6 }}>Event Timeline</div>
                    {correlation.timeline.map((ev,i) => (
                      <div key={i} style={{ display:'flex', gap:10, marginBottom:6, alignItems:'flex-start' }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', backgroundColor:SEV[ev.severity]||'#475569',
                                      flexShrink:0, marginTop:4 }} />
                        <div>
                          <span style={{ color:SEV[ev.severity]||'#94a3b8', fontSize:'0.75rem', fontWeight:600 }}>
                            {ev.title}
                          </span>
                          <span style={{ color:'#475569', fontSize:'0.7rem', marginLeft:8 }}>
                            {new Date(ev.timestamp).toLocaleTimeString()}
                          </span>
                          <div style={{ color:'#64748b', fontSize:'0.72rem', marginTop:2 }}>{ev.description?.slice(0,80)}…</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Analyst Notes */}
            <div style={{ borderTop:'1px solid rgba(51,65,85,0.4)', paddingTop:'1rem' }}>
              <div style={{ color:'#94a3b8', fontSize:'0.78rem', fontWeight:600, marginBottom:8 }}>
                📝 Investigation Notes
              </div>
              <div style={{ display:'flex', gap:6, marginBottom:10 }}>
                <input
                  placeholder="Add investigation note…"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => e.key==='Enter' && addNote()}
                  style={{ flex:1, fontSize:'0.82rem' }}
                />
                <button onClick={addNote}
                  style={{ padding:'6px 14px', borderRadius:6, cursor:'pointer', fontSize:'0.82rem',
                           backgroundColor:'rgba(56,189,248,0.12)', color:'#38bdf8',
                           border:'1px solid rgba(56,189,248,0.3)' }}>
                  Add
                </button>
              </div>
              {notes.length === 0 ? (
                <div style={{ color:'#334155', fontSize:'0.78rem', fontStyle:'italic' }}>
                  No notes yet — add your investigation findings above.
                </div>
              ) : (
                notes.map((n,i) => (
                  <div key={i} style={{ backgroundColor:'rgba(15,23,42,0.5)',
                                        border:'1px solid rgba(51,65,85,0.3)',
                                        borderRadius:6, padding:'8px 12px', marginBottom:6 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ color:'#38bdf8', fontSize:'0.72rem', fontWeight:600 }}>{n.author}</span>
                      <span style={{ color:'#475569', fontSize:'0.7rem' }}>
                        {new Date(n.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ color:'#cbd5e1', fontSize:'0.8rem', lineHeight:1.5 }}>{n.note}</div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
