import { useState, useMemo } from 'react';

const GROUPS = ['Nuffield', 'Spire', 'Circle', 'Ramsay', 'Other'];
const fmt = n => n !== null && n !== undefined ? n.toLocaleString() : '—';

export default function SiteDetail({ data }) {
  const [activeGroup, setActiveGroup] = useState('Nuffield');
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('privateSpells');
  const [sortDir, setSortDir] = useState('desc');

  const groupData = data?.[activeGroup];

  const filtered = useMemo(() => {
    if (!groupData?.sites) return [];
    const q = search.toLowerCase();
    let rows = q
      ? groupData.sites.filter(
          s => s.siteName.toLowerCase().includes(q) || (s.city || '').toLowerCase().includes(q)
        )
      : groupData.sites;

    return [...rows].sort((a, b) => {
      const av = a[sortCol] ?? -1;
      const bv = b[sortCol] ?? -1;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [groupData, search, sortCol, sortDir]);

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  function thClass(col) {
    if (sortCol !== col) return '';
    return sortDir === 'asc' ? 'sort-asc' : 'sort-desc';
  }

  if (!data) return <div className="loading">Loading…</div>;

  return (
    <>
      {/* Group selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {GROUPS.map(g => {
          const gd = data[g];
          return (
            <button
              key={g}
              onClick={() => { setActiveGroup(g); setSearch(''); }}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #e0e4ea',
                background: activeGroup === g ? '#00263a' : 'white',
                color: activeGroup === g ? 'white' : '#1a2332',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {g}
              <span style={{
                marginLeft: 8, fontSize: 11, opacity: 0.75,
              }}>
                {gd?.siteCount} sites
              </span>
            </button>
          );
        })}
      </div>

      {/* Summary for selected group */}
      {groupData && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto) 1fr', gap: 16, marginBottom: 20 }}>
          <div className="card" style={{ padding: '14px 20px', marginBottom: 0 }}>
            <div className="kpi-label">Sites</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{groupData.siteCount}</div>
          </div>
          <div className="card" style={{ padding: '14px 20px', marginBottom: 0 }}>
            <div className="kpi-label">Total Private Spells</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{fmt(groupData.totalPrivateSpells)}</div>
          </div>
          <div className="card" style={{ padding: '14px 20px', marginBottom: 0 }}>
            <div className="kpi-label">Avg per Site</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>
              {groupData.siteCount > 0
                ? fmt(Math.round(groupData.totalPrivateSpells / groupData.siteCount))
                : '—'}
            </div>
          </div>
          <div />
        </div>
      )}

      {/* Filter + table */}
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
                <th onClick={() => handleSort('privateEpisodes')} className={thClass('privateEpisodes')} style={{ textAlign: 'right' }}>
                  Private Episodes
                </th>
                <th onClick={() => handleSort('monthsProvided')} className={thClass('monthsProvided')} style={{ textAlign: 'right' }}>
                  Months Data
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.siteId}>
                  <td style={{ fontWeight: 500 }}>{s.siteName}</td>
                  <td>{s.city || '—'}</td>
                  <td>{s.region || '—'}</td>
                  <td className={s.privateSpells === null ? 'muted' : 'num'}>
                    {s.privateSpells === null ? 'Suppressed' : fmt(s.privateSpells)}
                  </td>
                  <td className={s.privateEpisodes === null ? 'muted' : 'num'}>
                    {s.privateEpisodes === null ? 'Suppressed' : fmt(s.privateEpisodes)}
                  </td>
                  <td className="num">{s.monthsProvided}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
