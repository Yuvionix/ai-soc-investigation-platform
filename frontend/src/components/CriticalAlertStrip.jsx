/**
 * Critical Alert Strip Component
 */
import React from 'react';

function CriticalAlertStrip({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <div className="panel critical-alert-strip">
      <h3 className="panel-title severity-critical">⚠️ Critical Alerts</h3>
      <div className="alert-list">
        {alerts.map((alert) => (
          <div key={alert.id} className="alert-item severity-critical">
            <div className="alert-title">{alert.title}</div>
            <div className="alert-time">{new Date(alert.created_at).toLocaleString()}</div>
            <div className="alert-source">{alert.source}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CriticalAlertStrip;
