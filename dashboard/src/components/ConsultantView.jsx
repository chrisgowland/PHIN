import { useState, useMemo } from 'react';

const fmt = n => n !== null && n !== undefined ? n.toLocaleString() : '—';

export default function ConsultantView({ data }) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('privateSpells');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    let rows = q
      ? data.filter(c =>
          c.fullName.toLowerCase().includes(q) ||
          c.gmc.toLowerCase().includes(q)
        )
      : data;

    return [...rows].sort((a, b) => {
      const av = a[sortCol] ?? -1;
      const bv = b[sortCol] ?? -1;
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [data, search, sortCol, sortDir]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); setPage(0); }
  }

  function thClass(col) {
    if (sortCol !== col) return '';
    return sortDir === 'asc' ? 'sort-asc' : 'sort-desc';
  }

  if (!data) return <div className="loading">Loading…</div>;

  return (
    <>
      <div style={{ fontSize: 13, color: '#6b7a90', marginBottom: 12 }}>
        Showing top 200 consultants by private spell volume (PHIN-wide, all providers).
        Consultant data is not attributed to hospital groups in the PHIN public dataset.
      </div>

      <div className="filter-row">
        <input
          type="text"
          placeholder="Search consultant name or GMC…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0); }}
        />
        <span style={{ fontSize: 12, color: '#6b7a90' }}>{filtered.length} consultants</span>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th onClick={() => handleSort('surname')} className={thClass('surname')}>Name</th>
                <th>GMC</th>
                <th onClick={() => handleSort('privateSpells')} className={thClass('privateSpells')} style={{ textAlign: 'right' }}>
                  Private Spells
                </th>
                <th onClick={() => handleSort('privateEpisodes')} className={thClass('privateEpisodes')} style={{ textAlign: 'right' }}>
                  Private Episodes
                </th>
                <th onClick={() => handleSort('allSpells')} className={thClass('allSpells')} style={{ textAlign: 'right' }}>
                  All Activity Spells
                </th>
                <th onClick={() => handleSort('nhsSpells')} className={thClass('nhsSpells')} style={{ textAlign: 'right' }}>
                  NHS Spells
                </th>
              </tr>
            </thead>
            <tbody>
              {paged.map((c, i) => (
                <tr key={c.gmc}>
                  <td style={{ color: '#9b9b9b', fontSize: 12 }}>{page * PAGE_SIZE + i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{c.fullName}</td>
                  <td style={{ color: '#6b7a90', fontSize: 12 }}>{c.gmc}</td>
                  <td className={c.privateSpells === null ? 'muted' : 'num'}>
                    {c.privateSpells === null ? 'Suppressed' : fmt(c.privateSpells)}
                  </td>
                  <td className={c.privateEpisodes === null ? 'muted' : 'num'}>
                    {c.privateEpisodes === null ? 'Suppressed' : fmt(c.privateEpisodes)}
                  </td>
                  <td className={c.allSpells === null ? 'muted' : 'num'}>
                    {c.allSpells === null ? 'Suppressed' : fmt(c.allSpells)}
                  </td>
                  <td className={c.nhsSpells === null ? 'muted' : 'num'}>
                    {c.nhsSpells === null ? 'Suppressed' : fmt(c.nhsSpells)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e0e4ea', cursor: 'pointer', background: 'white' }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 13, color: '#6b7a90' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e0e4ea', cursor: 'pointer', background: 'white' }}
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}
