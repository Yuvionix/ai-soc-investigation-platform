/**
 * GeoIPMap
 * =========
 * Visual world map showing attack origins from alerts.
 * Uses react-simple-maps + a hardcoded lat/lon lookup table
 * (no internet required — fully offline).
 */
import React, { useState } from 'react';

// Country code → approximate coordinates
const COUNTRY_COORDS = {
  RU: { lat: 55.75, lon: 37.61, name: 'Russia' },
  CN: { lat: 39.91, lon: 116.39, name: 'China' },
  UA: { lat: 50.45, lon: 30.52, name: 'Ukraine' },
  DE: { lat: 52.52, lon: 13.40, name: 'Germany' },
  US: { lat: 37.09, lon: -95.71, name: 'United States' },
  BR: { lat: -14.24, lon: -51.93, name: 'Brazil' },
  IN: { lat: 20.59, lon: 78.96, name: 'India' },
  KP: { lat: 40.34, lon: 127.51, name: 'North Korea' },
  IR: { lat: 32.43, lon: 53.69, name: 'Iran' },
  LAN: { lat: null, lon: null, name: 'Internal Network' },
};

// IP → country mapping from our threat DB
const IP_COUNTRY = {
  '45.22.11.9':     'RU',
  '188.43.2.1':     'CN',
  '91.195.240.44':  'RU',
  '92.118.160.11':  'UA',
  '185.220.101.46': 'DE',
};

const SEV_COLORS = {
  critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#22c55e',
};

// Simple SVG world map projection (equirectangular)
function toSVGCoords(lat, lon, width, height) {
  const x = ((lon + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
}

// Simplified world outline paths (major continents, very approximate)
const CONTINENTS = [
  // North America
  "M 80,60 L 180,50 L 200,120 L 150,160 L 80,150 Z",
  // South America
  "M 140,160 L 200,155 L 220,250 L 160,290 L 130,230 Z",
  // Europe
  "M 440,50 L 530,45 L 540,100 L 460,110 L 430,80 Z",
  // Africa
  "M 450,110 L 540,105 L 555,230 L 490,270 L 435,200 L 440,130 Z",
  // Asia
  "M 530,45 L 750,40 L 760,150 L 650,180 L 540,160 L 530,100 Z",
  // Australia
  "M 670,210 L 750,200 L 755,260 L 690,270 L 665,240 Z",
];

export default function GeoIPMap({ alerts = [] }) {
  const [tooltip, setTooltip] = useState(null);
  const W = 800, H = 380;

  // Build attack points from alerts
  const attackPoints = [];
  const countryCounts = {};

  alerts.forEach(alert => {
    const ip = alert.ip_address;
    if (!ip) return;
    const cc = IP_COUNTRY[ip];
    if (!cc || cc === 'LAN') return;
    const coords = COUNTRY_COORDS[cc];
    if (!coords || !coords.lat) return;

    const { x, y } = toSVGCoords(coords.lat, coords.lon, W, H);
    const key = cc;
    if (!countryCounts[key]) {
      countryCounts[key] = { x, y, count: 0, country: coords.name, cc, ips: new Set(), severity: 'low' };
    }
    countryCounts[key].count++;
    countryCounts[key].ips.add(ip);
    // Escalate severity
    const sevOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    if ((sevOrder[alert.severity] || 0) > (sevOrder[countryCounts[key].severity] || 0)) {
      countryCounts[key].severity = alert.severity;
    }
  });

  Object.values(countryCounts).forEach(p => attackPoints.push(p));

  const totalAttacks = alerts.filter(a => IP_COUNTRY[a.ip_address] && IP_COUNTRY[a.ip_address] !== 'LAN').length;

  return (
    <div style={{
      backgroundColor: '#0a0e1a',
      border: '1px solid rgba(51,65,85,0.5)',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        background: 'rgba(15,23,42,0.9)',
        borderBottom: '1px solid rgba(51,65,85,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1rem' }}>🌍</span>
          <span style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600 }}>
            Attack Origin Map
          </span>
          <span style={{
            fontSize: '0.7rem', padding: '1px 7px', borderRadius: 10,
            backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444',
            border: '1px solid rgba(239,68,68,0.25)',
          }}>
            {attackPoints.length} countries
          </span>
        </div>
        <span style={{ color: '#475569', fontSize: '0.75rem' }}>
          {totalAttacks} external attacks detected
        </span>
      </div>

      {/* Map SVG */}
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          {/* Ocean background */}
          <rect width={W} height={H} fill="#0d1525" />

          {/* Grid lines */}
          {[0, 60, 120, 180, 240, 300, 360].map(lon => {
            const x = ((lon) / 360) * W;
            return <line key={lon} x1={x} y1={0} x2={x} y2={H} stroke="#1e293b" strokeWidth={0.5} />;
          })}
          {[-60, 0, 60].map(lat => {
            const y = ((90 - lat) / 180) * H;
            return <line key={lat} x1={0} y1={y} x2={W} y2={y} stroke="#1e293b" strokeWidth={0.5} />;
          })}

          {/* Continents */}
          {CONTINENTS.map((d, i) => (
            <path key={i} d={d} fill="#1e293b" stroke="#334155" strokeWidth={1} />
          ))}

          {/* Attack origin points */}
          {attackPoints.map((pt, i) => {
            const color = SEV_COLORS[pt.severity] || '#ef4444';
            const r = Math.min(6 + pt.count * 2, 20);
            return (
              <g key={i}>
                {/* Pulse ring */}
                <circle cx={pt.x} cy={pt.y} r={r + 8} fill="none"
                  stroke={color} strokeWidth={1} opacity={0.3}
                  style={{ animation: `pulse-map 2s ${i * 0.3}s ease-out infinite` }} />
                {/* Main dot */}
                <circle
                  cx={pt.x} cy={pt.y} r={r}
                  fill={color} opacity={0.85}
                  style={{ cursor: 'pointer', filter: `drop-shadow(0 0 6px ${color})` }}
                  onMouseEnter={() => setTooltip({ ...pt, mx: pt.x, my: pt.y })}
                  onMouseLeave={() => setTooltip(null)}
                />
                {/* Count label */}
                {pt.count > 1 && (
                  <text x={pt.x} y={pt.y + 1} textAnchor="middle" dominantBaseline="middle"
                    fill="#fff" fontSize={Math.min(r * 0.9, 11)} fontWeight="bold" style={{ pointerEvents: 'none' }}>
                    {pt.count}
                  </text>
                )}
              </g>
            );
          })}

          {/* Tooltip */}
          {tooltip && (() => {
            const tx = Math.min(tooltip.x + 10, W - 160);
            const ty = Math.max(tooltip.y - 70, 10);
            return (
              <g>
                <rect x={tx} y={ty} width={150} height={65} rx={6}
                  fill="#0f172a" stroke="rgba(51,65,85,0.8)" strokeWidth={1} />
                <text x={tx + 10} y={ty + 18} fill="#f8fafc" fontSize={11} fontWeight="bold">
                  {tooltip.country} ({tooltip.cc})
                </text>
                <text x={tx + 10} y={ty + 34} fill="#94a3b8" fontSize={10}>
                  Attacks: {tooltip.count}
                </text>
                <text x={tx + 10} y={ty + 48} fill={SEV_COLORS[tooltip.severity]} fontSize={10}>
                  Severity: {tooltip.severity?.toUpperCase()}
                </text>
                <text x={tx + 10} y={ty + 60} fill="#64748b" fontSize={9}>
                  IPs: {[...tooltip.ips].join(', ').slice(0, 30)}
                </text>
              </g>
            );
          })()}
        </svg>

        <style>{`
          @keyframes pulse-map {
            0%   { r: 0; opacity: 0.6; }
            100% { r: 25px; opacity: 0; }
          }
        `}</style>
      </div>

      {/* Legend */}
      <div style={{
        padding: '8px 16px', borderTop: '1px solid rgba(30,41,59,0.6)',
        display: 'flex', gap: 16, flexWrap: 'wrap',
      }}>
        {Object.entries(SEV_COLORS).map(([sev, color]) => (
          <span key={sev} style={{ display: 'flex', alignItems: 'center', gap: 5,
                                   fontSize: '0.72rem', color: '#64748b' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%',
                           backgroundColor: color, display: 'inline-block' }} />
            {sev.charAt(0).toUpperCase() + sev.slice(1)}
          </span>
        ))}
        <span style={{ color: '#334155', fontSize: '0.72rem', marginLeft: 'auto' }}>
          Dot size = attack count
        </span>
      </div>
    </div>
  );
}
