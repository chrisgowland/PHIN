import { useState, useMemo } from 'react';

const GROUPS = ['Nuffield', 'Spire', 'Circle', 'Ramsay', 'Other'];
const GROUP_COLORS = {
  Nuffield: '#00263a', Spire: '#e4003a', Circle: '#00a9e0', Ramsay: '#f5a623', Other: '#9b9b9b',
};
const fmt = n => n !== null && n !== undefined ? n.toLocaleString() : '—';

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

function ShareBar({ pct: value, color }) {
  if (value === null) return <span style={{ color: '#9b9b9b', fontSize: 12 }}>—</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 44, background: '#f0f2f5', borderRadius: 3, height: 6, flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', minWidth: 32, color: value > 0 ? '#1a2332' : '#9b9b9b' }}>
        {value}%
      </span>
    </div>
  );
}

export default function SiteDetail({ data }) {
  const [activeGroup, setActiveGroup] = useState('Nuffield');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('privateSpells');
  const [sortDir, setSortDir] = useState('desc');
  const [radiusMiles, setRadiusMiles] = useState(50);

  const groupData = data?.[activeGroup];
  const groupColor = GROUP_COLORS[activeGroup] || '#9b9b9b';

  // All sites across all groups (for radius totals)
  const allSites = useMemo(() => {
    if (!data) return [];
    return Object.values(data).flatMap(g => g.sites || []);
  }, [data]);

  // Pre-compute local share (private, NHS, all) for each site in the active group
  const localShareMap = useMemo(() => {
    if (!allSites.length || !groupData?.sites) return {};
    const map = {};
    groupData.sites.forEach(site => {
      if (!site.lat || !site.lng) { map[site.siteId] = null; return; }

      let totalPrivate = 0, totalNhs = 0, totalAll = 0;
      allSites.forEach(s => {
        if (!s.lat || !s.lng) return;
        const d = distanceMiles(site.lat, site.lng, s.lat, s.lng);
        if (d > radiusMiles) return;
        if (s.privateSpells !== null) totalPrivate += s.privateSpells;
        if (s.nhsSpells !== null)     totalNhs     += s.nhsSpells;
        if (s.allSpells !== null)     totalAll     += s.allSpells;
      });

      map[site.siteId] = {
        private: (site.privateSpells !== null && totalPrivate > 0)
          ? Math.round((site.privateSpells / totalPrivate) * 1000) / 10 : null,
        nhs: (site.nhsSpells !== null && totalNhs > 0)
          ? Math.round((site.nhsSpells / totalNhs) * 1000) / 10 : null,
        all: (site.allSpells !== null && totalAll > 0)
          ? Math.round((site.allSpells / totalAll) * 1000) / 10 : null,
      };
    });
    return map;
  }, [allSites, groupData, radiusMiles]);

  const filtered = useMemo(() => {
    if (!groupData?.sites) return [];
    const q = search.toLowerCase();
    let rows = q
      ? groupData.sites.filter(
          s => s.siteName.toLowerCase().includes(q) || (s.city || '').toLowerCase().includes(q)
        )
      : groupData.sites;

    return [...rows].sort((a, b) => {
      let av, bv;
      if (sortCol === 'privateShare') {
        av = localShareMap[a.siteId]?.private ?? -1;
        bv = localShareMap[b.siteId]?.private ?? -1;
      } else if (sortCol === 'nhsShare') {
        av = localShareMap[a.siteId]?.nhs ?? -1;
        bv = localShareMap[b.siteId]?.nhs ?? -1;
      } else if (sortCol === 'allShare') {
        av = localShareMap[a.siteId]?.all ?? -1;
        bv = localShareMap[b.siteId]?.all ?? -1;
      } else {
        av = a[sortCol] ?? -1;
        bv = b[sortCol] ?? -1;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [groupData, search, sortCol, sortDir, localShareMap]);

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }
  function thClass(col) {
    if (sortCol !== col) return '';
    return sortDir === 'asc' ? 'sort-asc' : 'sort-desc';
  }

  if (!data) return <div className="loading">Loading…</div>;

  const groupTotals = groupData ? {
    nhs: groupData.sites.reduce((s, r) => s + (r.nhsSpells || 0), 0),
    all: groupData.sites.reduce((s, r) => s + (r.allSpells || 0), 0),
  } : null;

  return (
    <>
      {/* Group selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {GROUPS.map(g => {
          const gd = data[g];
          return (
            <button key={g} onClick={() => { setActiveGroup(g); setSearch(''); }}
              style={{
                padding: '8px 16px', borderRadius: 6, border: '1px solid #e0e4ea',
                background: activeGroup === g ? '#00263a' : 'white',
                color: activeGroup === g ? 'white' : '#1a2332',
                cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}
            >
              {g}
              <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.75 }}>{gd?.siteCount} sites</span>
            </button>
          );
        })}
      </div>

      {/* Summary KPIs + radius picker */}
      {groupData && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div className="card" style={{ padding: '14px 20px', marginBottom: 0 }}>
            <div className="kpi-label">Sites</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{groupData.siteCount}</div>
          </div>
          <div className="card" style={{ padding: '14px 20px', marginBottom: 0 }}>
            <div className="kpi-label">Private Spells</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{fmt(groupData.totalPrivateSpells)}</div>
          </div>
          {groupTotals?.nhs > 0 && (
            <div className="card" style={{ padding: '14px 20px', marginBottom: 0 }}>
              <div className="kpi-label">NHS Spells</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>{fmt(groupTotals.nhs)}</div>
            </div>
          )}
          {groupTotals?.all > 0 && (
            <div className="card" style={{ padding: '14px 20px', marginBottom: 0 }}>
              <div className="kpi-label">Total Spells</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>{fmt(groupTotals.all)}</div>
            </div>
          )}
          <div className="card" style={{ padding: '14px 20px', marginBottom: 0, marginLeft: 'auto' }}>
            <div className="kpi-label" style={{ marginBottom: 8 }}>LOCAL SHARE RADIUS</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[5, 15, 30, 50, 100].map(r => (
                <button key={r} onClick={() => setRadiusMiles(r)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, border: '1px solid #e0e4ea',
                    background: radiusMiles === r ? '#00263a' : 'white',
                    color: radiusMiles === r ? 'white' : '#1a2332',
                    cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  }}
                >
                  {r} mi
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="filter-row">
        <input
          type="text"
          placeholder="Search site or city…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 12, color: '#6b7a90' }}>{filtered.length} sites</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>City</th>
                <th>Region</th>
                <th onClick={() => handleSort('privateSpells')} className={thClass('privateSpells')} style={{ textAlign: 'right' }}>
                  Private Spells
                </th>
                <th onClick={() => handleSort('nhsSpells')} className={thClass('nhsSpells')} style={{ textAlign: 'right' }}>
                  NHS Spells
                </th>
                <th onClick={() => handleSort('allSpells')} className={thClass('allSpells')} style={{ textAlign: 'right' }}>
                  All Spells
                </th>
                <th onClick={() => handleSort('privateShare')} className={thClass('privateShare')} style={{ minWidth: 130 }}>
                  Pvt Share ({radiusMiles}mi)
                </th>
                <th onClick={() => handleSort('nhsShare')} className={thClass('nhsShare')} style={{ minWidth: 130 }}>
                  NHS Share ({radiusMiles}mi)
                </th>
                <th onClick={() => handleSort('allShare')} className={thClass('allShare')} style={{ minWidth: 130 }}>
                  Total Share ({radiusMiles}mi)
                </th>
                <th onClick={() => handleSort('monthsProvided')} className={thClass('monthsProvided')} style={{ textAlign: 'right' }}>
                  Months
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const share = localShareMap[s.siteId];
                return (
                  <tr key={s.siteId}>
                    <td style={{ fontWeight: 500 }}>{s.siteName}</td>
                    <td>{s.city || '—'}</td>
                    <td>{s.region || '—'}</td>
                    <td className={s.privateSpells === null ? 'muted' : 'num'}>
                      {s.privateSpells === null ? 'Suppressed' : fmt(s.privateSpells)}
                    </td>
                    <td className={s.nhsSpells === null ? 'muted' : 'num'}>
                      {s.nhsSpells === null ? '—' : fmt(s.nhsSpells)}
                    </td>
                    <td className={s.allSpells === null ? 'muted' : 'num'}>
                      {s.allSpells === null ? '—' : fmt(s.allSpells)}
                    </td>
                    <td><ShareBar pct={share?.private ?? null} color={groupColor} /></td>
                    <td><ShareBar pct={share?.nhs ?? null} color="#0072b5" /></td>
                    <td><ShareBar pct={share?.all ?? null} color="#5a6e85" /></td>
                    <td className="num">{s.monthsProvided}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 12, color: '#6b7a90', marginTop: 8 }}>
        Local share = this site's spells as % of all private hospital spells within the chosen straight-line radius (all groups combined).
        Sites without coordinates or suppressed volumes are excluded from radius totals.
      </div>
    </>
  );
}
