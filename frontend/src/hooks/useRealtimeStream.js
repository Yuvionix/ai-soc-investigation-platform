/**
 * useRealtimeStream  (SECURITY PATCHED)
 * =======================================
 * FIXES:
 *  - WebSocket URL now includes ?token=<jwt> for server-side authentication.
 *  - If no token is present the hook skips connecting entirely.
 *  - On 4001 close code (auth failure) it clears the session and redirects to login.
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const WS_BASE       = (process.env.REACT_APP_WS_URL || 'ws://127.0.0.1:8000') + '/ws';
const MAX_ITEMS       = 200;
const MAX_RECONNECT   = 10;
const INITIAL_BACKOFF = 1;

export function useRealtimeStream() {
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [streamLogs,    setStreamLogs]    = useState([]);
  const [streamPackets, setStreamPackets] = useState([]);
  const [streamThreats, setStreamThreats] = useState([]);
  const [lastEvent,     setLastEvent]     = useState(null);

  const wsRef      = useRef(null);
  const backoffRef = useRef(INITIAL_BACKOFF);
  const mountedRef = useRef(true);

  const _push = useCallback((setter, item) => {
    setter(prev => {
      const next = [item, ...prev];
      return next.length > MAX_ITEMS ? next.slice(0, MAX_ITEMS) : next;
    });
  }, []);

  const setFilter = useCallback((severity) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'filter', severity }));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Require token — skip if not authenticated
    const token = localStorage.getItem('soc_token');
    if (!token) {
      setConnectionStatus('disconnected');
      return;
    }

    setConnectionStatus('connecting');
    // Pass JWT as query param — the only mechanism available for WS browser clients
    const ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      backoffRef.current = INITIAL_BACKOFF;
      setConnectionStatus('connected');
    };

    ws.onmessage = (msg) => {
      if (!mountedRef.current) return;
      try {
        const event = JSON.parse(msg.data);
        setLastEvent(event);

        switch (event.type || event.event_type) {
          case 'host_log':
            _push(setStreamLogs, { ...event, id: Date.now() + Math.random() });
            break;
          case 'packet':
            _push(setStreamPackets, { ...event, id: Date.now() + Math.random() });
            break;
          case 'threat':
            _push(setStreamThreats, { ...event, id: Date.now() + Math.random() });
            _push(setStreamLogs,    { ...event, id: Date.now() + Math.random() });
            break;
          case 'error':
            // Server rejected the connection (e.g. auth failure)
            console.error('WS server error:', event.detail);
            break;
          default:
            break;
        }
      } catch (e) {
        // ignore malformed frames
      }
    };

    ws.onclose = (ev) => {
      if (!mountedRef.current) return;
      setConnectionStatus('disconnected');

      // Code 4001 = auth failure — don't retry, redirect to login
      if (ev.code === 4001) {
        localStorage.removeItem('soc_token');
        localStorage.removeItem('soc_user');
        window.location.href = '/login';
        return;
      }

      const delay = Math.min(backoffRef.current, MAX_RECONNECT);
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_RECONNECT);
      setTimeout(connect, delay * 1000);
    };

    ws.onerror = () => { ws.close(); };
  }, [_push]);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return {
    connectionStatus,
    streamLogs,
    streamPackets,
    streamThreats,
    lastEvent,
    setFilter,
  };
}
