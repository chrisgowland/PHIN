import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts';

const GROUP_COLORS = {
  Nuffield: '#00263a',
  Spire:    '#e4003a',
  Circle:   '#00a9e0',
  Ramsay:   '#f5a623',
  Other:    '#9b9b9b',
};

const GROUPS = ['Nuffield', 'Spire', 'Circle', 'Ramsay'];
const fmt = n => n?.toLocaleString() ?? '—';

function ShareBar({ pct, group }) {
  return (
    <div className="share-bar-cell">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div className="share-bar-track" style={{ flex: 1 }}>
          <div
            className="share-bar-fill"
            style={{ width: `${pct}%`, background: GROUP_COLORS[group] }}
          />
        </div>
        <span style={{ fontSize: 12, minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {pct}%
        </span>
      </div>
    </div>
  );
}

export default function SpecialtyBreakdown({ data }) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('totalProcedures');
  const [sortDir, setSortDir] = useState('desc');
  const [view, setView] = useState('table'); // 'table' | 'chart'
  const [chartSpec, setChartSpec] = useState('');

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.toLowerCase();
    let rows = q ? data.filter(r => r.procedureGroup.toLowerCase().includes(q)) : data;
    return [...rows].sort((a, b) => {
      let av, bv;
      if (sortCol === 'totalProcedures') { av = a.totalProcedures; bv = b.totalProcedures; }
      else {
        const ag = a.byGroup.find(g => g.group === sortCol);
        const bg = b.byGroup.find(g => g.group === sortCol);
        av = ag?.marketSharePct ?? 0;
        bv = bg?.marketSharePct ?? 0;
      }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [data, search, sortCol, sortDir]);

  function handleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  function thClass(col) {
    if (sortCol !== col) return '';
    return sortDir === 'asc' ? 'sort-asc' : 'sort-desc';
  }

  // For chart view: top 20 specialties by total volume
  const chartData = useMemo(() => {
    if (!data) return [];
    const src = chartSpec
      ? data.filter(r => r.procedureGroup.toLowerCase().includes(chartSpec.toLowerCase()))
      : data;
    return src
      .sort((a, b) => b.totalProcedures - a.totalProcedures)
      .slice(0, 20)
      .map(r => {
        const obj = { name: r.procedureGroup };
        r.byGroup.forEach(g => { if (GROUPS.includes(g.group)) obj[g.group] = g.procedures; });
        return obj;
      });
  }, [data, chartSpec]);

  if (!data) return <div className="loading">Loading…</div>;

  return (
    <>
      <div className="filter-row">
        <input
          type="text"
          placeholder="Search procedure group…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          onClick={() => setView('table')}
          style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid #e0e4ea',
            background: view === 'table' ? '#00263a' : 'white',
            color: view === 'table' ? 'white' : '#1a2332',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          Table
        </button>
        <button
          onClick={() => setView('chart')}
          style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid #e0e4ea',
            background: view === 'chart' ? '#00263a' : 'white',
            color: view === 'chart' ? 'white' : '#1a2332',
            cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          Chart (top 20)
        </button>
        <span style={{ fontSize: 12, color: '#6b7a90' }}>
          {filtered.length} procedure groups
        </span>
      </div>

      {view === 'table' ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', maxHeight: 600, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('procedureGroup')} className={thClass('procedureGroup')}>
                    Procedure Group
                  </th>
                  <th onClick={() => handleSort('totalProcedures')} className={thClass('totalProcedures')} style={{ textAlign: 'right' }}>
                    Total (IND)
                  </th>
                  {GROUPS.map(g => (
                    <th key={g} onClick={() => handleSort(g)} className={thClass(g)}>
                      {g} Share
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.procedureGroupId}>
                    <td>{r.procedureGroup}</td>
                    <td className="num">{fmt(r.totalProcedures)}</td>
                    {GROUPS.map(g => {
                      const entry = r.byGroup.find(b => b.group === g);
                      return (
                        <td key={g}>
                          <ShareBar pct={entry?.marketSharePct ?? 0} group={g} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">Top 20 Specialties — Private Procedures by Group</div>
          <div className="filter-row" style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Filter specialties for chart…"
              value={chartSpec}
              onChange={e => setChartSpec(e.target.value)}
              style={{ minWidth: 200 }}
            />
          </div>
          <ResponsiveContainer width="100%" height={500}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 180, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e4ea" horizontal={false} />
              <XAxis type="number" tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={175} />
              <Tooltip formatter={(v, name) => [fmt(v), name]} />
              <Legend />
              {GROUPS.map(g => (
                <Bar key={g} dataKey={g} stackId="a" fill={GROUP_COLORS[g]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ fontSize: 12, color: '#6b7a90', marginTop: 4 }}>
        Suppressed values (&lt;8 patients) excluded from group totals. IND sector only.
      </div>
    </>
  );
}
