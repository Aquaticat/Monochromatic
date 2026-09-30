import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

//region Disposable consumer fixture, never mutate committed evidence while proving validators
const root = process.cwd();
const fixture = mkdtempSync(join(tmpdir(), 'filename-review-'));
const evidence = join(fixture, 'questions', 'evidence');
mkdirSync(evidence, { recursive: true });
const manifestFile = 'search-filename-comparison-witnesses.json';
const comparison = JSON.parse(readFileSync(join(root, 'questions', 'evidence', manifestFile), 'utf8'));
const baselineFile = 'search-filename-actual-player-witnesses.json';
const baseline = JSON.parse(readFileSync(join(root, 'questions', 'evidence', baselineFile), 'utf8'));
for (const file of [manifestFile, baselineFile, ...comparison.witnesses.map(item => item.file), ...baseline.captures.map(item => item.image)]) {
  copyFileSync(join(root, 'questions', 'evidence', file), join(evidence, file));
}
copyFileSync(join(root, 'questions', 'search-filename-comparison.template.html'), join(fixture, 'questions', 'search-filename-comparison.template.html'));
const builderPath = join(fixture, 'search-filename-comparison.mjs');
copyFileSync(join(root, 'search-filename-comparison.mjs'), builderPath);
const mutation = process.argv[2];
if (mutation !== undefined && mutation !== 'without-exact-cohort') throw new Error('Unknown filename review test mutation.');
if (mutation === 'without-exact-cohort') {
  const guard = `if (JSON.stringify(Object.keys(images).sort()) !== JSON.stringify(expectedKeys.sort())) {\n  throw new Error('Filename review must contain the exact initial, baseline and six scrolled combinations.');\n}`;
  const source = readFileSync(builderPath, 'utf8');
  if (source.split(guard).length !== 2) throw new Error('Exact-cohort mutation target differs.');
  writeFileSync(builderPath, source.replace(guard, ''));
}
function invoke(command) {
  return spawnSync(process.execPath, [join(fixture, 'search-filename-comparison.mjs'), command], {
    cwd: fixture, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
  });
}
function writeComparison(data) { writeFileSync(join(evidence, manifestFile), JSON.stringify(data)); }
function expectRejection({ data, diagnostic }) {
  writeComparison(data);
  const result = invoke('build');
  if (result.status === 0 || !result.stderr.includes(diagnostic)) {
    throw new Error(`Expected filename review rejection absent: ${diagnostic}; status ${result.status}.`);
  }
  writeComparison(comparison);
}
try {
  const positive = invoke('build');
  if (positive.status !== 0 || invoke('validate').status !== 0) throw new Error('Disposable positive review failed.');
  const wrongHash = structuredClone(comparison);
  wrongHash.witnesses[0].sha256 = '0'.repeat(64);
  expectRejection({ data: wrongHash, diagnostic: 'capture hash, dimension or environment failed' });
  const traversal = structuredClone(comparison);
  traversal.witnesses[0].file = '../outside.png';
  expectRejection({ data: traversal, diagnostic: 'outside the allowed evidence boundary' });
  const mismatchedName = structuredClone(comparison);
  mismatchedName.witnesses[0].scene = 'another-scene';
  expectRejection({ data: mismatchedName, diagnostic: 'filename and capture metadata disagree' });
  const missingScroll = structuredClone(comparison);
  const target = missingScroll.witnesses.find(item => item.position === 'scrolled');
  const original = target.file;
  target.scene = 'unusedscroll';
  target.file = `search-filename-comparison-${target.panel}-unusedscroll-end-${target.scheme}-s200.png`;
  copyFileSync(join(evidence, original), join(evidence, target.file));
  expectRejection({ data: missingScroll, diagnostic: 'exact initial, baseline and six scrolled combinations' });
  const output = join(fixture, 'questions', 'search-filename-comparison.html');
  writeFileSync(output, readFileSync(output, 'utf8').replace('No policy is preselected.', 'Changed review.'));
  const changed = invoke('validate');
  if (changed.status === 0 || !changed.stderr.includes('differs from template and checked evidence')) {
    throw new Error('Changed output was not rejected.');
  }
  console.log('Filename review disposable positive, hash, traversal, metadata, exact-scroll and changed-output checks passed.');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
//endregion
