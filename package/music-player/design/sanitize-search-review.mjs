import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// The throwaway branch holds raw Fold captures; only scrubbed design evidence enters main.
const output = process.env.MUSIC_PLAYER_REVIEW_OUTPUT;
if (!output) throw new Error('Set MUSIC_PLAYER_REVIEW_OUTPUT to the target design/questions/render directory.');
const prototype = resolve('questions/render');
const destination = resolve(output);
const fontPath = process.env.MUSIC_PLAYER_REVIEW_FONT ??
  execFileSync('fc-match', ['sans-serif', '--format', '%{file}'], { encoding: 'utf8' }).trim();
if (!fontPath) throw new Error('No installed sans-serif font for the anonymized system clock.');
mkdirSync(destination, { recursive: true });
const coverTyping = [process.env.MUSIC_PLAYER_COVER_IME_LIGHT, process.env.MUSIC_PLAYER_COVER_IME_DARK];
if (coverTyping.filter(Boolean).length === 1) {
  throw new Error('Supply both light and dark cover IME captures, or neither.');
}
const captures = [
  ...['right', 'right-lift', 'mirrored'].flatMap((candidate) =>
    ['light', 'dark'].flatMap((mode) => [
      { source: `search-choice-inner-${candidate}-empty-${mode}-s100.png`, panel: 'inner', mode, scale: '100' },
      { source: `search-choice-inner-${candidate}-typing-${mode}-s200.png`, panel: 'inner', mode, scale: '200' },
    ])),
  ...['light', 'dark'].flatMap((mode) => ['100', '200'].map((scale) => ({
    source: `search-deck-cover-left-results-${mode}-s${scale}.png`, panel: 'cover', mode, scale,
  }))),
  ...(coverTyping[0] && coverTyping[1] ? coverTyping.map((sourcePath, index) => ({
    sourcePath, outputName: `search-review-cover-typing-${index === 0 ? 'light' : 'dark'}-s200.png`,
    panel: 'cover', mode: index === 0 ? 'light' : 'dark', scale: '200',
  })) : []),
];
for (const capture of captures) {
  const inner = capture.panel === 'inner';
  const upperBand = inner ? 135 : 151;
  const maskRight = inner ? 570 : 350;
  const ink = capture.mode === 'dark' ? '#ffffff' : '#171820';
  const surface = capture.mode === 'dark' ? '#000000' : '#ffffff';
  const fontSize = capture.scale === '200' ? 57 : 37;
  const baseline = capture.scale === '200' ? 93 : 81;
  const start = inner ? 149 : 61;
  const file = join(destination, capture.outputName ?? `search-review-${capture.source}`);
  // This ImageMagick build exits successfully even with -regard-warnings; inspect stderr ourselves.
  const result = spawnSync('magick', [capture.sourcePath ?? join(prototype, capture.source),
    '-fill', surface, '-draw', `rectangle 0,0 ${maskRight},${upperBand}`,
    '-font', fontPath, '-pointsize', String(fontSize),
    '-fill', ink, '-annotate', `+${start}+${baseline}`, '9:41',
    '-strip', file], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0 || result.stderr.trim() !== '') {
    throw new Error(`${capture.source ?? capture.outputName}: ImageMagick status ${result.status}; ${result.stderr.trim()}`);
  }
  console.log(file);
}
