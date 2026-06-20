import React, { useState, useEffect, useRef } from 'react';
import { useAuth }                    from '../context/AuthContext';
import SystemHealthPanel              from '../components/SystemHealthPanel';
import GlobalFilterPanel              from '../components/GlobalFilterPanel';
import AlertTable                     from '../components/AlertTable';
import SecurityOverview               from '../components/SecurityOverview';
import IncidentCorrelationView        from '../components/IncidentCorrelationView';
import LiveLogTerminal                from '../components/LiveLogTerminal';
import LivePacketTable                from '../components/LivePacketTable';
import { ThreatFeedPanel, ThreatToastContainer } from '../components/ThreatAlertFeed';
import ConnectionMonitorPanel         from '../components/ConnectionMonitorPanel';
import SOCMetricsPanel                from '../components/SOCMetricsPanel';
import GeoIPMap                       from '../components/GeoIPMap';
import WSReconnectBanner              from '../components/WSReconnectBanner';
import ThreatHuntingPanel             from '../components/ThreatHuntingPanel';
import { useRealtimeStream }          from '../hooks/useRealtimeStream';
import { api }                        from '../api/apiClient';

export default function Dashboard() {
  const { user }                    = useAuth();
  const userRole                    = user?.role || 'Analyst';

  const [filters,       setFilters]       = useState({});
  const [loading,       setLoading]       = useState(true);
  const [lastUpdated,   setLastUpdated]   = useState(new Date());
  const [activeTab,     setActiveTab]     = useState('overview');
  const [alertStats,    setAlertStats]    = useState(null);
  const [incidentStats, setIncidentStats] = useState(null);
  const [allAlerts,     setAllAlerts]     = useState([]);
  const [autoRefresh,   setAutoRefresh]   = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [baseStats, setBaseStats] = useState({ dbLogs:0, alertsCount:0, incidentsCount:0 });
  const intervalRef = useRef(null);

  const { connectionStatus, streamLogs, streamPackets, streamThreats, setFilter: setWsFilter }
    = useRealtimeStream();

  const totalLogs    = baseStats.dbLogs + streamLogs.length;
  const systemStatus = connectionStatus==='connected' ? 'Healthy'
                     : connectionStatus==='connecting' ? 'Connecting' : 'Degraded';
  const dashboardStats = { logsCount:totalLogs, alertsCount:baseStats.alertsCount,
                            incidentsCount:baseStats.incidentsCount, systemStatus };

  useEffect(() => {
    loadData(true);
    if (autoRefresh) {
      intervalRef.current = setInterval(() => loadData(false), refreshInterval * 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [filters, autoRefresh, refreshInterval]);

  const loadData = async (showLoader=true) => {
    try {
      if (showLoader) setLoading(true);
      const [ls,as,is,al] = await Promise.all([
        api.getLogStats(), api.getAlertStats(), api.getIncidentStats(),
        api.getAlerts({ limit:100 }),
      ]);
      setBaseStats({ dbLogs:ls.data.total_logs||0, alertsCount:as.data.total_alerts||0, incidentsCount:is.data.total_incidents||0 });
      setAlertStats(as.data); setIncidentStats(is.data);
      setAllAlerts(al.data||[]);
      setLastUpdated(new Date());
    } catch {}
    finally { if (showLoader) setLoading(false); }
  };

  if (loading) return (
    <div className="dashboard-container" style={{ display:'flex', flexDirection:'column', gap:'1.5rem', opacity:0.5 }}>
      <div style={{ height:80, backgroundColor:'#1e293b', borderRadius:8 }} className="skeleton-pulse" />
      <div style={{ height:300, backgroundColor:'#1e293b', borderRadius:8 }} className="skeleton-pulse" />
      <div className="loading">Loading SIEM Dashboard...</div>
    </div>
  );

  const wsColor = connectionStatus==='connected'?'#22c55e':connectionStatus==='connecting'?'#eab308':'#ef4444';
  const TABS = [
    { id:'overview', label:'📊 Overview'  },
    { id:'hunt',     label:'🔎 Hunt'      },
    { id:'metrics',  label:'📈 Metrics'   },
    { id:'live',     label:'📟 Live Logs' },
    { id:'network',  label:`🔍 Network${streamPackets.length>0?` (${streamPackets.length})`:''}` },
    { id:'threats',  label:`⚠️ Threats${streamThreats.length>0?` (${streamThreats.length})`:''}` },
  ];

  return (
    <>
      <ThreatToastContainer threats={streamThreats} />
      <WSReconnectBanner connectionStatus={connectionStatus} />

      <div className="dashboard-container" style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>

        {/* Top bar */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
                      backgroundColor:'#1e293b', padding:'0.75rem 1.5rem',
                      borderRadius:8, border:'1px solid rgba(51,65,85,0.5)', flexWrap:'wrap', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:'0.75rem', color:wsColor, border:`1px solid ${wsColor}`,
                           padding:'0.15rem 0.5rem', borderRadius:10,
                           display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:5, height:5, borderRadius:'50%', backgroundColor:wsColor, display:'inline-block' }} />
              {connectionStatus.toUpperCase()}
            </span>
            <span style={{ color:'#64748b', fontSize:'0.8rem' }}>Updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
          {/* Auto-refresh control */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, color:'#94a3b8', fontSize:'0.78rem', cursor:'pointer' }}>
              <input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)}
                     style={{ accentColor:'#38bdf8' }} />
              Auto-refresh
            </label>
            {autoRefresh && (
              <select value={refreshInterval} onChange={e=>setRefreshInterval(Number(e.target.value))}
                style={{ fontSize:'0.75rem', padding:'3px 6px', width:'auto' }}>
                <option value={5}>5s</option>
                <option value={15}>15s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
              </select>
            )}
            <button onClick={()=>loadData(false)} style={{
              fontSize:'0.75rem', padding:'4px 10px', borderRadius:6, cursor:'pointer',
              backgroundColor:'rgba(56,189,248,0.1)', color:'#38bdf8',
              border:'1px solid rgba(56,189,248,0.25)',
            }}>↻ Refresh</button>
          </div>
        </div>

        {/* Stats + connection monitor */}
        <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 280px', gap:'1.5rem', alignItems:'start' }}>
          <div style={{ display:'flex', flexDirection:'column', gap:'1.5rem' }}>
            <SystemHealthPanel stats={dashboardStats} />
            <GlobalFilterPanel onFilterChange={f=>setFilters({...filters,...f})} />
          </div>
          <ConnectionMonitorPanel connectionStatus={connectionStatus} streamLogs={streamLogs}
            streamPackets={streamPackets} streamThreats={streamThreats} setFilter={setWsFilter} />
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:2, borderBottom:'1px solid rgba(51,65,85,0.5)', flexWrap:'wrap' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{
              padding:'8px 16px', fontSize:'0.82rem', cursor:'pointer', border:'none',
              borderRadius:'8px 8px 0 0', transition:'all 0.15s',
              backgroundColor: activeTab===tab.id ? '#1e293b' : 'transparent',
              color: activeTab===tab.id ? '#f8fafc' : '#64748b',
              borderBottom: activeTab===tab.id ? '2px solid #38bdf8' : '2px solid transparent',
              fontWeight: activeTab===tab.id ? 600 : 400,
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab==='overview' && (
          <>
            <SecurityOverview filters={filters} />
            <GeoIPMap alerts={allAlerts} />
            <AlertTable filters={filters} userRole={userRole} />
            <IncidentCorrelationView filters={filters} userRole={userRole} />
          </>
        )}
        {activeTab==='hunt'    && <ThreatHuntingPanel />}
        {activeTab==='metrics' && <SOCMetricsPanel alertStats={alertStats} incidentStats={incidentStats} />}
        {activeTab==='live'    && <LiveLogTerminal logs={streamLogs} title="Live Host Log Stream" />}
        {activeTab==='network' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {streamPackets.length===0 && (
              <div style={{ backgroundColor:'rgba(234,179,8,0.07)', border:'1px solid rgba(234,179,8,0.3)',
                            borderRadius:8, padding:'10px 16px', color:'#eab308', fontSize:'0.83rem' }}>
                ⚠️ Run backend with <code style={{ backgroundColor:'rgba(0,0,0,0.3)', padding:'1px 5px', borderRadius:3 }}>sudo</code>{' '}
                and install <code style={{ backgroundColor:'rgba(0,0,0,0.3)', padding:'1px 5px', borderRadius:3 }}>scapy</code>{' '}
                for full packet capture. macOS: connections appear as established.
              </div>
            )}
            <LivePacketTable packets={streamPackets} />
          </div>
        )}
        {activeTab==='threats' && <ThreatFeedPanel threats={streamThreats} />}
      </div>
    </>
  );
}
