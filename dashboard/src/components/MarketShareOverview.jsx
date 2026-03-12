import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList
} from 'recharts';

const GROUP_COLORS = {
  Nuffield: '#00263a',
  Spire:    '#e4003a',
  Circle:   '#00a9e0',
  Ramsay:   '#f5a623',
  Other:    '#9b9b9b',
};

const fmt = n => n?.toLocaleString() ?? '—';
const pct = n => `${n}%`;

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: 'white', border: '1px solid #e0e4ea', borderRadius: 6, padding: '10px 14px', fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{d.group}</div>
      <div>{fmt(d.privateSpells)} private spells</div>
      <div style={{ color: '#6b7a90' }}>{pct(d.marketSharePct)} market share</div>
    </div>
  );
}

export default function MarketShareOverview({ summary }) {
  if (!summary) return <div className="loading">Loading…</div>;

  const { byGroup, totalPrivateSpells, periodFrom, periodTo } = summary;

  // Pie uses all groups; bar chart sorted descending
  const barData = [...byGroup].sort((a, b) => b.privateSpells - a.privateSpells);

  return (
    <>
      {/* KPI cards */}
      <div className="kpi-row">
        {byGroup.map(g => (
          <div key={g.group} className={`kpi-card ${g.group.toLowerCase()}`}>
            <div className="kpi-label">{g.group}</div>
            <div className="kpi-value">{g.marketSharePct}%</div>
            <div className="kpi-sub">{fmt(g.privateSpells)} spells</div>
            {g.suppressedSites > 0 && (
              <div style={{ fontSize: 11, color: '#9b9b9b', marginTop: 2 }}>
                +{g.suppressedSites} suppressed sites
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="charts-row">
        {/* Pie chart */}
        <div className="card">
          <div className="card-title">Market Share — Private Spells</div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={byGroup}
                dataKey="privateSpells"
                nameKey="group"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                paddingAngle={2}
              >
                {byGroup.map(g => (
                  <Cell key={g.group} fill={GROUP_COLORS[g.group]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => <span style={{ fontSize: 12, color: '#1a2332' }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Bar chart */}
        <div className="card">
          <div className="card-title">Private Spells by Group</div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e4ea" vertical={false} />
              <XAxis dataKey="group" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="privateSpells" radius={[4, 4, 0, 0]}>
                {barData.map(g => (
                  <Cell key={g.group} fill={GROUP_COLORS[g.group]} />
                ))}
                <LabelList
                  dataKey="marketSharePct"
                  position="top"
                  formatter={pct}
                  style={{ fontSize: 11, fontWeight: 700 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Context note */}
      <div style={{ fontSize: 12, color: '#6b7a90', marginTop: -8, paddingBottom: 8 }}>
        IND (independent) sector only. Period: {periodFrom} to {periodTo}.
        Total private spells across all IND providers: {fmt(totalPrivateSpells)}.
        Suppressed sites (low volume, &lt;8 patients) not included in group totals.
      </div>
    </>
  );
}
