'use strict';

/**
 * PHIN Market Share Ingestion Pipeline
 *
 * Reads PHIN Hospital Volume & LoS and Consultant Volume & LoS Excel files,
 * cleans and aggregates the data, and outputs processed JSON for the dashboard.
 *
 * Usage: node pipeline/ingest.js [--hospital <path>] [--consultant <path>]
 *
 * Defaults to data/raw/Hospital_Volume_LoS_Oct24_Sep25.xlsx and
 *             data/raw/Consultant_Volume_LoS_Oct24_Sep25.xlsx
 */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { mapProviderToGroup } = require('./groupMap');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(flag, defaultVal) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : defaultVal;
}
const HOSPITAL_FILE = getArg('--hospital', 'data/raw/Hospital_Volume_LoS_Oct24_Sep25.xlsx');
const CONSULTANT_FILE = getArg('--consultant', 'data/raw/Consultant_Volume_LoS_Oct24_Sep25.xlsx');
const OUT_DIR = 'data/processed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Excel date serial to ISO date string */
function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date.toISOString().split('T')[0];
}

/** Convert suppressed "*" or empty values to null; parse valid numbers */
function cleanNum(val) {
  if (val === '*' || val === '' || val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/**
 * Parse a sheet by finding the header row (first row where cell A is not a
 * long prose string) and returning an array of objects.
 * headerRowValue: exact string to match in column A to identify header row.
 */
function parseSheet(ws, headerRowValue) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });

  // Find the header row
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === headerRowValue) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error(`Header "${headerRowValue}" not found in sheet`);
  }

  const headers = rows[headerIdx];
  const records = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(v => v === null)) continue;
    const obj = {};
    headers.forEach((h, j) => {
      if (h) obj[h] = row[j] !== undefined ? row[j] : null;
    });
    records.push(obj);
  }
  return records;
}

// ---------------------------------------------------------------------------
// Parse Hospital file
// ---------------------------------------------------------------------------
console.log('Reading hospital file:', HOSPITAL_FILE);
const hospitalWb = XLSX.readFile(HOSPITAL_FILE);

// --- Organisation Reference Data ---
const orgWs = hospitalWb.Sheets['Organisation Reference Data'];
const orgRaw = parseSheet(orgWs, 'Provider PHIN ID');

const siteMetadata = {};
orgRaw.forEach(r => {
  siteMetadata[r['Site PHIN ID']] = {
    siteId: r['Site PHIN ID'],
    siteName: r['Site'],
    provider: r['Provider'],
    providerId: r['Provider PHIN ID'],
    sector: r['Sector'],
    city: r['Site City'],
    postcode: r['Site Postcode'],
    region: r['Site GOR'],
    lat: typeof r['Site Latitude'] === 'number' ? r['Site Latitude'] : null,
    lng: typeof r['Site Longitude'] === 'number' ? r['Site Longitude'] : null,
    group: mapProviderToGroup(r['Provider']),
  };
});

console.log(`  Loaded ${Object.keys(siteMetadata).length} sites from Org Reference Data`);

// --- Vol by Site ---
const volBySiteWs = hospitalWb.Sheets['Vol by Site'];
const volBySiteRaw = parseSheet(volBySiteWs, 'Provider PHIN ID');

const volBySite = volBySiteRaw.map(r => {
  const meta = siteMetadata[r['Site PHIN ID']] || {};
  return {
    siteId: r['Site PHIN ID'],
    siteName: r['Site'],
    provider: r['Provider'],
    providerId: r['Provider PHIN ID'],
    sector: r['Sector'],
    group: meta.group || mapProviderToGroup(r['Provider']),
    city: meta.city || null,
    postcode: meta.postcode || null,
    region: meta.region || null,
    lat: meta.lat || null,
    lng: meta.lng || null,
    monthsExpected: r['Months Of Expected Data'],
    monthsProvided: r['Months Of Provided Data'],
    privateEpisodes: cleanNum(r['Private Episodes']),
    privateSpells: cleanNum(r['Private Spells']),
    nhsEpisodes: cleanNum(r['NHS Episodes']),
    nhsSpells: cleanNum(r['NHS Spells']),
    allEpisodes: cleanNum(r['All Activity Episodes']),
    allSpells: cleanNum(r['All Activity Spells']),
    periodFrom: excelDateToISO(r['Period From']),
    periodTo: excelDateToISO(r['Period To']),
  };
});

// Filter to IND sector only (private hospitals) for market share
const volBySiteInd = volBySite.filter(r => r.sector === 'IND');
console.log(`  Vol by Site: ${volBySite.length} rows total, ${volBySiteInd.length} IND`);

// --- Vol by Site and Proc ---
const volBySiteProcWs = hospitalWb.Sheets['Vol by Site and Proc'];
const volBySiteProcRaw = parseSheet(volBySiteProcWs, 'Provider PHIN ID');

const volBySiteProc = volBySiteProcRaw.map(r => {
  const meta = siteMetadata[r['Site PHIN ID']] || {};
  return {
    siteId: r['Site PHIN ID'],
    siteName: r['Site'],
    provider: r['Provider'],
    providerId: r['Provider PHIN ID'],
    sector: r['Sector'],
    group: meta.group || mapProviderToGroup(r['Provider']),
    procedureGroupId: r['Procedure Group ID'],
    procedureGroup: r['Procedure Group'],
    privateProcedures: cleanNum(r['Private Procedures']),
    nhsProcedures: cleanNum(r['NHS Procedures']),
    allProcedures: cleanNum(r['All Activity Procedures']),
    periodFrom: excelDateToISO(r['Period From']),
    periodTo: excelDateToISO(r['Period To']),
  };
});

const volBySiteProcInd = volBySiteProc.filter(r => r.sector === 'IND');
console.log(`  Vol by Site and Proc: ${volBySiteProc.length} rows total, ${volBySiteProcInd.length} IND`);

// ---------------------------------------------------------------------------
// Parse Consultant file
// ---------------------------------------------------------------------------
console.log('Reading consultant file:', CONSULTANT_FILE);
const consultantWb = XLSX.readFile(CONSULTANT_FILE);

// --- Vol by Consultant ---
const volByConsultantWs = consultantWb.Sheets['Vol by Consultant'];
const volByConsultantRaw = parseSheet(volByConsultantWs, 'Consultant GMC');

const volByConsultant = volByConsultantRaw.map(r => ({
  gmc: r['Consultant GMC'],
  forenames: r['Consultant Forenames'],
  surname: r['Consultant Surname'],
  fullName: `${r['Consultant Forenames']} ${r['Consultant Surname']}`.trim(),
  privateEpisodes: cleanNum(r['Private Episodes']),
  privateSpells: cleanNum(r['Private Spells']),
  nhsEpisodes: cleanNum(r['NHS Episodes']),
  nhsSpells: cleanNum(r['NHS Spells']),
  allEpisodes: cleanNum(r['All Activity Episodes']),
  allSpells: cleanNum(r['All Activity Spells']),
  periodFrom: excelDateToISO(r['Period From']),
  periodTo: excelDateToISO(r['Period To']),
}));
console.log(`  Vol by Consultant: ${volByConsultant.length} rows`);

// --- Vol by Consultant and Proc ---
const volByConsultantProcWs = consultantWb.Sheets['Vol by Consultant and Proc'];
const volByConsultantProcRaw = parseSheet(volByConsultantProcWs, 'Consultant GMC');

const volByConsultantProc = volByConsultantProcRaw.map(r => ({
  gmc: r['Consultant GMC'],
  forenames: r['Consultant Forenames'],
  surname: r['Consultant Surname'],
  fullName: `${r['Consultant Forenames']} ${r['Consultant Surname']}`.trim(),
  procedureGroupId: r['Procedure Group ID'],
  procedureGroup: r['Procedure Group'],
  privateProcedures: cleanNum(r['Private Procedures']),
  nhsProcedures: cleanNum(r['NHS Procedures']),
  allProcedures: cleanNum(r['All Activity Procedures']),
  periodFrom: excelDateToISO(r['Period From']),
  periodTo: excelDateToISO(r['Period To']),
}));
console.log(`  Vol by Consultant and Proc: ${volByConsultantProc.length} rows`);

// ---------------------------------------------------------------------------
// Aggregate: Market Share by Group (IND sector only, private spells)
// ---------------------------------------------------------------------------
const GROUP_ORDER = ['Nuffield', 'Spire', 'Circle', 'Ramsay', 'Other'];

function aggregateByGroup(rows, valueField) {
  const totals = {};
  rows.forEach(r => {
    const g = r.group;
    const v = r[valueField];
    if (!totals[g]) totals[g] = { group: g, total: 0, suppressed: 0 };
    if (v === null) {
      totals[g].suppressed += 1;
    } else {
      totals[g].total += v;
    }
  });

  const grandTotal = Object.values(totals).reduce((s, g) => s + g.total, 0);
  return GROUP_ORDER.map(g => {
    const t = totals[g] || { group: g, total: 0, suppressed: 0 };
    return {
      group: g,
      privateSpells: t.total,
      suppressedSites: t.suppressed,
      marketSharePct: grandTotal > 0 ? Math.round((t.total / grandTotal) * 1000) / 10 : 0,
    };
  });
}

const marketShareSummary = aggregateByGroup(volBySiteInd, 'privateSpells');

// Add period info from first record
const periodFrom = volBySiteInd[0]?.periodFrom;
const periodTo = volBySiteInd[0]?.periodTo;
const totalPrivateSpells = marketShareSummary.reduce((s, g) => s + g.privateSpells, 0);

const marketShareOutput = {
  periodFrom,
  periodTo,
  totalPrivateSpells,
  byGroup: marketShareSummary,
};

// ---------------------------------------------------------------------------
// Aggregate: Vol by Specialty (Procedure Group) per Group
// ---------------------------------------------------------------------------
const specialtyMap = {};
volBySiteProcInd.forEach(r => {
  if (!r.procedureGroup || r.privateProcedures === null) return;
  const key = r.procedureGroup;
  if (!specialtyMap[key]) {
    specialtyMap[key] = {
      procedureGroupId: r.procedureGroupId,
      procedureGroup: r.procedureGroup,
      byGroup: {},
    };
    GROUP_ORDER.forEach(g => { specialtyMap[key].byGroup[g] = 0; });
  }
  const g = r.group;
  specialtyMap[key].byGroup[g] = (specialtyMap[key].byGroup[g] || 0) + r.privateProcedures;
});

// Compute totals and market share per specialty
const specialtyOutput = Object.values(specialtyMap).map(s => {
  const groupTotal = Object.values(s.byGroup).reduce((sum, v) => sum + v, 0);
  const byGroupArr = GROUP_ORDER.map(g => ({
    group: g,
    procedures: s.byGroup[g] || 0,
    marketSharePct: groupTotal > 0 ? Math.round(((s.byGroup[g] || 0) / groupTotal) * 1000) / 10 : 0,
  }));
  return {
    procedureGroupId: s.procedureGroupId,
    procedureGroup: s.procedureGroup,
    totalProcedures: groupTotal,
    byGroup: byGroupArr,
  };
}).sort((a, b) => b.totalProcedures - a.totalProcedures);

// ---------------------------------------------------------------------------
// Group-level site roll-up (for Nuffield-focused site league table)
// ---------------------------------------------------------------------------
const compGroupSummary = {};
GROUP_ORDER.forEach(g => {
  const sites = volBySiteInd.filter(r => r.group === g);
  compGroupSummary[g] = {
    group: g,
    siteCount: sites.length,
    totalPrivateSpells: sites.reduce((s, r) => s + (r.privateSpells || 0), 0),
    sites: sites
      .sort((a, b) => (b.privateSpells || 0) - (a.privateSpells || 0))
      .map(r => ({
        siteId: r.siteId,
        siteName: r.siteName,
        city: r.city,
        region: r.region,
        lat: r.lat,
        lng: r.lng,
        privateSpells: r.privateSpells,
        privateEpisodes: r.privateEpisodes,
        nhsSpells: r.nhsSpells,
        nhsEpisodes: r.nhsEpisodes,
        allSpells: r.allSpells,
        monthsProvided: r.monthsProvided,
      })),
  };
});

// ---------------------------------------------------------------------------
// Site-procedure index for geographic market share analysis
// siteId → { siteId, siteName, group, city, region, lat, lng, procs: { procedureGroup: volume } }
// Only IND sites with at least one non-suppressed procedure.
// ---------------------------------------------------------------------------
const siteProcMap = {};
volBySiteProcInd.forEach(r => {
  if (r.privateProcedures === null) return;
  if (!siteProcMap[r.siteId]) {
    const meta = volBySiteInd.find(s => s.siteId === r.siteId) || {};
    siteProcMap[r.siteId] = {
      siteId: r.siteId,
      siteName: r.siteName,
      group: r.group,
      city: meta.city || null,
      region: meta.region || null,
      lat: meta.lat || null,
      lng: meta.lng || null,
      procs: {},
    };
  }
  const existing = siteProcMap[r.siteId].procs[r.procedureGroup] || 0;
  siteProcMap[r.siteId].procs[r.procedureGroup] = existing + r.privateProcedures;
});

const siteProcIndex = Object.values(siteProcMap);
const allProcedureGroups = [...new Set(
  volBySiteProcInd.map(r => r.procedureGroup).filter(Boolean)
)].sort();

console.log(`  Site-procedure index: ${siteProcIndex.length} sites, ${allProcedureGroups.length} procedure groups`);

// ---------------------------------------------------------------------------
// NHS site-procedure index (same shape as siteProcIndex but using nhsProcedures)
// ---------------------------------------------------------------------------
const nhsSiteProcMap = {};
volBySiteProcInd.forEach(r => {
  if (r.nhsProcedures === null) return;
  if (!nhsSiteProcMap[r.siteId]) {
    const meta = volBySiteInd.find(s => s.siteId === r.siteId) || {};
    nhsSiteProcMap[r.siteId] = {
      siteId: r.siteId,
      siteName: r.siteName,
      group: r.group,
      city: meta.city || null,
      region: meta.region || null,
      lat: meta.lat || null,
      lng: meta.lng || null,
      procs: {},
    };
  }
  nhsSiteProcMap[r.siteId].procs[r.procedureGroup] =
    (nhsSiteProcMap[r.siteId].procs[r.procedureGroup] || 0) + r.nhsProcedures;
});
const nhsSiteProcIndex = Object.values(nhsSiteProcMap);

// ---------------------------------------------------------------------------
// NHS group site summary (same shape as compGroupSummary but using nhsSpells)
// ---------------------------------------------------------------------------
const nhsGroupSummary = {};
GROUP_ORDER.forEach(g => {
  const sites = volBySiteInd.filter(r => r.group === g);
  nhsGroupSummary[g] = {
    group: g,
    siteCount: sites.length,
    totalNhsSpells: sites.reduce((s, r) => s + (r.nhsSpells || 0), 0),
    sites: sites
      .sort((a, b) => (b.nhsSpells || 0) - (a.nhsSpells || 0))
      .map(r => ({
        siteId: r.siteId,
        siteName: r.siteName,
        city: r.city,
        region: r.region,
        lat: r.lat,
        lng: r.lng,
        nhsSpells: r.nhsSpells,
        nhsEpisodes: r.nhsEpisodes,
        monthsProvided: r.monthsProvided,
      })),
  };
});

console.log(`  NHS site-procedure index: ${nhsSiteProcIndex.length} sites`);

// ---------------------------------------------------------------------------
// Write outputs
// ---------------------------------------------------------------------------
function writeJSON(filename, data) {
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`  Wrote ${outPath} (${kb} KB)`);
}

console.log('\nWriting processed JSON files...');
writeJSON('market_share_summary.json', marketShareOutput);
writeJSON('specialty_breakdown.json', specialtyOutput);
writeJSON('vol_by_site.json', volBySiteInd);
writeJSON('vol_by_site_and_proc.json', volBySiteProcInd);
writeJSON('group_site_summary.json', compGroupSummary);
writeJSON('site_procedure_index.json', siteProcIndex);
writeJSON('procedure_groups.json', allProcedureGroups);
writeJSON('vol_by_consultant.json', volByConsultant);
writeJSON('vol_by_consultant_and_proc.json', volByConsultantProc);
writeJSON('nhs_site_procedure_index.json', nhsSiteProcIndex);
writeJSON('nhs_group_site_summary.json', nhsGroupSummary);

console.log('\n✓ Pipeline complete');
console.log(`  Period: ${periodFrom} to ${periodTo}`);
console.log(`  Total IND private spells: ${totalPrivateSpells.toLocaleString()}`);
console.log('\n  Market Share Summary:');
marketShareSummary.forEach(g => {
  console.log(`    ${g.group.padEnd(10)} ${g.privateSpells.toLocaleString().padStart(8)} spells  ${g.marketSharePct}%`);
});
