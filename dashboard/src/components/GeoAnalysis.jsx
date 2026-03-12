import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts';

const GROUP_COLORS = {
  Nuffield: '#00263a',
  Spire:    '#e4003a',
  Circle:   '#00a9e0',
  Ramsay:   '#f5a623',
  Other:    '#9b9b9b',
};
const GROUPS = ['Nuffield', 'Spire', 'Circle', 'Ramsay', 'Other'];
const fmt = n => (n !== null && n !== undefined && n > 0) ? n.toLocaleString() : '—';
const pct = n => n > 0 ? `${n}%` : '—';

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

function ShareBar({ pct: value, group }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 50, background: '#f0f2f5', borderRadius: 3, height: 6, flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: GROUP_COLORS[group], borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', minWidth: 34, color: value > 0 ? '#1a2332' : '#9b9b9b' }}>
        {value > 0 ? `${value}%` : '—'}
      </span>
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'white', border: '1px solid #e0e4ea', borderRadius: 6, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.group}</div>
      <div>{fmt(d.procedures)} procedures</div>
      <div style={{ color: '#6b7a90' }}>{d.marketSharePct}% local share</div>
    </div>
  );
}

export default function GeoAnalysis({ siteProcIndex, procedureGroups, groupSiteData }) {
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [radiusMiles, setRadiusMiles] = useState(50);
  const [procSearch, setProcSearch] = useState('');
  const [drillProc, setDrillProc] = useState(null); // procedure selected for site-level drill-down
  const [siteSearch, setSiteSearch] = useState('');

  // Nuffield sites with coordinates
  const nuffieldSites = useMemo(() => {
    if (!groupSiteData?.Nuffield?.sites) return [];
    return groupSiteData.Nuffield.sites
      .filter(s => s.lat && s.lng)
      .sort((a, b) => a.siteName.localeCompare(b.siteName));
  }, [groupSiteData]);

  const selectedSite = nuffieldSites.find(s => s.siteId === selectedSiteId);

  // Find all IND sites within radius
  const sitesInRadius = useMemo(() => {
    if (!selectedSite || !siteProcIndex) return [];
    const { lat, lng } = selectedSite;
    return siteProcIndex
      .filter(s => s.lat && s.lng)
      .map(s => ({ ...s, distanceMiles: Math.round(distanceMiles(lat, lng, s.lat, s.lng) * 10) / 10 }))
      .filter(s => s.distanceMiles <= radiusMiles)
      .sort((a, b) => a.distanceMiles - b.distanceMiles);
  }, [selectedSite, siteProcIndex, radiusMiles]);

  // Aggregate procedure table: for each procedure in the catchment, total market + per-group volume + Nuffield share
  const procedureTable = useMemo(() => {
    if (!sitesInRadius.length) return [];

    const procMap = {};
    sitesInRadius.forEach(site => {
      Object.entries(site.procs).forEach(([proc, vol]) => {
        if (!procMap[proc]) {
          procMap[proc] = { procedure: proc, total: 0 };
          GROUPS.forEach(g => { procMap[proc][g] = 0; });
        }
        procMap[proc].total += vol;
        procMap[proc][site.group] = (procMap[proc][site.group] || 0) + vol;
      });
    });

    return Object.values(procMap)
      .map(r => ({
        ...r,
        nuffieldShare: r.total > 0 ? Math.round((r.Nuffield / r.total) * 1000) / 10 : 0,
        spireShare:    r.total > 0 ? Math.round((r.Spire    / r.total) * 1000) / 10 : 0,
        circleShare:   r.total > 0 ? Math.round((r.Circle   / r.total) * 1000) / 10 : 0,
        ramsayShare:   r.total > 0 ? Math.round((r.Ramsay   / r.total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [sitesInRadius]);

  // Filter procedure table by search
  const filteredProcTable = useMemo(() => {
    const q = procSearch.toLowerCase();
    return q ? procedureTable.filter(r => r.procedure.toLowerCase().includes(q)) : procedureTable;
  }, [procedureTable, procSearch]);

  // Drill-down: competitor sites for selected procedure
  const drillData = useMemo(() => {
    if (!drillProc || !sitesInRadius.length) return null;
    const competitors = sitesInRadius
      .filter(s => s.procs[drillProc])
      .map(s => ({
        siteId: s.siteId,
        siteName: s.siteName,
        group: s.group,
        city: s.city,
        distanceMiles: s.distanceMiles,
        procedures: s.procs[drillProc],
        isSelected: s.siteId === selectedSiteId,
      }))
      .sort((a, b) => b.procedures - a.procedures);

    const total = competitors.reduce((s, c) => s + c.procedures, 0);
    const byGroup = GROUPS.map(g => {
      const vol = competitors.filter(c => c.group === g).reduce((s, c) => s + c.procedures, 0);
      return { group: g, procedures: vol, marketSharePct: total > 0 ? Math.round((vol / total) * 1000) / 10 : 0, sites: competitors.filter(c => c.group === g).length };
    });

    return { competitors, total, byGroup };
  }, [drillProc, sitesInRadius, selectedSiteId]);

  const filteredDrillSites = useMemo(() => {
    if (!drillData) return [];
    const q = siteSearch.toLowerCase();
    return q ? drillData.competitors.filter(c => c.siteName.toLowerCase().includes(q) || (c.city || '').toLowerCase().includes(q)) : drillData.competitors;
  }, [drillData, siteSearch]);

  if (!siteProcIndex || !procedureGroups || !groupSiteData) {
    return <div className="loading">Loading geographic data…</div>;
  }

  return (
    <>
      {/* Controls */}
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7a90', marginBottom: 6, fontWeight: 600 }}>
              NUFFIELD SITE
            </label>
            <select
              value={selectedSiteId}
              onChange={e => { setSelectedSiteId(e.target.value); setDrillProc(null); setProcSearch(''); setSiteSearch(''); }}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e0e4ea', borderRadius: 6, fontSize: 14, color: '#1a2332' }}
            >
              <option value="">— Select a Nuffield site —</option>
              {nuffieldSites.map(s => (
                <option key={s.siteId} value={s.siteId}>
                  {s.siteName}{s.city ? ` (${s.city})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#6b7a90', marginBottom: 6, fontWeight: 600 }}>
              CATCHMENT RADIUS
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[5, 15, 30, 50, 100].map(r => (
                <button
                  key={r}
                  onClick={() => { setRadiusMiles(r); setDrillProc(null); }}
                  style={{
                    padding: '8px 14px', borderRadius: 6,
                    border: '1px solid #e0e4ea',
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
        </div>
      </div>

      {!selectedSite && (
        <div style={{ textAlign: 'center', color: '#6b7a90', padding: '60px 0', fontSize: 15 }}>
          Select a Nuffield site to see the local market.
        </div>
      )}

      {selectedSite && !procedureTable.length && (
        <div style={{ textAlign: 'center', color: '#6b7a90', padding: '60px 0' }}>
          No procedure data found within {radiusMiles} miles of {selectedSite.siteName}.
        </div>
      )}

      {selectedSite && procedureTable.length > 0 && (
        <>
          {/* Summary strip */}
          {(() => {
            const nuffieldInCatchment = sitesInRadius.filter(s => s.group === 'Nuffield');
            return (
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div className="card" style={{ padding: '12px 18px', marginBottom: 0, flex: '0 0 auto', minWidth: 200 }}>
                  <div className="kpi-label">Sites in catchment</div>
                  <div className="kpi-value" style={{ fontSize: 20 }}>{sitesInRadius.length}</div>
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {['Spire', 'Circle', 'Ramsay', 'Other'].map(g => {
                      const grpSites = sitesInRadius.filter(s => s.group === g);
                      if (!grpSites.length) return null;
                      return (
                        <div key={g} style={{ fontSize: 11, color: '#6b7a90' }}>
                          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: GROUP_COLORS[g], marginRight: 5 }} />
                          <span style={{ fontWeight: 600, color: '#1a2332' }}>{g}</span>
                          {' — '}{grpSites.length} site{grpSites.length > 1 ? 's' : ''}
                          {grpSites.length <= 3 && (
                            <span style={{ color: '#9b9b9b' }}>
                              {' '}({grpSites.map(s => s.siteName).join(', ')})
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="card" style={{ padding: '12px 18px', marginBottom: 0, flex: '0 0 auto' }}>
                  <div className="kpi-label">Procedure groups tracked</div>
                  <div className="kpi-value" style={{ fontSize: 20 }}>{procedureTable.length}</div>
                </div>
                <div className="card" style={{ padding: '12px 18px', marginBottom: 0, flex: '0 0 auto', minWidth: 200 }}>
                  <div className="kpi-label">Nuffield sites in catchment</div>
                  <div className="kpi-value" style={{ fontSize: 20 }}>{nuffieldInCatchment.length}</div>
                  {nuffieldInCatchment.length > 1 && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {nuffieldInCatchment.map(s => (
                        <div key={s.siteId} style={{ fontSize: 11, color: s.siteId === selectedSiteId ? '#00263a' : '#6b7a90', fontWeight: s.siteId === selectedSiteId ? 700 : 400 }}>
                          {s.distanceMiles === 0 || s.siteId === selectedSiteId ? '★ ' : `${s.distanceMiles} mi — `}{s.siteName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 13, color: '#6b7a90' }}>
                  Straight-line radius from {selectedSite.siteName}{selectedSite.city ? `, ${selectedSite.city}` : ''}
                </div>
              </div>
            );
          })()}

          {/* Procedure table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e4ea' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>
                  Procedure Market Size &amp; Nuffield Share — within {radiusMiles} miles
                </div>
                {drillProc && (
                  <button
                    onClick={() => { setDrillProc(null); setSiteSearch(''); }}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e0e4ea', background: 'white', cursor: 'pointer', fontSize: 12 }}
                  >
                    ← Back to all procedures
                  </button>
                )}
              </div>
              <div className="filter-row" style={{ marginBottom: 0 }}>
                <input
                  type="text"
                  placeholder="Search procedure…"
                  value={procSearch}
                  onChange={e => { setProcSearch(e.target.value); setDrillProc(null); }}
                />
                <span style={{ fontSize: 12, color: '#6b7a90' }}>
                  {filteredProcTable.length} procedures — click any row to see competing sites
                </span>
              </div>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: drillProc ? 320 : 560, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Procedure Group</th>
                    <th style={{ textAlign: 'right' }}>Market Size</th>
                    <th>Nuffield Share</th>
                    <th>Spire Share</th>
                    <th>Circle Share</th>
                    <th>Ramsay Share</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProcTable.map(r => (
                    <tr
                      key={r.procedure}
                      onClick={() => { setDrillProc(r.procedure); setSiteSearch(''); }}
                      style={{
                        cursor: 'pointer',
                        background: drillProc === r.procedure ? '#f0f4f8' : undefined,
                      }}
                    >
                      <td style={{ fontWeight: drillProc === r.procedure ? 700 : 400 }}>
                        {r.procedure}
                        {drillProc === r.procedure && (
                          <span style={{ marginLeft: 6, fontSize: 10, background: '#00263a', color: 'white', borderRadius: 10, padding: '1px 6px' }}>
                            selected
                          </span>
                        )}
                      </td>
                      <td className="num" style={{ fontWeight: 600 }}>{fmt(r.total)}</td>
                      <td><ShareBar pct={r.nuffieldShare} group="Nuffield" /></td>
                      <td><ShareBar pct={r.spireShare}    group="Spire" /></td>
                      <td><ShareBar pct={r.circleShare}   group="Circle" /></td>
                      <td><ShareBar pct={r.ramsayShare}   group="Ramsay" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Drill-down: site breakdown for selected procedure */}
          {drillProc && drillData && (
            <>
              <div className="charts-row" style={{ marginBottom: 20 }}>
                <div className="card">
                  <div className="card-title">{drillProc} — local share ({radiusMiles}mi)</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={drillData.byGroup.filter(g => g.procedures > 0)}
                        dataKey="procedures"
                        nameKey="group"
                        cx="50%" cy="50%"
                        outerRadius={90} innerRadius={40}
                        paddingAngle={2}
                      >
                        {drillData.byGroup.filter(g => g.procedures > 0).map(g => (
                          <Cell key={g.group} fill={GROUP_COLORS[g.group]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                      <Legend formatter={v => <span style={{ fontSize: 12 }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="card">
                  <div className="card-title">Private procedures by group</div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={[...drillData.byGroup].filter(g => g.procedures > 0).sort((a, b) => b.procedures - a.procedures)}
                      margin={{ top: 20, right: 20, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e4ea" vertical={false} />
                      <XAxis dataKey="group" tick={{ fontSize: 12 }} />
                      <YAxis tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} tick={{ fontSize: 12 }} />
                      <Tooltip content={<PieTooltip />} />
                      <Bar dataKey="procedures" radius={[4, 4, 0, 0]}>
                        {drillData.byGroup.map(g => <Cell key={g.group} fill={GROUP_COLORS[g.group]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Competing sites table */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #e0e4ea' }}>
                  <div className="card-title" style={{ marginBottom: 10 }}>
                    Competing sites — {drillProc} — within {radiusMiles} miles ({drillData.competitors.length} sites, {fmt(drillData.total)} total procedures)
                  </div>
                  <div className="filter-row" style={{ marginBottom: 0 }}>
                    <input
                      type="text"
                      placeholder="Search site or city…"
                      value={siteSearch}
                      onChange={e => setSiteSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Site</th>
                        <th>Group</th>
                        <th>City</th>
                        <th style={{ textAlign: 'right' }}>Distance</th>
                        <th style={{ textAlign: 'right' }}>Private Procedures</th>
                        <th style={{ textAlign: 'right', minWidth: 100 }}>Local Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDrillSites.map(c => {
                        const share = drillData.total > 0 ? Math.round((c.procedures / drillData.total) * 1000) / 10 : 0;
                        return (
                          <tr key={c.siteId} style={c.isSelected ? { background: '#f0f4f8' } : {}}>
                            <td style={{ fontWeight: c.isSelected ? 700 : 400 }}>
                              {c.siteName}
                              {c.isSelected && (
                                <span style={{ marginLeft: 6, fontSize: 10, background: '#00263a', color: 'white', borderRadius: 10, padding: '1px 6px' }}>
                                  this site
                                </span>
                              )}
                            </td>
                            <td><span className={`group-badge ${c.group.toLowerCase()}`}>{c.group}</span></td>
                            <td>{c.city || '—'}</td>
                            <td className="num">{c.distanceMiles} mi</td>
                            <td className="num">{fmt(c.procedures)}</td>
                            <td><ShareBar pct={share} group={c.group} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ fontSize: 12, color: '#6b7a90', marginTop: 8 }}>
                Only sites with non-suppressed volumes (&ge;8 patients) for this procedure are shown.
                Nuffield's actual share may be higher where competitor volumes are suppressed.
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
