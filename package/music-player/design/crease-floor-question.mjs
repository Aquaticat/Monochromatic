import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** Embed a sanitized selected-A native screenshot in an offline E2 policy form. */
const root = process.cwd();
const question = join(root, 'questions');
const template = join(question, 'crease-floor.template.html');
const output = join(question, 'crease-floor-review.html');
const png = readFileSync(join(question, 'render', 'search-selected-review-inner-typing-light-s200.png'));
if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    png.readUInt32BE(16) !== 2076 || png.readUInt32BE(20) !== 2152) {
  throw new Error('E2 review source must be a physical inner-panel capture.');
}
const original = readFileSync(template, 'utf8');
if (original.split('__CREASE_IMAGE__').length !== 2) throw new Error('Expected one capture slot.');
const expected = original.replace('__CREASE_IMAGE__', `data:image/png;base64,${png.toString('base64')}`);
const action = process.argv[2];
if (action === 'build') {
  writeFileSync(output, expected);
  console.log(`Built ${output}`);
} else if (action === 'validate') {
  const actual = readFileSync(output, 'utf8');
  if (actual !== expected) throw new Error('Crease form does not match its sanitized selected-A source.');
  for (const marker of ['P10 &gt; P0 &gt; P12', 'not a visual fit test',
    'not necessarily in the same state', 'min_padding = 0mm', 'name="floor"',
    'Anything else you want settled or changed?', 'Response path:', 'Reset 100%',
    'prefers-color-scheme: dark']) {
    if (!actual.includes(marker)) throw new Error(`Missing E2 policy contract: ${marker}`);
  }
  if (actual.includes('<script src=') || actual.includes('<link rel="stylesheet"')) {
    throw new Error('E2 review must be self-contained.');
  }
  console.log('Validated self-contained E2 policy review and physical-panel capture.');
} else {
  throw new Error('Expected build or validate.');
}
