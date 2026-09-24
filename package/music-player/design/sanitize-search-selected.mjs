import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Post-D51/D52 review contains only selected A; mask simulated status notifications before sharing.
const output = process.env.MUSIC_PLAYER_REVIEW_OUTPUT;
if (!output) throw new Error('Set MUSIC_PLAYER_REVIEW_OUTPUT to the main design/questions/render directory.');
const input = resolve('questions/render');
const destination = resolve(output);
const font = execFileSync('fc-match', ['sans-serif', '--format', '%{file}'], { encoding: 'utf8' }).trim();
if (!font) throw new Error('No installed font for anonymized status clock.');
mkdirSync(destination, { recursive: true });
const captures = ['inner', 'cover'].flatMap((panel) =>
  ['light', 'dark'].flatMap((mode) => [
    { panel, mode, stage: 'empty', scale: '100' },
    { panel, mode, stage: 'results', scale: '100' },
    { panel, mode, stage: 'typing', scale: '200' },
  ]));
for (const capture of captures) {
  const inner = capture.panel === 'inner';
  const band = inner ? 135 : 151;
  const edge = inner ? 570 : 350;
  const ink = capture.mode === 'dark' ? '#ffffff' : '#171820';
  const surface = capture.mode === 'dark' ? '#000000' : '#ffffff';
  const fontSize = capture.scale === '200' ? 57 : 37;
  const baseline = capture.scale === '200' ? 93 : 81;
  const start = inner ? 149 : 61;
  const name = `search-selected-${capture.panel}-${capture.stage}-${capture.mode}-s${capture.scale}.png`;
  const file = join(destination, `search-selected-review-${capture.panel}-${capture.stage}-${capture.mode}-s${capture.scale}.png`);
  const result = spawnSync('magick', [join(input, name),
    '-fill', surface, '-draw', `rectangle 0,0 ${edge},${band}`,
    '-font', font, '-pointsize', String(fontSize),
    '-fill', ink, '-annotate', `+${start}+${baseline}`, '9:41',
    '-strip', file], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0 || result.stderr.trim() !== '') {
    throw new Error(`${name}: ImageMagick status ${result.status}; ${result.stderr.trim()}`);
  }
  console.log(file);
}
