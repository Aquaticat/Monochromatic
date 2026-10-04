import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

//region Disposable consumer inputs, committed native provenance is never mutated
const root = process.cwd();
const fixture = mkdtempSync(join(tmpdir(), 'first-run-review-'));
const evidence = join(fixture, 'questions', 'evidence');
mkdirSync(evidence, { recursive: true });
const manifestFile = 'first-run-access-witnesses.json';
const manifest = JSON.parse(readFileSync(join(root, 'questions', 'evidence', manifestFile), 'utf8'));
for (const file of [manifestFile, ...manifest.witnesses.map(item => item.file)]) {
  copyFileSync(join(root, 'questions', 'evidence', file), join(evidence, file));
}
copyFileSync(join(root, 'questions', 'first-run-access.template.html'), join(fixture, 'questions', 'first-run-access.template.html'));
const builder = join(fixture, 'first-run-access.mjs');
copyFileSync(join(root, 'first-run-access.mjs'), builder);
if (process.argv[2] !== undefined && process.argv[2] !== 'without-exact-cohort') {
  throw new Error('Unknown first-run review test mutation.');
}
if (process.argv[2] === 'without-exact-cohort') {
  const source = readFileSync(builder, 'utf8');
  const guard = `if (JSON.stringify(Object.keys(images).sort()) !== JSON.stringify(expected.sort())) {\n  throw new Error('First-run review requires exact initial and two proven inner no-source scroll combinations.');\n}`;
  if (source.split(guard).length !== 2) throw new Error('Expected exact first-run cohort guard absent.');
  writeFileSync(builder, source.replace(guard, ''));
}
function invoke(command) {
  return spawnSync(process.execPath, [builder, command], { cwd: fixture, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
}
function reject({ input, diagnostic }) {
  writeFileSync(join(evidence, manifestFile), JSON.stringify(input));
  const run = invoke('build');
  if (run.status === 0 || !run.stderr.includes(diagnostic)) {
    throw new Error(`Expected first-run review rejection absent: ${diagnostic}; status ${run.status}.`);
  }
  writeFileSync(join(evidence, manifestFile), JSON.stringify(manifest));
}
try {
  if (invoke('build').status !== 0 || invoke('validate').status !== 0) throw new Error('Positive first-run consumer failed.');
  const wrongHash = structuredClone(manifest);
  wrongHash.witnesses[0].sha256 = '0'.repeat(64);
  reject({ input: wrongHash, diagnostic: 'image digest, geometry or acquisition assertion differs' });
  const traversal = structuredClone(manifest);
  traversal.witnesses[0].file = '../outside.png';
  reject({ input: traversal, diagnostic: 'outside the allowed evidence boundary' });
  const wrongMetadata = structuredClone(manifest);
  wrongMetadata.witnesses[0].scene = 'different';
  reject({ input: wrongMetadata, diagnostic: 'filename and metadata disagree' });
  const wrongAssertion = structuredClone(manifest);
  wrongAssertion.witnesses[0].freshHierarchyValidated = false;
  reject({ input: wrongAssertion, diagnostic: 'image digest, geometry or acquisition assertion differs' });
  const missing = structuredClone(manifest);
  const target = missing.witnesses.find(item => item.position === 'scrolled');
  if (!target) throw new Error('Required scroll positive fixture absent.');
  const original = target.file;
  target.scene = 'unplanned';
  target.file = `first-run-access-${target.panel}-unplanned-${target.scheme}-s200-end.png`;
  copyFileSync(join(evidence, original), join(evidence, target.file));
  reject({ input: missing, diagnostic: 'exact initial and two proven inner no-source scroll combinations' });
  if (invoke('build').status !== 0) throw new Error('Restored evidence build failed.');
  const templatePath = join(fixture, 'questions', 'first-run-access.template.html');
  const template = readFileSync(templatePath, 'utf8');
  writeFileSync(templatePath, template.replace('<form id="review-form">', '<form id="review-form"><input type="radio" name="policy">'));
  if (invoke('build').status !== 0) throw new Error('Ballot fixture build failed.');
  const ballot = invoke('validate');
  if (ballot.status === 0 || !ballot.stderr.includes('not a policy ballot')) throw new Error('Policy ballot was not rejected.');
  writeFileSync(templatePath, template);
  if (invoke('build').status !== 0 || invoke('validate').status !== 0) throw new Error('Restored template did not validate.');
  const output = join(fixture, 'questions', 'first-run-access.html');
  writeFileSync(output, readFileSync(output, 'utf8').replace('Design evidence only.', 'Changed output.'));
  if (invoke('validate').status === 0) throw new Error('Changed committed artifact was not rejected.');
  console.log('First-run review disposable positive, hash, traversal, acquisition, metadata, exact-scroll, ballot and output checks passed.');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
//endregion
