import { useState, useEffect } from 'react';
import MarketShareOverview from './components/MarketShareOverview';
import SpecialtyBreakdown from './components/SpecialtyBreakdown';
import SiteDetail from './components/SiteDetail';
import ConsultantView from './components/ConsultantView';
import GeoAnalysis from './components/GeoAnalysis';

const TABS = [
  { id: 'overview',    label: 'Market Share Overview' },
  { id: 'specialty',   label: 'Specialty Breakdown' },
  { id: 'sites',       label: 'Hospital Sites' },
  { id: 'geo',         label: 'Geographic Analysis' },
  { id: 'consultants', label: 'Consultants' },
];

const base = import.meta.env.BASE_URL;

function useJSON(path) {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`${base}${path}`).then(r => r.json()).then(setData).catch(console.error);
  }, [path]);
  return data;
}

function formatPeriod(from, to) {
  if (!from || !to) return '';
  const f = new Date(from);
  const t = new Date(to);
  const opts = { month: 'short', year: 'numeric' };
  return `${f.toLocaleDateString('en-GB', opts)} – ${t.toLocaleDateString('en-GB', opts)}`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const summary       = useJSON('data/market_share_summary.json');
  const specialty     = useJSON('data/specialty_breakdown.json');
  const groupSites    = useJSON('data/group_site_summary.json');
  const consultants   = useJSON('data/top_consultants.json');
  const siteProcIndex = useJSON('data/site_procedure_index.json');
  const procGroups    = useJSON('data/procedure_groups.json');

  const period = summary ? formatPeriod(summary.periodFrom, summary.periodTo) : '';

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>PHIN Competitive Intelligence</h1>
          <div className="subtitle">Private Healthcare Market Share — Nuffield vs Spire, Circle, Ramsay</div>
        </div>
        {period && <div className="period-badge">Rolling 12m: {period}</div>}
      </header>

      <nav className="tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="main">
        {activeTab === 'overview'    && <MarketShareOverview summary={summary} />}
        {activeTab === 'specialty'   && <SpecialtyBreakdown data={specialty} />}
        {activeTab === 'sites'       && <SiteDetail data={groupSites} />}
        {activeTab === 'geo'         && (
          <GeoAnalysis
            siteProcIndex={siteProcIndex}
            procedureGroups={procGroups}
            groupSiteData={groupSites}
          />
        )}
        {activeTab === 'consultants' && <ConsultantView data={consultants} />}
      </main>
    </div>
  );
}
