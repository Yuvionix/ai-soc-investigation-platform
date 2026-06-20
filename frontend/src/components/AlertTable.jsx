import React, { useState, useEffect } from 'react';
import { api, downloadCsv } from '../api/apiClient';
import Modal from './Modal';
import IPReputationBadge from './IPReputationBadge';

const SEV_COLOR   = { critical:'#ef4444', high:'#f97316', medium:'#eab308', low:'#22c55e' };
const STATUS_COLOR = { open:'#ef4444', investigating:'#eab308', closed:'#22c55e', resolved:'#22c55e' };

function AlertTable({ filters, userRole }) {
  const [alerts, setAlerts]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [sortConfig, setSortConfig]   = useState({ key:'created_at', direction:'desc' });
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [actionMsg, setActionMsg]     = useState('');

  useEffect(() => { loadAlerts(); }, [filters]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters?.severity) params.severity = filters.severity;
      if (filters?.status)   params.status   = filters.status;
      if (filters?.source)   params.source   = filters.source;
      const r = await api.getAlerts(params);
      setAlerts(r.data || []);
    } catch { setAlerts([]); }
    finally { setLoading(false); }
  };

  const handleSort = key =>
    setSortConfig(p => ({ key, direction: p.key===key && p.direction==='asc' ? 'desc' : 'asc' }));

  const timeRangeMs = { '1h':3600000,'24h':86400000,'7d':604800000,'30d':2592000000 };
  const cutoff = filters?.timeRange ? Date.now() - (timeRangeMs[filters.timeRange]||Infinity) : 0;

  const filtered = [...alerts]
    .filter(a => {
      if (cutoff && new Date(a.created_at).getTime() < cutoff) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (a.title||'').toLowerCase().includes(q)
          || (a.source||'').toLowerCase().includes(q)
          || (a.ip_address||'').includes(q);
    })
    .sort((a,b) => {
      const av=a[sortConfig.key], bv=b[sortConfig.key];
      if (av<bv) return sortConfig.direction==='asc'?-1:1;
      if (av>bv) return sortConfig.direction==='asc'?1:-1;
      return 0;
    });

  const doUpdate = async (id, patch) => {
    try {
      await api.updateAlert(id, patch);
      setAlerts(prev => prev.map(a => a.id===id ? {...a,...patch} : a));
      if (selectedAlert?.id===id) setSelectedAlert(p => ({...p,...patch}));
      setActionMsg('✓ Updated');
      setTimeout(() => setActionMsg(''), 2000);
    } catch { setActionMsg('Error updating'); }
  };

  const doEscalate = async (id) => {
    try {
      const r = await api.escalateAlert(id);
      setActionMsg(`✓ Escalated → Incident #${r.data.incident_id}`);
      await doUpdate(id, { status:'investigating' });
      setTimeout(() => setActionMsg(''), 3000);
    } catch { setActionMsg('Error escalating'); }
  };

  const doExportCsv = async () => {
    try {
      const r = await api.exportAlertsCsv();
      downloadCsv(r.data, 'soc_alerts.csv');
    } catch { alert('Export failed'); }
  };

  return (
    <div className="panel alert-table-panel">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem', flexWrap:'wrap', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <h3 className="panel-title" style={{ margin:0, border:'none' }}>Active Alerts</h3>
          <span style={{ fontSize:'0.75rem', padding:'2px 8px', borderRadius:10,
                         backgroundColor:'rgba(239,68,68,0.1)', color:'#ef4444',
                         border:'1px solid rgba(239,68,68,0.25)' }}>
            {filtered.length} alerts
          </span>
          {actionMsg && (
            <span style={{ fontSize:'0.78rem', color:'#22c55e', fontWeight:600 }}>{actionMsg}</span>
          )}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input placeholder="Search…" value={searchTerm}
            onChange={e=>setSearchTerm(e.target.value)}
            style={{ width:220, fontSize:'0.85rem' }} />
          <button onClick={doExportCsv} style={{
            fontSize:'0.78rem', padding:'4px 12px', borderRadius:6, cursor:'pointer',
            backgroundColor:'rgba(56,189,248,0.1)', color:'#38bdf8',
            border:'1px solid rgba(56,189,248,0.25)',
          }}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      <div style={{ maxHeight:'420px', overflowY:'auto' }}>
        <table className="data-table">
          <thead style={{ position:'sticky', top:0, backgroundColor:'rgba(30,41,59,1)', zIndex:10 }}>
            <tr>
              {[['severity','Severity'],['title','Title'],['source','Source'],['ip_address','Src IP'],['created_at','Time'],['status','Status'],['','Actions']].map(([k,l]) => (
                <th key={k} onClick={k?()=>handleSort(k):undefined}
                    style={{ cursor:k?'pointer':'default', whiteSpace:'nowrap', userSelect:'none' }}>
                  {l}{sortConfig.key===k?(sortConfig.direction==='asc'?' ↑':' ↓'):''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="loading">Loading alerts...</td></tr>
            ) : filtered.length===0 ? (
              <tr><td colSpan="7" style={{ textAlign:'center', padding:'2rem', color:'#475569' }}>
                No alerts match current filters.
              </td></tr>
            ) : filtered.map(alert => (
              <tr key={alert.id}
                  style={{ borderLeft:`2px solid ${SEV_COLOR[alert.severity]||'#475569'}30`,
                           opacity: alert.status==='closed' ? 0.55 : 1 }}>
                <td>
                  <span style={{ padding:'2px 8px', borderRadius:4, fontSize:'0.73rem', fontWeight:700,
                                 backgroundColor:`${SEV_COLOR[alert.severity]||'#475569'}15`,
                                 color:SEV_COLOR[alert.severity]||'#94a3b8',
                                 border:`1px solid ${SEV_COLOR[alert.severity]||'#475569'}25` }}>
                    {alert.severity?.toUpperCase()}
                  </span>
                </td>
                <td style={{ fontWeight:500, color:'#f8fafc', cursor:'pointer', maxWidth:260 }}
                    onClick={()=>setSelectedAlert(alert)}>
                  {alert.title}
                </td>
                <td style={{ color:'#94a3b8', fontSize:'0.82rem' }}>{alert.source}</td>
                <td className="code-font" style={{ color:'#a78bfa', fontSize:'0.8rem' }}>
                  {alert.ip_address||'—'}
                </td>
                <td style={{ color:'#64748b', fontSize:'0.78rem', whiteSpace:'nowrap' }}>
                  {new Date(alert.created_at).toLocaleTimeString()}
                </td>
                <td>
                  <span style={{ padding:'2px 8px', borderRadius:4, fontSize:'0.72rem',
                                 color:STATUS_COLOR[alert.status]||'#94a3b8',
                                 backgroundColor:`${STATUS_COLOR[alert.status]||'#94a3b8'}12` }}>
                    {alert.status}
                  </span>
                </td>
                <td style={{ whiteSpace:'nowrap' }}>
                  {alert.status !== 'closed' && (
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={()=>doUpdate(alert.id,{status:'investigating'})}
                        disabled={alert.status==='investigating'}
                        style={{ fontSize:'0.68rem', padding:'2px 7px', borderRadius:4, cursor:'pointer',
                                 backgroundColor:'rgba(234,179,8,0.1)', color:'#eab308',
                                 border:'1px solid rgba(234,179,8,0.25)',
                                 opacity:alert.status==='investigating'?0.4:1 }}>
                        Ack
                      </button>
                      <button onClick={()=>doUpdate(alert.id,{status:'closed'})}
                        style={{ fontSize:'0.68rem', padding:'2px 7px', borderRadius:4, cursor:'pointer',
                                 backgroundColor:'rgba(34,197,94,0.1)', color:'#22c55e',
                                 border:'1px solid rgba(34,197,94,0.25)' }}>
                        Close
                      </button>
                      {userRole==='Admin' && (
                        <button onClick={()=>doEscalate(alert.id)}
                          style={{ fontSize:'0.68rem', padding:'2px 7px', borderRadius:4, cursor:'pointer',
                                   backgroundColor:'rgba(239,68,68,0.1)', color:'#ef4444',
                                   border:'1px solid rgba(239,68,68,0.25)' }}>
                          ↑ Inc
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      <Modal isOpen={!!selectedAlert} onClose={()=>setSelectedAlert(null)} title="Alert Analysis">
        {selectedAlert && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'1.5rem',
                          paddingBottom:'1rem', borderBottom:'1px solid rgba(51,65,85,0.5)' }}>
              <div>
                <span style={{ padding:'2px 8px', borderRadius:4, fontSize:'0.75rem', fontWeight:700,
                               backgroundColor:`${SEV_COLOR[selectedAlert.severity]}15`,
                               color:SEV_COLOR[selectedAlert.severity] }}>
                  {selectedAlert.severity?.toUpperCase()}
                </span>
                <h3 style={{ margin:'8px 0 0', color:'#f8fafc', fontSize:'1rem' }}>{selectedAlert.title}</h3>
              </div>
              <div style={{ textAlign:'right', color:'#64748b', fontSize:'0.8rem' }}>
                {new Date(selectedAlert.created_at).toLocaleString()}
              </div>
            </div>

            <p style={{ color:'#94a3b8', lineHeight:1.6, marginBottom:'1rem' }}>{selectedAlert.description}</p>

            {selectedAlert.ip_address && (
              <IPReputationBadge ip={selectedAlert.ip_address} />
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', margin:'1rem 0' }}>
              <div style={{ backgroundColor:'rgba(15,23,42,0.5)', padding:'0.75rem', borderRadius:8,
                            border:'1px solid rgba(51,65,85,0.3)' }}>
                <div style={{ color:'#64748b', fontSize:'0.72rem', textTransform:'uppercase', marginBottom:6 }}>Source</div>
                <div style={{ color:'#38bdf8', fontWeight:500 }}>{selectedAlert.source}</div>
                <div style={{ color:'#475569', fontSize:'0.78rem', marginTop:4 }}>
                  Type: <span className="code-font">{selectedAlert.alert_type}</span>
                </div>
              </div>
              <div style={{ backgroundColor:'rgba(15,23,42,0.5)', padding:'0.75rem', borderRadius:8,
                            border:'1px solid rgba(51,65,85,0.3)' }}>
                <div style={{ color:'#64748b', fontSize:'0.72rem', textTransform:'uppercase', marginBottom:6 }}>Status</div>
                <div style={{ color:STATUS_COLOR[selectedAlert.status], fontWeight:600 }}>
                  {selectedAlert.status?.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Action buttons in modal */}
            {selectedAlert.status !== 'closed' && (
              <div style={{ display:'flex', gap:8, marginBottom:'1rem', flexWrap:'wrap' }}>
                <button onClick={()=>doUpdate(selectedAlert.id,{status:'investigating'})}
                  style={{ backgroundColor:'rgba(234,179,8,0.1)', color:'#eab308',
                           border:'1px solid rgba(234,179,8,0.3)', borderRadius:6,
                           padding:'6px 14px', cursor:'pointer', fontSize:'0.82rem' }}>
                  🔍 Acknowledge
                </button>
                <button onClick={()=>doUpdate(selectedAlert.id,{status:'closed'})}
                  style={{ backgroundColor:'rgba(34,197,94,0.1)', color:'#22c55e',
                           border:'1px solid rgba(34,197,94,0.3)', borderRadius:6,
                           padding:'6px 14px', cursor:'pointer', fontSize:'0.82rem' }}>
                  ✓ Close Alert
                </button>
                {userRole==='Admin' && (
                  <button onClick={()=>doEscalate(selectedAlert.id)}
                    style={{ backgroundColor:'rgba(239,68,68,0.1)', color:'#ef4444',
                             border:'1px solid rgba(239,68,68,0.3)', borderRadius:6,
                             padding:'6px 14px', cursor:'pointer', fontSize:'0.82rem' }}>
                    ↑ Escalate to Incident
                  </button>
                )}
                {selectedAlert.ip_address && userRole==='Admin' && (
                  <button onClick={()=>alert(`Blocking ${selectedAlert.ip_address} at edge firewall...`)}
                    style={{ backgroundColor:'rgba(239,68,68,0.07)', color:'#ef4444',
                             border:'1px solid rgba(239,68,68,0.2)', borderRadius:6,
                             padding:'6px 14px', cursor:'pointer', fontSize:'0.82rem' }}>
                    🚫 Block IP
                  </button>
                )}
              </div>
            )}

            <div>
              <h4 style={{ margin:'0 0 8px', color:'#64748b', fontSize:'0.75rem', textTransform:'uppercase' }}>
                Raw Payload
              </h4>
              <pre style={{ backgroundColor:'#0f172a', padding:'1rem', borderRadius:8,
                            fontFamily:'"Fira Code",monospace', fontSize:'0.78rem', color:'#a5b4fc',
                            overflowX:'auto', border:'1px solid rgba(51,65,85,0.3)', margin:0,
                            maxHeight:200, overflowY:'auto' }}>
                {JSON.stringify(selectedAlert, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AlertTable;
