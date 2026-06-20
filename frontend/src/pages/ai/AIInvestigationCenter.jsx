import React, { useState, useEffect } from 'react';
import { aiApi }            from '../../api/aiClient';
import UploadCenter         from '../../components/ai/UploadCenter';
import AnalysisResults      from '../../components/ai/AnalysisResults';
import AttackTimeline       from '../../components/ai/AttackTimeline';
import AttackStory          from '../../components/ai/AttackStory';
import MitrePanel           from '../../components/ai/MitrePanel';
import RecommendationsPanel from '../../components/ai/RecommendationsPanel';
import IncidentChat         from '../../components/ai/IncidentChat';
import ReportGenerator      from '../../components/ai/ReportGenerator';

const TABS = [
  { id:'overview',    label:'Analysis',     icon:'🔬' },
  { id:'timeline',    label:'Timeline',     icon:'📅' },
  { id:'story',       label:'Attack Story', icon:'📖' },
  { id:'mitre',       label:'MITRE',        icon:'🎯' },
  { id:'remediation', label:'Remediation',  icon:'🛡️' },
  { id:'chat',        label:'AI Chat',      icon:'💬' },
  { id:'report',      label:'Report',       icon:'📄' },
];

const SEV_GRADIENT = {
  critical: 'linear-gradient(135deg,rgba(239,68,68,0.15),rgba(239,68,68,0.05))',
  high:     'linear-gradient(135deg,rgba(249,115,22,0.15),rgba(249,115,22,0.05))',
  medium:   'linear-gradient(135deg,rgba(234,179,8,0.12),rgba(234,179,8,0.04))',
  low:      'linear-gradient(135deg,rgba(34,197,94,0.12),rgba(34,197,94,0.04))',
};
const SEV_COLOR = { critical:'#ef4444', high:'#f97316', medium:'#eab308', low:'#22c55e' };

export default function AIInvestigationCenter() {
  const [aiStatus,      setAiStatus]      = useState(null);
  const [investigation, setInvestigation] = useState(null);
  const [sessionId,     setSessionId]     = useState(null);
  const [selectedModel, setSelectedModel] = useState('llama3');
  const [activeTab,     setActiveTab]     = useState('overview');
  const [uploading,     setUploading]     = useState(false);
  const [uploadError,   setUploadError]   = useState('');
  const [sessions,      setSessions]      = useState([]);
  const [progress,      setProgress]      = useState(0);

  useEffect(() => {
    aiApi.status().then(r => setAiStatus(r.data)).catch(() => setAiStatus({ running: false }));
    aiApi.sessions().then(r => setSessions(r.data)).catch(() => {});
  }, []);

  // Fake progress bar during upload
  useEffect(() => {
    if (!uploading) { setProgress(0); return; }
    setProgress(5);
    const steps = [20,40,55,68,78,86,92,96];
    const timers = steps.map((p, i) => setTimeout(() => setProgress(p), (i+1)*2500));
    return () => timers.forEach(clearTimeout);
  }, [uploading]);

  const handleUpload = async (file, model) => {
    setUploading(true); setUploadError('');
    setInvestigation(null); setSessionId(null);
    setSelectedModel(model);
    try {
      const form = new FormData();
      form.append('file', file); form.append('model', model);
      const { data } = await aiApi.upload(form);
      setInvestigation(data); setSessionId(data.session_id);
      setActiveTab('overview');
      aiApi.sessions().then(r => setSessions(r.data)).catch(() => {});
    } catch (e) {
      setUploadError(e.response?.data?.detail || e.message || 'Upload failed.');
    } finally { setUploading(false); }
  };

  const loadSession = async (sid) => {
    try {
      const { data } = await aiApi.getInvestigation(sid);
      setInvestigation(data); setSessionId(sid); setActiveTab('overview');
    } catch (e) { setUploadError('Could not load session.'); }
  };

  const sev      = investigation?.severity || 'low';
  const sevColor = SEV_COLOR[sev] || '#94a3b8';

  return (
    <div style={{
      minHeight: '100%', padding: '1.5rem',
      fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
      color: '#f8fafc',
    }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                    flexWrap:'wrap', gap:12, marginBottom:'1.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: 'linear-gradient(135deg,rgba(56,189,248,0.2),rgba(167,139,250,0.1))',
            border: '1px solid rgba(56,189,248,0.25)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem',
            flexShrink: 0,
          }}>🧠</div>
          <div>
            <h2 style={{ margin:0, fontSize:'1.3rem', fontWeight:700, letterSpacing:'-0.02em' }}>
              AI Investigation Center
            </h2>
            <p style={{ margin:0, fontSize:'0.78rem', color:'#64748b', marginTop:2 }}>
              Upload evidence → AI analyses → Explanation, story, MITRE mapping &amp; report
            </p>
          </div>
        </div>

        {/* Ollama status pill */}
        <div style={{
          display:'flex', alignItems:'center', gap:8, padding:'6px 14px',
          borderRadius:20, fontSize:'0.75rem', fontWeight:500,
          background: aiStatus?.running
            ? 'rgba(34,197,94,0.08)' : 'rgba(249,115,22,0.08)',
          border: `1px solid ${aiStatus?.running ? 'rgba(34,197,94,0.25)' : 'rgba(249,115,22,0.25)'}`,
          color: aiStatus?.running ? '#22c55e' : '#f97316',
        }}>
          <div style={{
            width:7, height:7, borderRadius:'50%',
            backgroundColor: aiStatus?.running ? '#22c55e' : '#f97316',
            boxShadow: `0 0 6px ${aiStatus?.running ? '#22c55e' : '#f97316'}`,
            animation: aiStatus?.running ? 'pulse-dot 2s ease infinite' : 'none',
          }} />
          {aiStatus?.running ? 'Ollama Online' : 'Ollama Offline — fallback active'}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:'1.25rem', alignItems:'start' }}>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem', position:'sticky', top:'1rem' }}>

          {/* Upload card */}
          <div style={{
            background:'rgba(15,23,42,0.7)', borderRadius:14,
            border:'1px solid rgba(51,65,85,0.4)',
            padding:'1.1rem', backdropFilter:'blur(10px)',
          }}>
            <div style={{ fontSize:'0.68rem', color:'#475569', textTransform:'uppercase',
                          letterSpacing:'.1em', fontWeight:600, marginBottom:12 }}>
              Upload Evidence
            </div>
            <UploadCenter onUpload={handleUpload} loading={uploading} aiStatus={aiStatus} />
            {uploadError && (
              <div style={{
                marginTop:10, padding:'8px 12px', borderRadius:8, fontSize:'0.75rem',
                background:'rgba(239,68,68,0.08)', color:'#fca5a5',
                border:'1px solid rgba(239,68,68,0.2)',
              }}>⚠ {uploadError}</div>
            )}
          </div>

          {/* Previous sessions */}
          {sessions.length > 0 && (
            <div style={{
              background:'rgba(15,23,42,0.7)', borderRadius:14,
              border:'1px solid rgba(51,65,85,0.4)', padding:'1.1rem',
            }}>
              <div style={{ fontSize:'0.68rem', color:'#475569', textTransform:'uppercase',
                            letterSpacing:'.1em', fontWeight:600, marginBottom:10 }}>
                Recent Sessions
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {sessions.slice(0,5).map(s => (
                  <button key={s.session_id} onClick={() => loadSession(s.session_id)} style={{
                    padding:'9px 10px', borderRadius:10, fontSize:'0.76rem', cursor:'pointer',
                    textAlign:'left', transition:'all .15s',
                    background: sessionId===s.session_id
                      ? 'rgba(56,189,248,0.08)' : 'rgba(15,23,42,0.5)',
                    border:`1px solid ${sessionId===s.session_id
                      ? 'rgba(56,189,248,0.3)' : 'rgba(51,65,85,0.35)'}`,
                  }}>
                    <div style={{ fontWeight:500, color:'#e2e8f0', marginBottom:3,
                                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {s.filename}
                    </div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <span style={{
                        fontSize:'0.65rem', padding:'1px 6px', borderRadius:5, fontWeight:600,
                        background:`${SEV_COLOR[s.severity] || '#94a3b8'}15`,
                        color: SEV_COLOR[s.severity] || '#94a3b8',
                        border:`1px solid ${SEV_COLOR[s.severity] || '#94a3b8'}30`,
                        textTransform:'uppercase',
                      }}>{s.severity}</span>
                      <span style={{ color:'#475569' }}>{s.event_count} events</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ollama setup guide */}
          {aiStatus && !aiStatus.running && (
            <div style={{
              background:'rgba(249,115,22,0.05)', borderRadius:14,
              border:'1px solid rgba(249,115,22,0.2)', padding:'1.1rem',
            }}>
              <div style={{ fontSize:'0.76rem', color:'#f97316', fontWeight:600, marginBottom:10 }}>
                🚀 Enable Full AI
              </div>
              {[
                { cmd:'brew install ollama', label:'Install' },
                { cmd:'ollama serve',        label:'Start'   },
                { cmd:'ollama pull llama3',  label:'Download model' },
              ].map(({ cmd, label }) => (
                <div key={cmd} style={{ marginBottom:7 }}>
                  <div style={{ fontSize:'0.65rem', color:'#64748b', marginBottom:3 }}>{label}</div>
                  <code style={{
                    display:'block', background:'rgba(15,23,42,0.7)',
                    padding:'5px 10px', borderRadius:6, color:'#22c55e',
                    fontSize:'0.72rem', fontFamily:'monospace',
                    border:'1px solid rgba(34,197,94,0.15)',
                  }}>{cmd}</code>
                </div>
              ))}
              {aiStatus?.installed_models?.length > 0 && (
                <div style={{ marginTop:8, fontSize:'0.72rem', color:'#22c55e' }}>
                  ✓ Models installed: {aiStatus.installed_models.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div style={{ minWidth:0 }}>

          {/* Empty state */}
          {!investigation && !uploading && (
            <div style={{
              background:'rgba(15,23,42,0.5)', borderRadius:16,
              border:'1px dashed rgba(51,65,85,0.5)',
              padding:'5rem 2rem', textAlign:'center',
              backdropFilter:'blur(10px)',
            }}>
              <div style={{ fontSize:'3rem', marginBottom:'1rem', opacity:.6 }}>🧠</div>
              <div style={{ fontSize:'1.1rem', fontWeight:600, color:'#94a3b8', marginBottom:8 }}>
                Ready to Investigate
              </div>
              <div style={{ fontSize:'0.82rem', color:'#475569', maxWidth:380,
                            margin:'0 auto', lineHeight:1.7 }}>
                Upload a security alert report, event log, or replay export.
                The AI will analyse it and deliver a full explanation, timeline,
                attack narrative, MITRE mapping, and remediation plan.
              </div>
              <div style={{ marginTop:'1.5rem', display:'flex', gap:8,
                            justifyContent:'center', flexWrap:'wrap' }}>
                {['JSON Alert Report','CSV Event Log','TXT System Log','Replay Export'].map(t => (
                  <span key={t} style={{
                    fontSize:'0.72rem', padding:'5px 12px', borderRadius:20,
                    background:'rgba(51,65,85,0.25)', color:'#475569',
                    border:'1px solid rgba(51,65,85,0.35)',
                  }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Upload progress */}
          {uploading && (
            <div style={{
              background:'rgba(15,23,42,0.7)', borderRadius:16,
              border:'1px solid rgba(56,189,248,0.15)', padding:'4rem 2rem',
              textAlign:'center', backdropFilter:'blur(10px)',
            }}>
              <div style={{ fontSize:'2.5rem', marginBottom:'1.2rem' }}>⚙️</div>
              <div style={{ fontSize:'1rem', fontWeight:600, color:'#94a3b8', marginBottom:6 }}>
                AI Investigation In Progress
              </div>
              <div style={{ fontSize:'0.8rem', color:'#475569', marginBottom:'2rem' }}>
                Parsing evidence, running AI analysis, mapping MITRE techniques…
              </div>
              {/* Progress bar */}
              <div style={{ width:'70%', margin:'0 auto', height:4,
                            background:'rgba(51,65,85,0.4)', borderRadius:4, overflow:'hidden' }}>
                <div style={{
                  height:'100%', borderRadius:4,
                  background:'linear-gradient(90deg,#38bdf8,#818cf8)',
                  width:`${progress}%`, transition:'width 1.5s ease',
                  boxShadow:'0 0 12px rgba(56,189,248,0.5)',
                }} />
              </div>
              <div style={{ marginTop:10, fontSize:'0.72rem', color:'#334155' }}>
                {progress < 40 ? 'Parsing evidence…'
                  : progress < 70 ? 'Running AI analysis…'
                  : progress < 90 ? 'Mapping MITRE techniques…'
                  : 'Finalising report…'}
              </div>
            </div>
          )}

          {/* Results */}
          {investigation && !uploading && (
            <div>
              {/* Summary banner */}
              <div style={{
                background: SEV_GRADIENT[sev] || 'rgba(15,23,42,0.6)',
                borderRadius:14, border:`1px solid ${sevColor}25`,
                padding:'1rem 1.25rem', marginBottom:'1rem',
                display:'flex', flexWrap:'wrap', gap:10, alignItems:'center',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:'1.2rem' }}>📁</span>
                  <span style={{ fontWeight:600, fontSize:'0.95rem', color:'#f8fafc' }}>
                    {investigation.filename}
                  </span>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{
                    fontSize:'0.68rem', padding:'2px 10px', borderRadius:8, fontWeight:700,
                    background:`${sevColor}18`, color:sevColor,
                    border:`1px solid ${sevColor}35`, textTransform:'uppercase', letterSpacing:'.05em',
                  }}>{sev}</span>
                  <span style={{ fontSize:'0.78rem', color:'#64748b' }}>
                    {investigation.event_count} events
                  </span>
                  <span style={{ color:'#334155' }}>·</span>
                  <span style={{ fontSize:'0.78rem', color:'#64748b' }}>
                    {(investigation.attack_types||[]).length} attack types
                  </span>
                  {investigation.timeline && (
                    <>
                      <span style={{ color:'#334155' }}>·</span>
                      <span style={{ fontSize:'0.75rem', color:'#475569', fontFamily:'monospace' }}>
                        {investigation.timeline}
                      </span>
                    </>
                  )}
                </div>
                <button onClick={() => { setInvestigation(null); setSessionId(null); }} style={{
                  marginLeft:'auto', padding:'5px 12px', borderRadius:8, fontSize:'0.75rem',
                  cursor:'pointer', background:'rgba(51,65,85,0.3)', color:'#64748b',
                  border:'1px solid rgba(51,65,85,0.4)',
                }}>← New Upload</button>
              </div>

              {/* Tabs */}
              <div style={{
                display:'flex', gap:2, marginBottom:'1rem', overflowX:'auto',
                background:'rgba(15,23,42,0.5)', borderRadius:12, padding:5,
                border:'1px solid rgba(51,65,85,0.3)',
              }}>
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                    padding:'7px 14px', borderRadius:9, fontSize:'0.78rem', fontWeight:500,
                    cursor:'pointer', border:'none', whiteSpace:'nowrap',
                    transition:'all .15s',
                    background: activeTab===tab.id
                      ? 'linear-gradient(135deg,rgba(56,189,248,0.15),rgba(129,140,248,0.1))'
                      : 'transparent',
                    color: activeTab===tab.id ? '#38bdf8' : '#475569',
                    boxShadow: activeTab===tab.id ? '0 0 0 1px rgba(56,189,248,0.2)' : 'none',
                    display:'flex', alignItems:'center', gap:5,
                  }}>
                    <span style={{ fontSize:'0.85rem' }}>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{
                background:'rgba(15,23,42,0.6)', borderRadius:14,
                border:'1px solid rgba(51,65,85,0.35)',
                padding:'1.25rem', backdropFilter:'blur(10px)',
                minHeight:400,
              }}>
                {activeTab==='overview'    && <AnalysisResults    investigation={investigation} />}
                {activeTab==='timeline'    && <AttackTimeline     events={investigation.events||[]} />}
                {activeTab==='story'       && <AttackStory        story={investigation.attack_story} />}
                {activeTab==='mitre'       && <MitrePanel         mitreMappings={investigation.mitre_mapping||[]} />}
                {activeTab==='remediation' && <RecommendationsPanel recommendations={investigation.recommendations||{}} />}
                {activeTab==='chat'   && sessionId && <IncidentChat sessionId={sessionId} model={selectedModel} />}
                {activeTab==='report' && sessionId && <ReportGenerator sessionId={sessionId} model={selectedModel} />}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%,100% { opacity:1; } 50% { opacity:.4; }
        }
      `}</style>
    </div>
  );
}
