import React, { useState, useRef, useEffect } from 'react';
import { aiApi } from '../../api/aiClient';

const QUICK = [
  'Was the attack successful?', 'What happened first?',
  'How dangerous was this?',    'Which host was targeted?',
  'What should I do next?',     'Explain the most critical alert.',
  'Were any credentials compromised?', 'What data may have been exposed?',
];

export default function IncidentChat({ sessionId, model = 'llama3' }) {
  const [messages, setMessages] = useState([{
    role:'assistant',
    content:'👋 I have analysed the uploaded evidence. Ask me anything about this incident.',
    ts: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
  }]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();
  const inputRef  = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages]);

  const send = async (q) => {
    const question = (q || input).trim();
    if (!question || loading) return;
    setInput('');
    const ts = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
    setMessages(prev => [...prev, { role:'user', content:question, ts }]);
    setLoading(true);
    try {
      const { data } = await aiApi.chat({ session_id:sessionId, question, model });
      setMessages(prev => [...prev, {
        role:'assistant', content:data.answer,
        ts: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role:'assistant',
        content:`⚠ Error: ${e.response?.data?.detail || e.message}`,
        ts: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:480 }}>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'4px 0',
                    display:'flex', flexDirection:'column', gap:10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display:'flex',
            flexDirection: m.role==='user' ? 'row-reverse' : 'row',
            alignItems:'flex-end', gap:8,
          }}>
            {/* Avatar */}
            <div style={{
              width:28, height:28, borderRadius:'50%', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8rem',
              background: m.role==='user'
                ? 'rgba(56,189,248,0.15)' : 'rgba(167,139,250,0.12)',
              border:`1px solid ${m.role==='user'
                ? 'rgba(56,189,248,0.25)' : 'rgba(167,139,250,0.2)'}`,
            }}>
              {m.role==='user' ? '👤' : '🧠'}
            </div>
            <div style={{ maxWidth:'76%' }}>
              <div style={{
                padding:'10px 13px', borderRadius:12, fontSize:'0.82rem',
                lineHeight:1.65, whiteSpace:'pre-wrap',
                background: m.role==='user'
                  ? 'rgba(56,189,248,0.1)' : 'rgba(30,41,59,0.8)',
                border:`1px solid ${m.role==='user'
                  ? 'rgba(56,189,248,0.2)' : 'rgba(51,65,85,0.4)'}`,
                color: m.role==='user' ? '#bae6fd' : '#cbd5e1',
                borderBottomRightRadius: m.role==='user' ? 3 : 12,
                borderBottomLeftRadius:  m.role==='user' ? 12 : 3,
              }}>
                {m.content}
              </div>
              {m.ts && (
                <div style={{
                  fontSize:'0.62rem', color:'#334155', marginTop:3,
                  textAlign: m.role==='user' ? 'right' : 'left',
                }}>{m.ts}</div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
            <div style={{
              width:28, height:28, borderRadius:'50%', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center',
              background:'rgba(167,139,250,0.12)', border:'1px solid rgba(167,139,250,0.2)',
              fontSize:'0.8rem',
            }}>🧠</div>
            <div style={{
              padding:'10px 16px', borderRadius:12, borderBottomLeftRadius:3,
              background:'rgba(30,41,59,0.8)', border:'1px solid rgba(51,65,85,0.4)',
              display:'flex', gap:4, alignItems:'center',
            }}>
              {[0,1,2].map(n => (
                <div key={n} style={{
                  width:6, height:6, borderRadius:'50%', backgroundColor:'#475569',
                  animation:`bounce 1.2s ease infinite`,
                  animationDelay:`${n*0.18}s`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      <div style={{
        padding:'8px 0', borderTop:'1px solid rgba(51,65,85,0.3)',
        display:'flex', gap:5, flexWrap:'wrap', margin:'8px 0',
      }}>
        {QUICK.map(q => (
          <button key={q} onClick={() => send(q)} disabled={loading} style={{
            padding:'3px 9px', borderRadius:12, fontSize:'0.68rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            background:'rgba(51,65,85,0.25)', color:'#64748b',
            border:'1px solid rgba(51,65,85,0.4)', opacity: loading ? 0.5 : 1,
            transition:'all .15s',
          }}
          onMouseEnter={e => { if (!loading) { e.target.style.background='rgba(51,65,85,0.4)'; e.target.style.color='#94a3b8'; }}}
          onMouseLeave={e => { e.target.style.background='rgba(51,65,85,0.25)'; e.target.style.color='#64748b'; }}
          >{q}</button>
        ))}
      </div>

      {/* Input row */}
      <div style={{ display:'flex', gap:8 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && !e.shiftKey && send()}
          placeholder="Ask anything about this incident…"
          disabled={loading}
          style={{
            flex:1, padding:'9px 14px', borderRadius:10, fontSize:'0.82rem',
            background:'rgba(15,23,42,0.8)', color:'#f8fafc', outline:'none',
            border:'1px solid rgba(51,65,85,0.5)', transition:'border-color .15s',
          }}
          onFocus={e => e.target.style.borderColor='rgba(56,189,248,0.4)'}
          onBlur={e  => e.target.style.borderColor='rgba(51,65,85,0.5)'}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{
          padding:'9px 18px', borderRadius:10, fontSize:'0.82rem', fontWeight:600,
          cursor:(loading||!input.trim()) ? 'not-allowed' : 'pointer',
          background:(loading||!input.trim())
            ? 'rgba(51,65,85,0.3)' : 'linear-gradient(135deg,#38bdf8,#0ea5e9)',
          color:(loading||!input.trim()) ? '#334155' : '#0f172a',
          border:'none', transition:'all .15s',
          boxShadow:(loading||!input.trim()) ? 'none' : '0 3px 10px rgba(56,189,248,0.25)',
        }}>
          Ask →
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%,80%,100% { transform:translateY(0);   }
          40%          { transform:translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
