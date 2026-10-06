import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { drawnTexts, expected, scenes } from './template-editor-scenes.mjs';

//region Inspected native cohort, each view checked from its own image, its record and the grammar
// D88: nothing is compared with a recorded digest. What is checked about an image is read from the image,
// and what a view draws is checked against what the template reference yields for its authored state.
const question = join(process.cwd(), 'questions');
const evidence = join(question, 'evidence');
const manifest = JSON.parse(readFileSync(join(evidence, 'template-editor-witnesses.json'), 'utf8'));
const panels = { inner: [2076, 2152], cover: [1080, 2424] };
if (manifest.schema !== 1 || !Array.isArray(manifest.witnesses)) throw new Error('Template editor review manifest is not this study.');
const images = {};
const facts = {};
for (const capture of manifest.witnesses) {
  const file = capture.file;
  if (!/^template-editor-(?:inner|cover)-[a-z-]+-(?:light|dark)-s(?:100|200)\.png$/.test(file)) {
    throw new Error('Template editor capture path is outside the allowed evidence boundary.');
  }
  const state = scenes.find(candidate => candidate.id === capture.scene);
  if (!state || file !== `template-editor-${capture.panel}-${capture.scene}-${capture.scheme}-s${capture.fontScale * 100}.png`) {
    throw new Error('Template editor capture filename and metadata disagree.');
  }
  const png = readFileSync(join(evidence, file));
  const [physicalWidth, physicalHeight] = panels[capture.panel];
  const crop = capture.cropPixels;
  // The status strip is removed and everything under it kept, the keyboard included.
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      capture.physicalPixels[0] !== physicalWidth || capture.physicalPixels[1] !== physicalHeight ||
      crop.x !== 0 || crop.width !== physicalWidth || !Number.isInteger(crop.y) || crop.y < 1 ||
      crop.y + crop.height !== physicalHeight || png.readUInt32BE(16) !== crop.width || png.readUInt32BE(20) !== crop.height ||
      capture.densityDpi !== 390 || capture.freshHierarchyValidated !== true || capture.productionServicesObserved !== false) {
    throw new Error(`${file}: template editor image geometry or acquisition assertion differs.`);
  }
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    const chunk = png.subarray(offset + 4, offset + 8).toString('ascii');
    if (!['IHDR', 'IDAT', 'IEND'].includes(chunk)) throw new Error('Template editor PNG contains unintended metadata.');
    offset += length + 12;
  }
  const want = expected(state);
  // A state that holds focus is captured with the keyboard open, and no other state is.
  if (capture.keyboardShown !== want.focused || (want.focused && !(Number.isInteger(capture.keyboardTop) &&
      capture.keyboardTop > crop.y && capture.keyboardTop < physicalHeight))) {
    throw new Error(`${file}: keyboard state differs from the authored state.`);
  }
  const called = drawnTexts(state);
  if (!Array.isArray(capture.drawn) || JSON.stringify(capture.drawn.map(item => [item.role, item.text])) !==
      JSON.stringify(called.map(item => [item.role, item.text]))) {
    throw new Error(`${file}: recorded copy differs from what the template reference yields for this state.`);
  }
  if (!Array.isArray(capture.uncalledPageTexts) || capture.uncalledPageTexts.length > 0) {
    throw new Error(`${file}: the page draws text its state does not call for.`);
  }
  // What counts as in view is re-derived from each text's rectangle and the keyboard or navigation edge.
  if (!Number.isInteger(capture.viewBottom) || capture.viewBottom !== (want.focused ? capture.keyboardTop : capture.viewBottom) ||
      capture.viewBottom <= crop.y || capture.viewBottom > physicalHeight) {
    throw new Error(`${file}: the lower edge of the visible page is absent or implausible.`);
  }
  for (const item of capture.drawn) {
    const inView = item.bounds.some(bounds => bounds[1] >= crop.y && bounds[3] <= capture.viewBottom);
    if (item.inView !== inView) throw new Error(`${file}: recorded visibility of ${item.role} differs from its rectangle.`);
  }
  const key = `${capture.panel}/${capture.scene}/${capture.scheme}/${capture.fontScale}`;
  if (images[key]) throw new Error('Duplicate template editor capture.');
  images[key] = { file, width: crop.width, height: crop.height, density: 390, source: `data:image/png;base64,${png.toString('base64')}` };
  facts[key] = { keyboard: capture.keyboardShown, caretDrawn: capture.caretDrawn === true, scrolls: capture.scrollMax > 0,
    outOfView: capture.drawn.filter(item => !item.inView).map(item => item.role) };
}
for (const panel of Object.keys(panels)) for (const scheme of ['light', 'dark']) for (const scale of [1, 2]) for (const state of scenes) {
  if (!images[`${panel}/${state.id}/${scheme}/${scale}`]) {
    throw new Error(`Template editor review requires every authored state under every condition: ${panel}/${state.id}/${scheme}/${scale}`);
  }
}
if (Object.keys(images).length !== manifest.witnesses.length) throw new Error('Template editor review holds a view outside the authored cohort.');
// The theme must not change what is in view: a light and dark pair of the same state and size reports the same facts.
for (const key of Object.keys(facts)) {
  const [panel, scene, scheme, scale] = key.split('/');
  if (scheme === 'light' && JSON.stringify(facts[key].outOfView) !== JSON.stringify(facts[`${panel}/${scene}/dark/${scale}`].outOfView)) {
    throw new Error('Light and dark views of one state disagree about what is in view: ' + key);
  }
}
//endregion

//region Build and consumer validation
const template = readFileSync(join(question, 'template-editor.template.html'), 'utf8');
for (const slot of ['__TEMPLATE_EDITOR_IMAGES__', '__TEMPLATE_EDITOR_FACTS__', '__TEMPLATE_EDITOR_STATES__']) {
  if (template.split(slot).length !== 2) throw new Error('Expected one slot ' + slot + '.');
}
function embed(value) { return JSON.stringify(value).replaceAll('<', '\\u003c'); }
const states = Object.fromEntries(scenes.map(state => [state.id, expected(state)]));
const html = template.replace('__TEMPLATE_EDITOR_IMAGES__', () => embed(images)).replace('__TEMPLATE_EDITOR_FACTS__', () => embed(facts))
  .replace('__TEMPLATE_EDITOR_STATES__', () => embed(states));
const output = join(question, 'template-editor.html');
if (process.argv[2] === 'build') {
  writeFileSync(output, html);
  console.log(`Built the offline template editor review with ${manifest.witnesses.length} inspected native views.`);
} else if (process.argv[2] === 'validate') {
  if (readFileSync(output, 'utf8') !== html) throw new Error('Template editor review differs from template and checked evidence.');
  for (const marker of ['color-scheme: light dark', 'Every state is authored', 'Typing is not connected',
    'No production implementation is authorized', 'id="final-notes"', 'id="reply"', 'Native pixels', 'Reset 100% dp']) {
    if (!html.includes(marker)) throw new Error(`Template editor review is missing ${marker}.`);
  }
  if ((html.match(/<form\b/g) ?? []).length !== 1 ||
      /__TEMPLATE_EDITOR_[A-Z]+__|<script\b[^>]*\bsrc=|<link\b[^>]*\bhref=|<img\b[^>]*\bsrc="https?:/i.test(html)) {
    throw new Error('Template editor review must be one self-contained form.');
  }
  console.log('Validated the offline template editor review against its evidence and the template reference.');
} else {
  throw new Error('Expected build or validate.');
}
//endregion
