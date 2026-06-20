import React, { useRef, useState } from 'react';

const ALLOWED = ['json','csv','txt','log'];
const MODELS  = [
  { id:'llama3',  name:'Llama 3',  tag:'Best'  },
  { id:'mistral', name:'Mistral',  tag:'Fast'  },
  { id:'qwen',    name:'Qwen',     tag:'Multi' },
  { id:'gemma2',  name:'Gemma 2',  tag:''      },
  { id:'phi3',    name:'Phi-3',    tag:'Small' },
];

export default function UploadCenter({ onUpload, loading, aiStatus }) {
  const [dragging, setDragging] = useState(false);
  const [model,    setModel]    = useState('llama3');
  const [err,      setErr]      = useState('');
  const inputRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED.includes(ext)) {
      setErr(`".${ext}" not supported. Use: ${ALLOWED.join(', ')}`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) { setErr('Max file size is 10 MB.'); return; }
    setErr('');
    onUpload(file, model);
  };

  return (
    <div>
      {/* Model selector */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize:'0.65rem', color:'#475569', textTransform:'uppercase',
                      letterSpacing:'.08em', marginBottom:6, fontWeight:600 }}>
          AI Model
        </div>
        <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
          {MODELS.map(m => (
            <button key={m.id} onClick={() => setModel(m.id)} style={{
              padding:'4px 10px', borderRadius:16, fontSize:'0.7rem',
              cursor:'pointer', transition:'all .15s', fontWeight:500,
              background: model===m.id ? 'rgba(56,189,248,0.12)' : 'rgba(15,23,42,0.5)',
              border:`1px solid ${model===m.id ? 'rgba(56,189,248,0.4)' : 'rgba(51,65,85,0.4)'}`,
              color: model===m.id ? '#38bdf8' : '#475569',
            }}>
              {m.name}
              {m.tag && (
                <span style={{
                  marginLeft:4, fontSize:'0.58rem', padding:'1px 4px', borderRadius:4,
                  background:'rgba(56,189,248,0.1)', color:'#38bdf8',
                }}>{m.tag}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => !loading && inputRef.current.click()}
        onDragOver={e  => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        style={{
          border:`1.5px dashed ${dragging ? '#38bdf8' : 'rgba(51,65,85,0.5)'}`,
          borderRadius:10, padding:'1.4rem 1rem', textAlign:'center',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: dragging
            ? 'rgba(56,189,248,0.06)'
            : loading ? 'rgba(15,23,42,0.3)' : 'rgba(15,23,42,0.4)',
          transition:'all .2s', opacity: loading ? 0.7 : 1,
        }}
      >
        <div style={{ fontSize:'1.6rem', marginBottom:6 }}>
          {loading ? '⏳' : '📂'}
        </div>
        <div style={{ fontSize:'0.8rem', fontWeight:500, color:'#94a3b8', marginBottom:4 }}>
          {loading ? 'Analysing…' : 'Drop file or click'}
        </div>
        <div style={{ fontSize:'0.68rem', color:'#334155' }}>
          JSON · CSV · TXT · LOG · max 10 MB
        </div>
      </div>

      <input ref={inputRef} type="file" accept=".json,.csv,.txt,.log"
        style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />

      {err && (
        <div style={{
          marginTop:8, padding:'7px 10px', borderRadius:7, fontSize:'0.72rem',
          background:'rgba(239,68,68,0.08)', color:'#fca5a5',
          border:'1px solid rgba(239,68,68,0.2)',
        }}>⚠ {err}</div>
      )}

      {aiStatus && !aiStatus.running && (
        <div style={{
          marginTop:8, padding:'6px 10px', borderRadius:7, fontSize:'0.7rem',
          background:'rgba(249,115,22,0.06)', color:'#f97316',
          border:'1px solid rgba(249,115,22,0.15)',
        }}>
          ⚠ Ollama offline — rule-based fallback active
        </div>
      )}
    </div>
  );
}
