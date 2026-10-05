import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

//region Exact inspected native scan cohort, not a scan policy or real analysis result
const questions = join(process.cwd(), 'questions');
const evidence = join(questions, 'evidence');
const manifest = JSON.parse(readFileSync(join(evidence, 'scan-indicator-witnesses.json'), 'utf8'));
if (manifest.schema !== 1 || manifest.apkSha256 !== 'c06ec80240e41641fee1fdec79313a8294b9595544740145f4fa6f2b1f77ddf1' ||
    manifest.prototypeCommit !== '25a95411750c5c5356631fc508513c42a81ad1c4' || !Array.isArray(manifest.witnesses)) {
  throw new Error('Scan-indicator artifact or inspected cohort differs.');
}
const states = {
  idle: { phase: 'idle', done: 0, total: 1218 },
  running: { phase: 'running', done: 412, total: 1218 },
  paused: { phase: 'paused', done: 412, total: 1218 },
  'wide-count': { phase: 'running', done: 9999998, total: 9999999 },
};
const expected = [];
for (const panel of ['inner', 'cover']) for (const scene of Object.keys(states)) {
  for (const scheme of ['light', 'dark']) for (const scale of [1, 2]) {
    expected.push(`comparison/${panel}/${scene}/${scheme}/${scale}/initial`);
  }
}
function rectangle(value) {
  return Array.isArray(value) && value.length === 4 && value.every(Number.isInteger) && value[2] > value[0] && value[3] > value[1];
}
// Encoded at the HTML interpolation point; the status guard already limits these strings to authored text.
function escapeHtml(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
const images = {};
const active = [];
for (const capture of manifest.witnesses) {
  const { file, panel, scene, scheme, fontScale } = capture;
  if (!/^scan-indicator-(?:inner|cover)-[a-z-]+-(?:light|dark)-s(?:100|200)\.png$/.test(file)) {
    throw new Error('Scan-indicator image path is outside the evidence boundary.');
  }
  if (file !== `scan-indicator-${panel}-${scene}-${scheme}-s${fontScale * 100}.png`) {
    throw new Error('Scan-indicator filename and metadata disagree.');
  }
  const width = panel === 'inner' ? 2076 : 1080;
  const physicalHeight = panel === 'inner' ? 2152 : 2424;
  const bounds = capture.applicationRoot;
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isInteger) ||
      bounds[0] !== 0 || bounds[2] !== width || bounds[1] < 1 || bounds[1] >= physicalHeight / 2 ||
      bounds[3] <= bounds[1] || bounds[3] > physicalHeight ||
      JSON.stringify(capture.physicalPixels) !== JSON.stringify([width, physicalHeight]) ||
      capture.cropPixels.x !== 0 || capture.cropPixels.y !== bounds[1]) {
    throw new Error('Scan-indicator crop must follow its measured application bounds.');
  }
  const height = physicalHeight - bounds[1];
  const png = readFileSync(join(evidence, file));
  const hash = createHash('sha256').update(png).digest('hex');
  if (hash !== capture.sha256 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height || png[24] !== 8 || png[25] !== 2 ||
      capture.cropPixels.width !== width || capture.cropPixels.height !== height || capture.densityDpi !== 390 ||
      capture.inspected !== true || capture.freshHierarchyValidated !== true || capture.keyboardClosed !== true ||
      capture.stableAppFrames !== true || capture.controlPaddingDp !== 0 ||
      JSON.stringify(capture.state) !== JSON.stringify(states[scene]) ||
      capture.containerImageId !== '4b8805002ee369c81b7826b941afc52c0c9678a0d0e427a0fefd1684b78b5f94' ||
      capture.systemImageFingerprint !== 'google/sdk_gphone16k_x86_64/emu64xa16k:17/CE2A.260420.050/16231978:user/dev-keys' ||
      capture.renderer !== 'Android Emulator OpenGL ES Translator (llvmpipe (LLVM 20.1.2, 256 bits))') {
    throw new Error('Scan-indicator digest, authored state or acquisition assertion differs.');
  }
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const chunk = png.subarray(offset + 4, offset + 8).toString('ascii');
    if (!['IHDR', 'IDAT', 'IEND'].includes(chunk)) throw new Error('Scan-indicator PNG contains unintended metadata.');
    offset += length + 12;
  }
  let statusNote;
  if (scene === 'idle') {
    if (capture.bar !== null || capture.control !== null || capture.barAbsent !== true || capture.statusLines !== 0 ||
        capture.statusEllipsized !== false || capture.controlLabel !== null || capture.inspectedVisibleStatus !== null ||
        capture.controlLabelClearPixels !== null || !rectangle(capture.player) || capture.player[3] !== bounds[3]) {
      throw new Error('Scan-indicator idle view retains a bar, status or reserved slot.');
    }
    statusNote = 'no scan bar and no reserved slot';
  } else {
    const { bar, control, player } = capture;
    const { done, total } = capture.state;
    const fullStatus = `Analysing true peak · ${done.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}`;
    const visible = capture.inspectedVisibleStatus;
    const clear = capture.controlLabelClearPixels;
    // 56dp bar, 100dp control and the 48dp control floor at the measured 390dpi density.
    if (!rectangle(bar) || !rectangle(control) || !rectangle(player) ||
        bar[0] !== 0 || bar[2] !== width || bar[3] !== bounds[3] || bar[3] - bar[1] !== 137 || player[3] !== bar[1] ||
        control[2] - control[0] !== 244 || control[3] - control[1] < 117 ||
        control[0] < bar[0] || control[1] < bar[1] || control[2] > bar[2] || control[3] > bar[3] ||
        capture.barAbsent !== false || capture.statusLines !== 1 || capture.controlTextLines !== 1 ||
        capture.controlTextLayoutOverflow !== false ||
        capture.controlLabel !== (capture.state.phase === 'paused' ? 'Resume' : 'Pause') ||
        capture.statusEllipsized !== (panel === 'cover' && fontScale === 2) || typeof visible !== 'string' ||
        visible.endsWith('…') !== capture.statusEllipsized ||
        (capture.statusEllipsized ? visible.length < 2 || !fullStatus.startsWith(visible.slice(0, -1)) || visible.length > fullStatus.length
          : visible !== fullStatus) ||
        clear === null || !Number.isInteger(clear.left) || !Number.isInteger(clear.right) || clear.left < 0 || clear.right < 0) {
      throw new Error('Scan-indicator bar, control slot or status assertion differs.');
    }
    statusNote = (capture.statusEllipsized ? `status ellipsized, showing “${visible}”` : 'status shows both counts in full') +
      ` · ${capture.controlLabel} label ${Math.min(clear.left, clear.right)} px clear of the control outline`;
    active.push(capture);
  }
  const key = `comparison/${panel}/${scene}/${scheme}/${fontScale}/initial`;
  if (images[key]) throw new Error('Duplicate scan-indicator witness.');
  images[key] = { file, hash, width, height, density: 390, statusNote, source: `data:image/png;base64,${png.toString('base64')}` };
}
if (JSON.stringify(Object.keys(images).sort()) !== JSON.stringify(expected.sort())) {
  throw new Error('Scan-indicator review requires exact panel, scene, theme and scale combinations.');
}
//endregion

//region Inspection findings stated from the witnesses, so the page cannot drift from its evidence
function range(values) {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? String(low) : `${low} to ${high}`;
}
const ellipsized = active.filter(capture => capture.statusEllipsized);
const shown = [...new Set(ellipsized.map(capture => capture.inspectedVisibleStatus))].sort();
const resumeLarge = active.filter(capture => capture.controlLabel === 'Resume' && capture.fontScale === 2);
const pauseLarge = active.filter(capture => capture.controlLabel === 'Pause' && capture.fontScale === 2);
const normal = active.filter(capture => capture.fontScale === 1);
if (ellipsized.length === 0 || resumeLarge.length === 0 || pauseLarge.length === 0 || normal.length === 0) {
  throw new Error('Scan-indicator findings need ellipsized, large-text and default-text witnesses.');
}
function leastClear(captures) {
  return Math.min(...captures.map(capture => Math.min(capture.controlLabelClearPixels.left, capture.controlLabelClearPixels.right)));
}
const shownText = shown.map(text => `“${escapeHtml(text)}”`).join(' or ');
const leading = range(resumeLarge.map(capture => capture.controlLabelClearPixels.left));
const trailing = range(resumeLarge.map(capture => capture.controlLabelClearPixels.right));
const findings = `<p id="inspection-findings" class="note">Inspection found two things worth opening.
On the cover panel at 200% text the status label is ellipsized in ${ellipsized.length} active views,
which show only ${shownText}; the hidden counts are not presented as visible.
At 200% text the Resume label spans nearly the whole fixed control:
its ink stays ${leading} physical pixels clear of the outline on the leading side
and ${trailing} on the trailing side on both panels, with no glyph cut.
Pause at 200% keeps at least ${leastClear(pauseLarge)} pixels clear,
and both labels at 100% keep at least ${leastClear(normal)}.</p>`;
//endregion

//region Offline review preserves the accepted indicator and keeps observations optional
const template = readFileSync(join(questions, 'scan-indicator.template.html'), 'utf8');
if (template.split('__SCAN_INDICATOR_IMAGES__').length !== 2) throw new Error('Expected one scan-indicator image slot.');
if (template.split('__SCAN_INDICATOR_FINDINGS__').length !== 2) throw new Error('Expected one scan-indicator findings slot.');
const html = template.replace('__SCAN_INDICATOR_FINDINGS__', () => findings)
  .replace('__SCAN_INDICATOR_IMAGES__', () => JSON.stringify(images).replaceAll('<', '\\u003c'));
const output = join(questions, 'scan-indicator.html');
if (process.argv[2] === 'build') {
  writeFileSync(output, html);
  console.log('Built offline native scan-indicator evidence from exact inspected witnesses.');
} else if (process.argv[2] === 'validate') {
  if (readFileSync(output, 'utf8') !== html) throw new Error('Scan-indicator output differs from its template and evidence.');
  for (const marker of ['color-scheme: light dark', 'D26 is settled; no new preference ballot',
    'Every progress value is authored debug input', 'single-line ellipsis', 'id="inspection-findings"',
    'not presented as visible', 'No production implementation is authorized', 'id="final-notes"', 'Native pixels',
    'Reset 100% dp']) {
    if (!html.includes(marker)) throw new Error('Scan-indicator review is missing ' + marker);
  }
  if ((html.match(/<form\b/g) ?? []).length !== 1 ||
      /__SCAN_INDICATOR_[A-Z]+__|<script\b[^>]*\bsrc=|<link\b[^>]*\bhref=|<img\b[^>]*\bsrc="https?:/i.test(html) ||
      /<input\b[^>]*\btype="radio"|<textarea\b(?:[^"'<>]|"[^"]*"|'[^']*')*?\srequired(?:\s|=|>)/i.test(html)) {
    throw new Error('Scan-indicator review must remain offline evidence, not a policy ballot.');
  }
  console.log('Validated exact offline native scan-indicator evidence and authored-state limits.');
} else {
  throw new Error('Expected build or validate.');
}
//endregion
