import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

//region Exact inspected native cohort, no raw evidence enters the review
const question = join(process.cwd(), 'questions');
const evidence = join(question, 'evidence');
const manifest = JSON.parse(readFileSync(join(evidence, 'first-run-access-witnesses.json'), 'utf8'));
if (manifest.witnesses.length !== 34 || manifest.counts.initial !== 32 || manifest.counts.scrolled !== 2 ||
    manifest.apkSha256 !== '54603701d6b942128a23c9f070ad55c1283312321aa980daf50469e00cf80398' ||
    manifest.prototypeCommit !== 'a534bf5ac985e091cc93d6c663c24d72ad82a91c') {
  throw new Error('First-run review provenance or cohort differs from the inspected study.');
}
const images = {};
const expected = [];
for (const panel of ['inner', 'cover']) {
  for (const scheme of ['light', 'dark']) {
    for (const scale of [1, 2]) {
      for (const scene of ['declined', 'not-opened', 'system-no-audio', 'folder-no-audio']) {
        expected.push(`comparison/${panel}/${scene}/${scheme}/${scale}/initial`);
      }
    }
    if (panel === 'inner') expected.push(`comparison/inner/not-opened/${scheme}/2/scrolled`);
  }
}
for (const capture of manifest.witnesses) {
  const file = capture.file;
  if (!/^first-run-access-(?:inner|cover)-[a-z-]+-(?:light|dark)-s(?:100|200)(?:-end)?\.png$/.test(file)) {
    throw new Error('First-run capture path is outside the allowed evidence boundary.');
  }
  const suffix = capture.position === 'scrolled' ? '-end' : '';
  const expectedFile = `first-run-access-${capture.panel}-${capture.scene}-${capture.scheme}-s${capture.fontScale * 100}${suffix}.png`;
  if (file !== expectedFile || !['initial', 'scrolled'].includes(capture.position)) {
    throw new Error('First-run capture filename and metadata disagree.');
  }
  const png = readFileSync(join(evidence, file));
  const hash = createHash('sha256').update(png).digest('hex');
  const width = capture.panel === 'inner' ? 2076 : 1080;
  const height = capture.panel === 'inner' ? 2016 : 2273;
  if (hash !== capture.sha256 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height ||
      capture.cropPixels.width !== width || capture.cropPixels.height !== height ||
      capture.densityDpi !== 390 || capture.keyboardClosed !== true || capture.freshHierarchyValidated !== true) {
    throw new Error(`${file}: first-run image digest, geometry or acquisition assertion differs.`);
  }
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const chunk = png.subarray(offset + 4, offset + 8).toString('ascii');
    if (!['IHDR', 'IDAT', 'IEND'].includes(chunk)) throw new Error('First-run PNG contains unintended metadata.');
    offset += length + 12;
  }
  const key = `comparison/${capture.panel}/${capture.scene}/${capture.scheme}/${capture.fontScale}/${capture.position}`;
  if (images[key]) throw new Error('Duplicate first-run review capture.');
  images[key] = { file, hash, width, height, density: 390, source: `data:image/png;base64,${png.toString('base64')}` };
}
if (JSON.stringify(Object.keys(images).sort()) !== JSON.stringify(expected.sort())) {
  throw new Error('First-run review requires exact initial and two proven inner no-source scroll combinations.');
}
//endregion

//region Build and consumer validation, authored states never become implicit policy selection
const template = readFileSync(join(question, 'first-run-access.template.html'), 'utf8');
if (template.split('__FIRST_RUN_REVIEW_IMAGES__').length !== 2) throw new Error('Expected one first-run image slot.');
const serialized = JSON.stringify(images).replaceAll('<', '\\u003c');
const html = template.replace('__FIRST_RUN_REVIEW_IMAGES__', () => serialized);
const output = join(question, 'first-run-access.html');
if (process.argv[2] === 'build') {
  writeFileSync(output, html);
  console.log('Built offline first-run state evidence with 34 inspected native witnesses.');
} else if (process.argv[2] === 'validate') {
  if (readFileSync(output, 'utf8') !== html) throw new Error('First-run review differs from template and checked evidence.');
  for (const marker of ['color-scheme: light dark', 'Existing requirements, no cosmetic-policy ballot',
    'Every state is authored debug input', 'not real discovery or permission evaluation',
    'No production implementation is authorized', 'Open a folder', 'in-app Settings',
    'automatic WorkManager initialization', 'id="final-notes"', 'id="reply"', 'Native pixels', 'Reset 100% dp']) {
    if (!html.includes(marker)) throw new Error(`First-run review is missing ${marker}.`);
  }
  if ((html.match(/<form\b/g) ?? []).length !== 1 ||
      /__FIRST_RUN_REVIEW_IMAGES__|<script\b[^>]*\bsrc=|<link\b[^>]*\bhref=|<img\b[^>]*\bsrc="https?:/i.test(html) ||
      /<input\b[^>]*\btype="radio"|name="placement"|name="visibility"|<textarea\b(?:[^"'<>]|"[^"]*"|'[^']*')*?\srequired(?:\s|=|>)/i.test(html)) {
    throw new Error('First-run review must be self-contained evidence, not a policy ballot.');
  }
  console.log('Validated exact offline first-run review, optional observations and native provenance.');
} else {
  throw new Error('Expected build or validate.');
}
//endregion
