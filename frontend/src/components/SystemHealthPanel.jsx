import React from 'react';

function SystemHealthPanel({ stats }) {
  if (!stats) return null;

  const isHealthy = stats.systemStatus.toLowerCase() === 'healthy';

  return (
    <div className="panel system-health-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <div>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Total Logs (24h)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f8fafc' }}>{stats.logsCount.toLocaleString()}</div>
        </div>
        
        <div style={{ width: '1px', height: '40px', backgroundColor: 'rgba(51, 65, 85, 0.5)' }}></div>

        <div>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Active Alerts</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#ef4444' }}>{stats.alertsCount.toLocaleString()}</div>
        </div>

        <div style={{ width: '1px', height: '40px', backgroundColor: 'rgba(51, 65, 85, 0.5)' }}></div>

        <div>
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Open Incidents</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: '#f97316' }}>{stats.incidentsCount}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.6)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid rgba(51, 65, 85, 0.5)' }}>
        <div className={`status-indicator ${isHealthy ? 'healthy' : 'error'}`}></div>
        <div style={{ textTransform: 'uppercase', fontWeight: 600, fontSize: '0.9rem', color: isHealthy ? '#22c55e' : '#ef4444' }}>
          {isHealthy ? 'System Online' : 'System Degraded'}
        </div>
      </div>

    </div>
  );
}

export default SystemHealthPanel;
