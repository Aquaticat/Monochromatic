import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

//region All consumer mutations occur in disposable copies of inspected evidence
const root = process.cwd();
const fixture = mkdtempSync(join(tmpdir(), 'scan-indicator-review-'));
const evidence = join(fixture, 'questions', 'evidence');
mkdirSync(evidence, { recursive: true });
const manifestName = 'scan-indicator-witnesses.json';
const manifest = JSON.parse(readFileSync(join(root, 'questions', 'evidence', manifestName), 'utf8'));
for (const file of [manifestName, ...manifest.witnesses.map(item => item.file)]) {
  copyFileSync(join(root, 'questions', 'evidence', file), join(evidence, file));
}
const templatePath = join(fixture, 'questions', 'scan-indicator.template.html');
copyFileSync(join(root, 'questions', 'scan-indicator.template.html'), templatePath);
const builder = join(fixture, 'scan-indicator.mjs');
copyFileSync(join(root, 'scan-indicator.mjs'), builder);
const guards = {
  'without-exact-cohort': `if (JSON.stringify(Object.keys(images).sort()) !== JSON.stringify(expected.sort())) {\n  throw new Error('Scan-indicator review requires exact panel, scene, theme and scale combinations.');\n}`,
  'without-authored-state': 'JSON.stringify(capture.state) !== JSON.stringify(states[scene]) ||',
  'without-ellipsis-binding': `visible.endsWith('…') !== capture.statusEllipsized ||`,
};
const mutation = process.argv[2];
if (mutation !== undefined && !Object.hasOwn(guards, mutation)) throw new Error('Unknown scan-indicator consumer mutation.');
if (mutation !== undefined) {
  const source = readFileSync(builder, 'utf8');
  if (source.split(guards[mutation]).length !== 2) throw new Error('Exact scan-indicator guard target absent.');
  writeFileSync(builder, source.replace(guards[mutation], ''));
}
function invoke(command) { return spawnSync(process.execPath, [builder, command], { cwd: fixture, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }); }
function positive() {
  for (const command of ['build', 'validate']) {
    const run = invoke(command);
    if (run.status !== 0) throw new Error('Positive scan-indicator consumer failed: ' + run.stderr);
  }
}
function reject({ input, diagnostic }) {
  writeFileSync(join(evidence, manifestName), JSON.stringify(input));
  const run = invoke('build');
  if (run.status === 0 || !run.stderr.includes(diagnostic)) throw new Error('Expected scan-indicator rejection absent: ' + diagnostic);
  writeFileSync(join(evidence, manifestName), JSON.stringify(manifest));
}
function witness({ input, panel, scene, scale }) {
  const found = input.witnesses.find(item => item.panel === panel && item.scene === scene && item.fontScale === scale && item.scheme === 'light');
  if (!found) throw new Error('Scan-indicator test witness absent.');
  return found;
}
// Applies one change to a fresh copy of the manifest and expects the builder to refuse it.
function rejectChange({ panel, scene, scale, change, diagnostic }) {
  const input = structuredClone(manifest);
  change(witness({ input, panel, scene, scale }));
  reject({ input, diagnostic });
}
const output = join(fixture, 'questions', 'scan-indicator.html');
try {
  positive();
  const built = readFileSync(output, 'utf8');
  for (const statement of ['is ellipsized in 6 active views', 'which show only “Analysing true peak · 412…” or “Analysing true peak · 9,9…”',
    'its ink stays 1 to 2 physical pixels clear of the outline on the leading side', 'and 5 on the trailing side on both panels',
    'Pause at 200% keeps at least 29 pixels clear', 'both labels at 100% keep at least 57.']) {
    if (!built.includes(statement)) throw new Error('Generated inspection finding absent: ' + statement);
  }

  //region A changed measured inset is followed, not compared with a fixed crop
  const changedInset = structuredClone(manifest);
  const view = changedInset.witnesses[0];
  const imagePath = join(evidence, view.file);
  const original = readFileSync(imagePath);
  const sourcePath = join(fixture, 'inset-source.png');
  writeFileSync(sourcePath, original);
  view.applicationRoot[1]++;
  view.cropPixels.y++;
  view.cropPixels.height--;
  const crop = spawnSync('magick', ['-limit', 'thread', '2', '-limit', 'memory', '256MiB', sourcePath,
    '-crop', `${view.cropPixels.width}x${view.cropPixels.height}+0+1`, '+repage', '-strip', '-define', 'png:exclude-chunks=all', 'PNG24:' + imagePath], { encoding: 'utf8' });
  if (crop.status !== 0) throw new Error('Synthetic changed-inset fixture failed: ' + crop.stderr);
  view.sha256 = createHash('sha256').update(readFileSync(imagePath)).digest('hex');
  writeFileSync(join(evidence, manifestName), JSON.stringify(changedInset));
  positive();
  writeFileSync(imagePath, original);
  writeFileSync(join(evidence, manifestName), JSON.stringify(manifest));
  //endregion

  //region Digest, authored state and acquisition
  const acquisition = 'digest, authored state or acquisition assertion differs';
  for (const [field, value] of [['sha256', '0'.repeat(64)], ['controlPaddingDp', 12], ['stableAppFrames', false],
    ['keyboardClosed', false], ['renderer', 'different-renderer'], ['containerImageId', 'different-image']]) {
    rejectChange({ panel: 'inner', scene: 'running', scale: 1, change: item => { item[field] = value; }, diagnostic: acquisition });
  }
  // Idle views carry no bar text, so only the authored-state guard can refuse a changed idle count.
  rejectChange({ panel: 'inner', scene: 'idle', scale: 1, change: item => { item.state.done = 1; }, diagnostic: acquisition });
  rejectChange({ panel: 'cover', scene: 'paused', scale: 2, change: item => { item.state.phase = 'running'; }, diagnostic: acquisition });
  //endregion

  //region Fixed bar and control slot, label and the inspected status reading
  const slot = 'bar, control slot or status assertion differs';
  const full = 'Analysing true peak · 412 of 1,218';
  for (const change of [
    item => { item.statusEllipsized = false; },
    item => { item.control[2]++; },
    item => { item.control[1] = item.control[3] - 116; },
    item => { item.bar[1]--; },
    item => { item.player[3]--; },
    item => { item.controlLabel = 'Resume'; },
    item => { item.controlTextLayoutOverflow = true; },
    item => { item.statusLines = 2; },
    item => { item.inspectedVisibleStatus = full; },
    item => { item.inspectedVisibleStatus = full + '…'; },
    item => { item.inspectedVisibleStatus = 'Analysing true peak · 999…'; },
    item => { item.inspectedVisibleStatus = '…'; },
    item => { item.inspectedVisibleStatus = '</p><script>alert(1)</script> & "quoted" \n…'; },
    item => { item.controlLabelClearPixels.left = -1; },
    item => { item.controlLabelClearPixels = null; },
  ]) {
    rejectChange({ panel: 'cover', scene: 'running', scale: 2, change, diagnostic: slot });
  }
  // A view whose native flag reports no overflow cannot be described as ellipsized.
  rejectChange({ panel: 'inner', scene: 'paused', scale: 2, change: item => { item.inspectedVisibleStatus = 'Analysing true peak · 412…'; }, diagnostic: slot });
  rejectChange({ panel: 'inner', scene: 'wide-count', scale: 1, change: item => { item.inspectedVisibleStatus = full; }, diagnostic: slot });
  //endregion

  //region Idle views keep no bar, status or reserved slot
  const idle = 'idle view retains a bar, status or reserved slot';
  for (const change of [
    item => { item.bar = [0, item.applicationRoot[3] - 137, item.applicationRoot[2], item.applicationRoot[3]]; },
    item => { item.player[3] -= 137; },
    item => { item.barAbsent = false; },
    item => { item.inspectedVisibleStatus = full; },
  ]) {
    rejectChange({ panel: 'cover', scene: 'idle', scale: 1, change, diagnostic: idle });
  }
  //endregion

  //region Crop, path and exact cohort
  rejectChange({ panel: 'inner', scene: 'idle', scale: 2, change: item => { item.cropPixels.y++; }, diagnostic: 'measured application bounds' });
  rejectChange({ panel: 'inner', scene: 'idle', scale: 2, change: item => { item.file = '../outside.png'; }, diagnostic: 'outside the evidence boundary' });
  rejectChange({ panel: 'inner', scene: 'idle', scale: 2, change: item => { item.scheme = 'dark'; }, diagnostic: 'filename and metadata disagree' });
  const missing = structuredClone(manifest);
  missing.witnesses.splice(missing.witnesses.indexOf(witness({ input: missing, panel: 'cover', scene: 'idle', scale: 2 })), 1);
  reject({ input: missing, diagnostic: 'exact panel, scene, theme and scale combinations' });
  const duplicate = structuredClone(manifest);
  duplicate.witnesses.push(structuredClone(duplicate.witnesses[0]));
  reject({ input: duplicate, diagnostic: 'Duplicate scan-indicator witness' });
  const otherArtifact = structuredClone(manifest);
  otherArtifact.apkSha256 = '60fe847ebbd5d5c6694fbecddb08b87142b6d258137579ff0dee93901541bf29';
  reject({ input: otherArtifact, diagnostic: 'artifact or inspected cohort differs' });
  //endregion

  //region Template slots, ballot boundary and committed output
  const template = readFileSync(templatePath, 'utf8');
  writeFileSync(templatePath, template.replace('<form id="review-form">', '<form id="review-form"><input type="radio" name="policy">'));
  if (invoke('build').status !== 0 || invoke('validate').status === 0) throw new Error('Policy ballot boundary failed.');
  writeFileSync(templatePath, template.replace('__SCAN_INDICATOR_FINDINGS__', ''));
  if (invoke('build').status === 0) throw new Error('Template without a findings slot accepted.');
  writeFileSync(templatePath, template);
  positive();
  writeFileSync(output, readFileSync(output, 'utf8').replace('Design evidence only.', 'Changed output.'));
  if (invoke('validate').status === 0) throw new Error('Changed scan-indicator output accepted.');
  //endregion
  console.log('Scan-indicator consumer artifact, authored-state, bar-slot, status-reading, idle, crop, provenance, cohort and no-ballot controls passed.');
} finally {
  rmSync(fixture, { recursive: true, force: true });
}
//endregion
