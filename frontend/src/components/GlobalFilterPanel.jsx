/**
 * Global Filter Panel Component
 */
import React, { useState } from 'react';

function GlobalFilterPanel({ onFilterChange }) {
  const [filters, setFilters] = useState({
    severity: '',
    status: '',
    timeRange: '24h',
    source: ''
  });

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleReset = () => {
    const resetFilters = {
      severity: '',
      status: '',
      timeRange: '24h',
      source: ''
    };
    setFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  return (
    <div className="panel filter-panel">
      <h3 className="panel-title">Filters</h3>
      <div className="filter-controls">
        <div className="filter-group">
          <label>Severity:</label>
          <select 
            value={filters.severity} 
            onChange={(e) => handleFilterChange('severity', e.target.value)}
          >
            <option value="">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select 
            value={filters.status} 
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Time Range:</label>
          <select 
            value={filters.timeRange} 
            onChange={(e) => handleFilterChange('timeRange', e.target.value)}
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Source:</label>
          <input 
            type="text" 
            value={filters.source}
            onChange={(e) => handleFilterChange('source', e.target.value)}
            placeholder="Filter by source..."
          />
        </div>

        <button onClick={handleReset} className="reset-button">
          Reset Filters
        </button>
      </div>
    </div>
  );
}

export default GlobalFilterPanel;
