import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Build the main checkout's self-contained documentation from scrubbed native evidence.
const root = process.env.MUSIC_PLAYER_REVIEW_ROOT;
if (!root) throw new Error('MUSIC_PLAYER_REVIEW_ROOT must name the main design/questions directory.');
const question = resolve(root);
const render = join(question, 'render');
const templateFile = join(question, 'archive', 'search-three-way-before-a.template.html');
const outputFile = join(question, 'archive', 'search-three-way-before-a.html');
const source = (filename) => {
  const png = readFileSync(join(render, filename));
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(`${filename} is not a PNG.`);
  }
  return `data:image/png;base64,${png.toString('base64')}`;
};
const entries = Object.fromEntries(['lift', 'right', 'mirrored', 'cover'].map((key) => [key,
  Object.fromEntries(['empty', 'typing'].map((state) => [state,
    Object.fromEntries(['light', 'dark'].map((scheme) => {
      const filename = key === 'cover' ?
        (state === 'typing' ? `search-review-cover-typing-${scheme}-s200.png` :
          `search-review-search-deck-cover-left-results-${scheme}-s100.png`) :
        `search-review-search-choice-inner-${key === 'lift' ? 'right-lift' : key}-${state}-${scheme}-s${state === 'typing' ? '200' : '100'}.png`;
      const image = source(filename);
      const pixels = Buffer.from(image.slice('data:image/png;base64,'.length), 'base64');
      const expected = key === 'cover' ? [1080, 2424] : [2076, 2152];
      if (pixels.readUInt32BE(16) !== expected[0] || pixels.readUInt32BE(20) !== expected[1]) {
        throw new Error(`${filename} does not match the ${key} panel's physical pixels.`);
      }
      return [scheme, image];
    }))])),
]));
const command = process.argv[2];
if (command === 'build') {
  const template = readFileSync(templateFile, 'utf8');
  if (template.split('__CAPTURES__').length !== 2) {
    throw new Error('The review template must contain exactly one captures slot.');
  }
  writeFileSync(outputFile, template.replace('__CAPTURES__', JSON.stringify(entries)));
  console.log(`Embedded native Fold capture matrix in ${outputFile}.`);
} else if (command === 'validate') {
  const html = readFileSync(outputFile, 'utf8');
  const start = html.indexOf('const captures = ');
  const end = html.indexOf(';\nconst scene = ', start);
  if (start < 0 || end < 0) throw new Error('Embedded capture map missing.');
  const actual = JSON.parse(html.slice(start + 'const captures = '.length, end));
  if (JSON.stringify(actual) !== JSON.stringify(entries)) throw new Error('Review images differ from the sanitized capture files.');
  for (const marker of ['Search while playback stays in view', '7.5mm', '300dp',
    'not Gboard', 'A &gt; B &gt; C', 'id="correction"', 'data-variant="lift"',
    'data-variant="right"', 'data-variant="mirrored"', 'Reset 100%']) {
    if (!html.includes(marker)) throw new Error(`Missing review contract: ${marker}`);
  }
  if (html.includes('__CAPTURES__') || html.includes('<script src=') || html.includes('<link rel="stylesheet"')) {
    throw new Error('The review is not self-contained.');
  }
  console.log('Validated embedded physical-pixel captures and the provisional review contract.');
} else {
  throw new Error('Expected build or validate.');
}
