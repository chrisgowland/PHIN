'use strict';
// Creates a trimmed top-consultants file for the dashboard (top 200 by private spells)
const fs = require('fs');

const all = JSON.parse(fs.readFileSync('data/processed/vol_by_consultant.json', 'utf8'));
const top200 = all
  .filter(c => c.privateSpells !== null)
  .sort((a, b) => (b.privateSpells || 0) - (a.privateSpells || 0))
  .slice(0, 200);

fs.writeFileSync(
  'data/processed/top_consultants.json',
  JSON.stringify(top200, null, 2)
);
console.log(`Wrote top_consultants.json (${top200.length} records)`);
