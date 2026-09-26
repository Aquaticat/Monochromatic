import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Rebuild only selected D51 A after D52 removed the repeated positive-results heading.
const question = join(process.cwd(), 'questions');
const render = join(question, 'render');
const templateFile = join(question, 'current.template.html');
const outputFile = join(question, 'current.html');
const overflowPng = readFileSync(join(render, 'search-cover-viewport-refinement-s200.png'));
if (overflowPng.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    overflowPng.readUInt32BE(16) !== 1080 || overflowPng.readUInt32BE(20) !== 2424) {
  throw new Error('Accepted D56 cover capture has wrong physical panel size.');
}
const overflowUrl = `data:image/png;base64,${overflowPng.toString('base64')}`;
const captures = Object.fromEntries(['inner', 'cover'].map((panel) => [panel,
  Object.fromEntries(['results', 'typing', 'empty'].map((state) => [state,
    Object.fromEntries(['light', 'dark'].map((scheme) => {
      const scale = state === 'typing' ? '200' : '100';
      const name = `search-selected-review-${panel}-${state}-${scheme}-s${scale}.png`;
      const png = readFileSync(join(render, name));
      const dimensions = panel === 'inner' ? [2076, 2152] : [1080, 2424];
      if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
          png.readUInt32BE(16) !== dimensions[0] || png.readUInt32BE(20) !== dimensions[1]) {
        throw new Error(`${name}: wrong physical panel or non-PNG evidence.`);
      }
      return [scheme, `data:image/png;base64,${png.toString('base64')}`];
    }))])),
]));
const command = process.argv[2];
if (command === 'build') {
  const template = readFileSync(templateFile, 'utf8');
  if (template.split('__SELECTED_CAPTURES__').length !== 2) {
    throw new Error('Selected review must have exactly one embedded capture slot.');
  }
  if (template.split('__ACCEPTED_COVER_OVERFLOW__').length !== 2) {
    throw new Error('Selected D56 review must embed exactly one accepted cover capture.');
  }
  writeFileSync(outputFile, template.replace('__SELECTED_CAPTURES__', JSON.stringify(captures))
    .replace('__ACCEPTED_COVER_OVERFLOW__', overflowUrl));
  console.log(`Built selected D51/D52 review in ${outputFile}.`);
} else if (command === 'validate') {
  const html = readFileSync(outputFile, 'utf8');
  const begin = html.indexOf('const captures = ');
  const end = html.indexOf(';\nconst state = ', begin);
  if (begin < 0 || end < 0) throw new Error('Selected review capture map missing.');
  const embedded = JSON.parse(html.slice(begin + 'const captures = '.length, end));
  if (JSON.stringify(embedded) !== JSON.stringify(captures)) {
    throw new Error('Embedded selected rasters differ from sanitized physical-panel sources.');
  }
  if (!html.includes(`id="accepted-overflow" src="${overflowUrl}"`)) {
    throw new Error('Accepted cover raster differs from the sanitized physical-panel source.');
  }
  for (const marker of ['Search A, with reachable folded-cover results',
    'D51', 'D52', 'D56', 'not Gboard', '7.5mm', 'Reset 100%', 'data-panel="inner"',
    'data-panel="cover"', 'data-preview="overflow"', 'Reply in this chat']) {
    if (!html.includes(marker)) throw new Error(`Selected review contract missing ${marker}.`);
  }
  if (html.includes('data-variant="right"') || html.includes('data-variant="mirrored"') ||
      html.includes('__SELECTED_CAPTURES__') || html.includes('__ACCEPTED_COVER_OVERFLOW__') ||
      html.includes('id="control-image"') || html.includes('<script src=')) {
    throw new Error('Rejected options or external scripts leaked into the selected review.');
  }
  console.log('Validated the self-contained A-only native Fold Search review.');
} else {
  throw new Error('Expected build or validate.');
}
