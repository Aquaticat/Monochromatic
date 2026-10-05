import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

//region Disposable consumer inputs, committed native evidence is never mutated
const root = process.cwd();
const fixture = mkdtempSync(join(tmpdir(), 'first-run-review-'));
const evidence = join(fixture, 'questions', 'evidence');
mkdirSync(evidence, { recursive: true });
const manifestFile = 'first-run-access-witnesses.json';
const manifest = JSON.parse(readFileSync(join(root, 'questions', 'evidence', manifestFile), 'utf8'));
for (const file of [manifestFile, ...manifest.witnesses.map(item => item.file)]) {
  copyFileSync(join(root, 'questions', 'evidence', file), join(evidence, file));
}
const templatePath = join(fixture, 'questions', 'first-run-access.template.html');
copyFileSync(join(root, 'questions', 'first-run-access.template.html'), templatePath);
const builder = join(fixture, 'first-run-access.mjs');
copyFileSync(join(root, 'first-run-access.mjs'), builder);
// Each named guard can be deleted from the disposable builder; the cases that prove it must then fail this test.
const guards = {
  'without-withdrawn-text': `capture.texts.some(text => typeof text !== 'string' || text.includes(withdrawn))`,
  'without-cohort': `if (!first) throw new Error('First-run review requires every authored state under every condition: ' + base);`,
  'without-drag-outcome': `typeof moved !== 'boolean' || moved !== (end !== undefined)`,
};
const removed = process.argv[2];
if (removed !== undefined) {
  if (!(removed in guards)) throw new Error('Unknown first-run review test mutation.');
  const source = readFileSync(builder, 'utf8');
  if (source.split(guards[removed]).length !== 2) throw new Error('Expected first-run guard absent: ' + removed);
  writeFileSync(builder, source.replace(guards[removed], () => removed === 'without-cohort' ? 'if (!first) continue;' : 'false'));
}
function invoke(command) {
  return spawnSync(process.execPath, [builder, command], { cwd: fixture, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
}
let rejected = 0;
function reject({ change, diagnostic }) {
  const input = structuredClone(manifest);
  change(input);
  writeFileSync(join(evidence, manifestFile), JSON.stringify(input));
  const run = invoke('build');
  if (run.status === 0 || !run.stderr.includes(diagnostic)) {
    throw new Error(`Expected first-run review rejection absent: ${diagnostic}; status ${run.status}.`);
  }
  writeFileSync(join(evidence, manifestFile), JSON.stringify(manifest));
  rejected += 1;
}
// An analysis state and a no-audio state whose first views did not move, for the cases that need one of each.
const explained = manifest.witnesses.findIndex(item => item.position === 'initial' && item.scene === 'not-opened' && item.dragTest.movedAppPixels === false);
const silent = manifest.witnesses.findIndex(item => item.position === 'initial' && item.scene === 'system-no-audio');
if (explained < 0 || silent < 0) throw new Error('Required positive fixtures absent.');
function endOf(first) {
  const file = first.file.replace('.png', '-end.png');
  copyFileSync(join(evidence, first.file), join(evidence, file));
  return { ...structuredClone(first), file, position: 'scrolled', dragTest: undefined,
    scrollProof: { appRgbChanged: true, verticalDisplacement: -90 } };
}
try {
  if (invoke('build').status !== 0 || invoke('validate').status !== 0) throw new Error('Positive first-run consumer failed.');
  reject({ change: input => { input.witnesses[0].file = '../outside.png'; }, diagnostic: 'outside the allowed evidence boundary' });
  reject({ change: input => { input.witnesses[0].scene = 'different'; }, diagnostic: 'filename and metadata disagree' });
  reject({ change: input => { input.witnesses[0].freshHierarchyValidated = false; }, diagnostic: 'image geometry or acquisition assertion differs' });
  reject({ change: input => { input.witnesses[0].cropPixels.y += 1; }, diagnostic: 'image geometry or acquisition assertion differs' });
  reject({ change: input => { input.witnesses[0].texts.push('After opening a library, choose whether to analyse it.'); },
    diagnostic: 'offers the withdrawn analysis choice' });
  reject({ change: input => { input.witnesses[silent].texts.push(input.analysisText); }, diagnostic: 'explains analysis in a state that has none' });
  reject({ change: input => { input.analysisText += ' After opening a library, choose whether to analyse it.'; },
    diagnostic: 'still offers the withdrawn analysis choice' });
  reject({ change: input => { input.witnesses.splice(silent, 1); }, diagnostic: 'requires every authored state under every condition' });
  reject({ change: input => { input.witnesses[explained].dragTest.movedAppPixels = true; }, diagnostic: 'end view and the recorded drag outcome disagree' });
  reject({ change: input => { input.witnesses[explained].texts = input.witnesses[explained].texts.filter(text => text !== input.analysisText); },
    diagnostic: 'analysis explanation is in neither kept view' });
  // A synthetic end view: accepted with a displaced body, refused without one, refused when its first view did not move.
  const accepted = structuredClone(manifest);
  accepted.witnesses[explained].dragTest.movedAppPixels = true;
  accepted.witnesses.push(endOf(accepted.witnesses[explained]));
  writeFileSync(join(evidence, manifestFile), JSON.stringify(accepted));
  if (invoke('build').status !== 0) throw new Error('A proven end view was refused.');
  writeFileSync(join(evidence, manifestFile), JSON.stringify(manifest));
  reject({ change: input => {
    input.witnesses[explained].dragTest.movedAppPixels = true;
    const end = endOf(input.witnesses[explained]);
    end.scrollProof.verticalDisplacement = 0;
    input.witnesses.push(end);
  }, diagnostic: 'lacks changed pixels and a displaced body' });
  reject({ change: input => { input.witnesses.push(endOf(input.witnesses[explained])); }, diagnostic: 'end view and the recorded drag outcome disagree' });
  if (invoke('build').status !== 0) throw new Error('Restored evidence build failed.');
  const template = readFileSync(templatePath, 'utf8');
  writeFileSync(templatePath, template.replace('<form id="review-form">', '<form id="review-form"><input type="radio" name="policy">'));
  if (invoke('build').status !== 0) throw new Error('Ballot fixture build failed.');
  const ballot = invoke('validate');
  if (ballot.status === 0 || !ballot.stderr.includes('not a policy ballot')) throw new Error('Policy ballot was not rejected.');
  writeFileSync(templatePath, template.replace('</header>', '<p>After opening a library, choose whether to analyse it.</p></header>'));
  if (invoke('build').status !== 0) throw new Error('Withdrawn-sentence fixture build failed.');
  const stale = invoke('validate');
  if (stale.status === 0 || !stale.stderr.includes('still states the withdrawn analysis choice')) throw new Error('Withdrawn sentence in the page was not rejected.');
  writeFileSync(templatePath, template);
  if (invoke('build').status !== 0 || invoke('validate').status !== 0) throw new Error('Restored template did not validate.');
  const output = join(fixture, 'questions', 'first-run-access.html');
  writeFileSync(output, readFileSync(output, 'utf8').replace('Design evidence only.', 'Changed output.'));
  if (invoke('validate').status === 0) throw new Error('Changed committed artifact was not rejected.');
  console.log(`First-run review consumer: positive, ${rejected} rejected manifests, a synthetic end view, ballot, withdrawn-sentence and changed-output checks passed.`);
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
//endregion
