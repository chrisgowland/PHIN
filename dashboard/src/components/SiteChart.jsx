import { useState, useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Label,
} from 'recharts';

const NUFFIELD_COLOR = '#00263a';

function distanceMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const fmt = n => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div style={{
      background: 'white', border: '1px solid #e0e4ea', borderRadius: 8,
      padding: '12px 16px', fontSize: 13, boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
      minWidth: 200,
    }}>
      <div style={{ fontWeight: 700, color: NUFFIELD_COLOR, marginBottom: 6 }}>{d.siteName}</div>
      {d.city && <div style={{ color: '#6b7a90', marginBottom: 8, fontSize: 12 }}>{d.city}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '3px 16px' }}>
        <span style={{ color: '#6b7a90' }}>Market size</span>
        <span style={{ fontWeight: 600, textAlign: 'right' }}>{d.marketSize.toLocaleString()} procedures</span>
        <span style={{ color: '#6b7a90' }}>Nuffield share</span>
        <span style={{ fontWeight: 600, textAlign: 'right' }}>{d.nuffieldShare}%</span>
        <span style={{ color: '#6b7a90' }}>Nuffield volume</span>
        <span style={{ fontWeight: 600, textAlign: 'right' }}>{d.nuffieldVol.toLocaleString()}</span>
        <span style={{ color: '#6b7a90' }}>Sites in catchment</span>
        <span style={{ fontWeight: 600, textAlign: 'right' }}>{d.sitesInRadius}</span>
      </div>
    </div>
  );
}

function CustomDot(props) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined) return null;
  // Shorten label: strip "Nuffield Health" prefix and common suffixes
  const label = payload.siteName
    .replace(/^Nuffield Health\s*/i, '')
    .replace(/\s*(Hospital|Clinic|Centre|Center)\s*$/i, '')
    .trim();
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill={NUFFIELD_COLOR} fillOpacity={0.85} stroke="white" strokeWidth={1.5} />
      <text
        x={cx}
        y={cy - 10}
        textAnchor="middle"
        fontSize={10}
        fill={NUFFIELD_COLOR}
        fontWeight={600}
        style={{ pointerEvents: 'none' }}
      >
        {label}
      </text>
    </g>
  );
}

export default function SiteChart({ siteProcIndex, nhsSiteProcIndex, groupSiteData }) {
  const [radiusMiles, setRadiusMiles] = useState(50);
  const [metric, setMetric] = useState('private');

  const nuffieldSites = useMemo(() => {
    if (!groupSiteData?.Nuffield?.sites) return [];
    return groupSiteData.Nuffield.sites.filter(s => s.lat && s.lng);
  }, [groupSiteData]);

  // Merged (total) index combining private + NHS
  const totalIndex = useMemo(() => {
    if (!siteProcIndex || !nhsSiteProcIndex) return null;
    const map = {};
    [...siteProcIndex, ...nhsSiteProcIndex].forEach(site => {
      if (!map[site.siteId]) map[site.siteId] = { ...site, procs: { ...site.procs } };
      else {
        Object.entries(site.procs).forEach(([proc, vol]) => {
          map[site.siteId].procs[proc] = (map[site.siteId].procs[proc] || 0) + vol;
        });
      }
    });
    return Object.values(map);
  }, [siteProcIndex, nhsSiteProcIndex]);

  const activeIndex = metric === 'private' ? siteProcIndex
    : metric === 'nhs' ? nhsSiteProcIndex
    : totalIndex;

  const chartData = useMemo(() => {
    if (!activeIndex || !nuffieldSites.length) return [];

    return nuffieldSites.map(site => {
      const inRadius = activeIndex
        .filter(s => s.lat && s.lng && distanceMiles(site.lat, site.lng, s.lat, s.lng) <= radiusMiles);

      let totalMarket = 0;
      let nuffieldVol = 0;
      inRadius.forEach(s => {
        const siteTotal = Object.values(s.procs).reduce((sum, v) => sum + v, 0);
        totalMarket += siteTotal;
        if (s.siteId === site.siteId) nuffieldVol = siteTotal;
      });

      if (totalMarket === 0) return null;

      return {
        siteId: site.siteId,
        siteName: site.siteName,
        city: site.city,
        marketSize: totalMarket,
        nuffieldVol,
        nuffieldShare: Math.round((nuffieldVol / totalMarket) * 1000) / 10,
        sitesInRadius: inRadius.length,
        // Recharts scatter needs x/y
        x: Math.round((nuffieldVol / totalMarket) * 1000) / 10,
        y: totalMarket,
      };
    }).filter(Boolean).sort((a, b) => b.marketSize - a.marketSize);
  }, [activeIndex, nuffieldSites, radiusMiles]);

  // Median lines for quadrant reference
  const medianShare = useMemo(() => {
    if (!chartData.length) return null;
    const sorted = [...chartData].sort((a, b) => a.x - b.x);
    const mid = Math.floor(sorted.length / 2);
    return sorted[mid]?.x;
  }, [chartData]);

  const medianMarket = useMemo(() => {
    if (!chartData.length) return null;
    const sorted = [...chartData].sort((a, b) => a.y - b.y);
    const mid = Math.floor(sorted.length / 2);
    return sorted[mid]?.y;
  }, [chartData]);

  if (!siteProcIndex || !nhsSiteProcIndex || !groupSiteData) {
    return <div className="loading">Loading chart data…</div>;
  }

  const metricLabel = metric === 'private' ? 'Private' : metric === 'nhs' ? 'NHS' : 'Total';

  return (
    <>
      {/* Controls */}
      <div className="card">
        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7a90', marginBottom: 8, fontWeight: 600 }}>
              ACTIVITY TYPE
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'private', label: 'Private' },
                { id: 'nhs',     label: 'NHS' },
                { id: 'total',   label: 'Total' },
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setMetric(m.id)}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: '1px solid #e0e4ea',
                    background: metric === m.id ? '#00263a' : 'white',
                    color: metric === m.id ? 'white' : '#1a2332',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7a90', marginBottom: 8, fontWeight: 600 }}>
              CATCHMENT RADIUS
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[5, 15, 30, 50, 100].map(r => (
                <button
                  key={r}
                  onClick={() => setRadiusMiles(r)}
                  style={{
                    padding: '8px 14px', borderRadius: 6, border: '1px solid #e0e4ea',
                    background: radiusMiles === r ? '#00263a' : 'white',
                    color: radiusMiles === r ? 'white' : '#1a2332',
                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  }}
                >
                  {r} mi
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7a90', alignSelf: 'center' }}>
            {chartData.length} Nuffield sites plotted
          </div>
        </div>
      </div>

      {/* Quadrant labels */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e4ea' }}>
          <div className="card-title" style={{ marginBottom: 4 }}>
            Nuffield Site — {metricLabel} Market Share vs Market Size ({radiusMiles}mi catchment)
          </div>
          <div style={{ fontSize: 12, color: '#6b7a90' }}>
            Each dot is a Nuffield hospital. Reference lines show medians. Top-left = large market, low share (opportunity). Top-right = large market, strong position.
          </div>
        </div>
        <div style={{ padding: '24px 20px 32px' }}>
          <ResponsiveContainer width="100%" height={520}>
            <ScatterChart margin={{ top: 40, right: 60, bottom: 60, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e4ea" />
              <XAxis
                type="number"
                dataKey="x"
                domain={[0, 'dataMax + 5']}
                tickFormatter={v => `${v}%`}
                tick={{ fontSize: 12 }}
              >
                <Label value={`Nuffield ${metricLabel} Market Share (%)`} offset={-10} position="insideBottom" style={{ fontSize: 12, fill: '#6b7a90' }} />
              </XAxis>
              <YAxis
                type="number"
                dataKey="y"
                tickFormatter={v => fmt(v)}
                tick={{ fontSize: 12 }}
                width={55}
              >
                <Label value={`${metricLabel} Procedures in Market`} angle={-90} position="insideLeft" offset={10} style={{ fontSize: 12, fill: '#6b7a90', textAnchor: 'middle' }} />
              </YAxis>
              {medianShare !== null && (
                <ReferenceLine
                  x={medianShare}
                  stroke="#b0bac9"
                  strokeDasharray="4 4"
                  label={{ value: 'median share', position: 'top', fontSize: 10, fill: '#9b9b9b' }}
                />
              )}
              {medianMarket !== null && (
                <ReferenceLine
                  y={medianMarket}
                  stroke="#b0bac9"
                  strokeDasharray="4 4"
                  label={{ value: 'median market', position: 'right', fontSize: 10, fill: '#9b9b9b' }}
                />
              )}
              <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter
                data={chartData}
                shape={(props) => <CustomDot {...props} />}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data table below chart */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 20 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #e0e4ea' }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Site data — sorted by market size</div>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>City</th>
                <th style={{ textAlign: 'right' }}>Market Size</th>
                <th style={{ textAlign: 'right' }}>Nuffield Volume</th>
                <th style={{ textAlign: 'right' }}>Nuffield Share</th>
                <th style={{ textAlign: 'right' }}>Sites in Catchment</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map(d => (
                <tr key={d.siteId}>
                  <td style={{ fontWeight: 500 }}>{d.siteName}</td>
                  <td>{d.city || '—'}</td>
                  <td className="num">{d.marketSize.toLocaleString()}</td>
                  <td className="num">{d.nuffieldVol.toLocaleString()}</td>
                  <td className="num">{d.nuffieldShare}%</td>
                  <td className="num">{d.sitesInRadius}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
