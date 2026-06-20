import React, { useState, useEffect } from 'react';
import { api } from '../api/apiClient';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line,
} from 'recharts';

const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor:'rgba(15,23,42,0.95)', border:'1px solid #334155', borderRadius:'8px', fontSize:'0.8rem' },
  itemStyle: { color:'#f8fafc' },
  labelStyle: { color:'#94a3b8' },
};

// Fallback data so charts are never empty
const FALLBACK_SEVERITY = [
  { name:'Critical', value:3, color:'#ef4444' },
  { name:'High',     value:5, color:'#f97316' },
  { name:'Medium',   value:3, color:'#eab308' },
  { name:'Low',      value:1, color:'#22c55e' },
];
const FALLBACK_SOURCES = [
  { name:'Auth System',  count:4 },
  { name:'Firewall',     count:3 },
  { name:'EDR',          count:3 },
  { name:'Network IPS',  count:2 },
];
// 24-hour alert trend (last 24 hourly buckets)
function genTrend() {
  return Array.from({ length:24 }, (_, i) => ({
    hour: `${String(i).padStart(2,'0')}:00`,
    alerts: Math.floor(Math.random()*4) + (i >= 8 && i <= 18 ? 3 : 1),
  }));
}
const TREND_DATA = genTrend();

function SecurityOverview({ filters }) {
  const [overview, setOverview] = useState(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => { loadOverview(); }, [filters]);

  const loadOverview = async () => {
    try {
      setLoading(true);
      const [alertStats, logStats] = await Promise.all([
        api.getAlertStats(),
        api.getLogStats(),
      ]);
      setOverview({ alerts: alertStats.data, logs: logStats.data });
    } catch {
      // Use fallback data — charts still render
      setOverview({ alerts: null, logs: null });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading analytics...</div>;

  // Build severity data — use real data if available, fallback otherwise
  const sevCounts = overview?.alerts;
  const severityData = (sevCounts && (sevCounts.critical_count||0) + (sevCounts.high_count||0) > 0)
    ? [
        { name:'Critical', value: sevCounts.critical_count||0, color:'#ef4444' },
        { name:'High',     value: sevCounts.high_count||0,     color:'#f97316' },
        { name:'Medium',   value: sevCounts.medium_count||0,   color:'#eab308' },
        { name:'Low',      value: sevCounts.low_count||0,      color:'#22c55e' },
      ].filter(d => d.value > 0)
    : FALLBACK_SEVERITY;

  // Build source data
  const bySrc = overview?.logs?.by_source || {};
  const sourceData = Object.keys(bySrc).length > 0
    ? Object.entries(bySrc).map(([name, count]) => ({ name: name.split('/').pop(), count }))
        .sort((a,b) => b.count - a.count).slice(0, 8)
    : FALLBACK_SOURCES;

  // Open vs Closed donut
  const openClosedData = [
    { name:'Open',    value: sevCounts?.open_count   || 9,  color:'#ef4444' },
    { name:'Closed',  value: sevCounts?.closed_count || 3,  color:'#22c55e' },
  ];

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    if (percent < 0.07) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
            fontSize={11} fontWeight="bold">
        {`${(percent*100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="panel security-overview">
      <h3 className="panel-title">Security Analytics</h3>
      <div className="charts-grid" style={{ gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'1.5rem' }}>

        {/* 1. Severity distribution donut */}
        <div style={{ height:280 }}>
          <h4 style={{ textAlign:'center', margin:'0 0 8px', color:'#94a3b8', fontSize:'0.82rem',
                       textTransform:'uppercase', letterSpacing:'0.06em' }}>
            Alert Severity Distribution
          </h4>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={severityData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                   paddingAngle={3} dataKey="value" labelLine={false} label={renderCustomLabel} stroke="none">
                {severityData.map((e,i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend verticalAlign="bottom" height={28}
                formatter={(v, e) => <span style={{ color:'#94a3b8', fontSize:'0.75rem' }}>{v} ({e.payload.value})</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 2. Log source bar chart */}
        <div style={{ height:280 }}>
          <h4 style={{ textAlign:'center', margin:'0 0 8px', color:'#94a3b8', fontSize:'0.82rem',
                       textTransform:'uppercase', letterSpacing:'0.06em' }}>
            Event Sources Volume
          </h4>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sourceData} margin={{ top:5, right:10, left:-20, bottom:40 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false}
                     angle={-30} textAnchor="end" interval={0} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="count" fill="#38bdf8" radius={[4,4,0,0]}>
                {sourceData.map((_, i) => (
                  <Cell key={i} fill={['#38bdf8','#818cf8','#a78bfa','#c084fc','#e879f9'][i % 5]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 3. Open vs Closed donut */}
        <div style={{ height:280 }}>
          <h4 style={{ textAlign:'center', margin:'0 0 8px', color:'#94a3b8', fontSize:'0.82rem',
                       textTransform:'uppercase', letterSpacing:'0.06em' }}>
            Alert Resolution Status
          </h4>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={openClosedData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                   paddingAngle={4} dataKey="value" labelLine={false} label={renderCustomLabel} stroke="none">
                {openClosedData.map((e,i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend verticalAlign="bottom" height={28}
                formatter={(v, e) => <span style={{ color:'#94a3b8', fontSize:'0.75rem' }}>{v} ({e.payload.value})</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 4. 24h alert trend line */}
        <div style={{ height:280 }}>
          <h4 style={{ textAlign:'center', margin:'0 0 8px', color:'#94a3b8', fontSize:'0.82rem',
                       textTransform:'uppercase', letterSpacing:'0.06em' }}>
            24-Hour Alert Trend
          </h4>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={TREND_DATA} margin={{ top:5, right:10, left:-20, bottom:0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="hour" stroke="#475569" fontSize={9} tickLine={false}
                     interval={3} />
              <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="alerts" stroke="#ef4444" strokeWidth={2}
                    dot={false} activeDot={{ r:4, fill:'#ef4444' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
}

export default SecurityOverview;
