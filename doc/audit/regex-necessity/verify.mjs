// Final verification: reconcile the ledger against GitHub, check for duplicates and
// missing sites, and sample labels and bodies.
import { readFileSync, } from 'node:fs';
import { execFileSync, } from 'node:child_process';
import { join, } from 'node:path';
import { homedir, } from 'node:os';

const AUDIT = process.env.REGEX_AUDIT_WORK ?? `${homedir()}/temp/agent/regex-audit`;
const ROOT = readFileSync(join(AUDIT, 'repo-root.txt'), 'utf8').trim();

const payloads = JSON.parse(readFileSync(join(AUDIT, 'payloads.json'), 'utf8'));
const ledger = readFileSync(join(AUDIT, 'filed2.jsonl'), 'utf8').split('\n')
  .filter((line) => line.trim() !== '')
  .map((line) => JSON.parse(line));

const bySiteId = new Map();
for (const entry of ledger) {
  const list = bySiteId.get(entry.siteId) ?? [];
  list.push(entry);
  bySiteId.set(entry.siteId, list);
}
const duplicates = [...bySiteId.entries()].filter(([, list]) => list.length > 1);
const missing = payloads.filter((payload) => bySiteId.has(payload.siteId) === false);

console.log(JSON.stringify({
  payloads: payloads.length,
  ledgerEntries: ledger.length,
  distinctSites: bySiteId.size,
  duplicateSiteIds: duplicates.length,
  missingSites: missing.length,
  edited: ledger.filter((entry) => entry.action === 'edited').length,
  created: ledger.filter((entry) => entry.action === 'created').length,
}, null, 2));

if (duplicates.length > 0) {
  for (const [siteId, list] of duplicates.slice(0, 10)) {
    console.log(`DUPLICATE ${siteId} -> ${list.map((entry) => `#${entry.number}`).join(', ')}`);
  }
}
if (missing.length > 0) {
  for (const payload of missing.slice(0, 10)) {
    console.log(`MISSING ${payload.siteId} ${payload.repoPath}:${payload.line}`);
  }
}

// Sample three issues across the batches and read them back from GitHub.
const samples = [ledger[0], ledger[Math.floor(ledger.length / 2)], ledger.at(-1)];
for (const entry of samples) {
  if (entry === undefined) continue;
  const view = JSON.parse(execFileSync('gh', ['issue', 'view', String(entry.number), '--json', 'number,title,labels,state', '--jq', '{number,title,state,labels:[.labels[].name]}'], { cwd: ROOT, encoding: 'utf8', timeout: 120_000, }));
  console.log(`SAMPLE ${JSON.stringify(view)}`);
}

// Independent count from the tracker side: every open issue carrying the audit marker.
const search = execFileSync('gh', ['issue', 'list', '--state', 'open', '--limit', '1000', '--search', 'drop the unnecessary regex in:title', '--json', 'number', '--jq', '[.number]'], { cwd: ROOT, encoding: 'utf8', timeout: 180_000, });
const numbers = JSON.parse(search);
console.log(`TRACKER open issues titled "drop the unnecessary regex": ${numbers.length}`);
const ledgerNumbers = new Set(ledger.map((entry) => Number(entry.number)));
const orphans = numbers.filter((number) => ledgerNumbers.has(number) === false);
console.log(`in tracker but not in ledger: ${orphans.length} ${orphans.slice(0, 10).join(',')}`);
