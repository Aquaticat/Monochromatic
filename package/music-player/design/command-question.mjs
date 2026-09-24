// Build and verify the self-contained native-Slint command-bar design round.
// The prior cover-P form is retained at questions/archive/cover-p.html.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const templatePath = join(root, 'questions', 'current.template.html');
const outputPath = join(root, 'questions', 'current.html');
const renderPath = join(root, 'questions', 'render');
const surfaces = [1, 2, 3];
const contents = [1, 2, 3];
const modes = ['dark', 'light'];

/** Names one native Slint raster without relying on positional array order. */
function basename({ surface, content, mode, compact }) {
  return `command-round-s${surface}-c${content}-${mode}-${compact ? 'compact' : 'wide'}`;
}

/** Reads the exact native PNG that will be embedded in one picture source. */
function encodedImage(scene) {
  return readFileSync(join(renderPath, `${basename(scene)}.png`)).toString('base64');
}

/** Produces a native-pixel preview pair for one intersection of the two independent axes. */
function cardHtml({ surface, content, compact }) {
  const dark = `data:image/png;base64,${encodedImage({ surface, content, mode: 'dark', compact })}`;
  const light = `data:image/png;base64,${encodedImage({ surface, content, mode: 'light', compact })}`;
  const label = `S${surface} × C${content}${compact ? '' : ' · expanded viewport'}`;
  const width = compact ? 480 : 1100;
  const height = compact ? 600 : 640;
  return `<figure class="capture${compact ? '' : ' wide'}" data-label="${label}">
    <h3>${label}</h3>
    <picture><source media="(prefers-color-scheme: dark)" srcset="${dark}"><img src="${light}" width="${width}" height="${height}" alt="Native Slint ${label} command-bar study, light scheme"></picture>
    <figcaption class="small">Native Slint · ${width} × ${height}px · thumbnail follows system scheme.</figcaption>
    <div class="preview-actions"><button type="button" data-scheme="dark">Preview dark</button><button type="button" data-scheme="light">Preview light</button></div>
  </figure>`;
}

/** Replaces the two native-capture slots; all media stays embedded for offline review. */
function build() {
  const grid = surfaces.flatMap((surface) => contents.map((content) => cardHtml({ surface, content, compact: true })));
  const wide = cardHtml({ surface: 1, content: 1, compact: false });
  const template = readFileSync(templatePath, 'utf8');
  if (!template.includes('__COMMAND_GRID__') || !template.includes('__COMMAND_WIDE__')) {
    throw new Error('Command template lost a native-capture slot.');
  }
  const html = template.replace('__COMMAND_GRID__', grid.join('\n')).replace('__COMMAND_WIDE__', wide);
  writeFileSync(outputPath, html);
  console.log('Built self-contained desktop command-bar questionnaire.');
}

/** Checks the Slint frame color at a quiet pixel inside the first panel. */
function panelPixel(mode) {
  const file = join(renderPath, `${basename({ surface: 1, content: 1, mode, compact: true })}.png`);
  return execFileSync('magick', [file, '-format', '%[pixel:p{20,175}]', 'info:'], { encoding: 'utf8' }).trim();
}

/** Rejects stale rasters, omitted modes, clipboard controls, and incomplete form semantics. */
function validate() {
  const html = readFileSync(outputPath, 'utf8');
  if (html.includes('__COMMAND_GRID__') || html.includes('__COMMAND_WIDE__')) {
    throw new Error('Command questionnaire retains a capture placeholder.');
  }
  if (/<script\s+[^>]*src=|<link\s+[^>]*href=/i.test(html) || /navigator\.clipboard|clipboardData|execCommand\(\s*['"]copy/.test(html)) {
    throw new Error('Command questionnaire depends on an external resource or clipboard API.');
  }
  const scenes = [
    ...surfaces.flatMap((surface) => contents.flatMap((content) => modes.map((mode) => ({ surface, content, mode, compact: true })))),
    ...modes.map((mode) => ({ surface: 1, content: 1, mode, compact: false })),
  ];
  const urls = [...html.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)].map((match) => match[1]);
  if (urls.length !== scenes.length || new Set(urls).size !== scenes.length) {
    throw new Error(`Command questionnaire carries ${urls.length} data URLs and ${new Set(urls).size} distinct rasters; expected ${scenes.length} each.`);
  }
  for (const scene of scenes) {
    const encoded = encodedImage(scene);
    const count = urls.filter((url) => url === encoded).length;
    if (count !== 1) throw new Error(`${basename(scene)}: embedded native raster is missing or stale (${count} references).`);
    const image = Buffer.from(encoded, 'base64');
    if (image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new Error(`${basename(scene)}: evidence is not a PNG.`);
    }
    const expected = scene.compact ? [480, 600] : [1100, 640];
    if (image.readUInt32BE(16) !== expected[0] || image.readUInt32BE(20) !== expected[1]) {
      throw new Error(`${basename(scene)}: wrong native dimensions.`);
    }
  }
  for (const source of ['name="surface"', 'name="content"', 'name="correction"', 'Surface ranking: S1 &gt; S2 &gt; S3', 'Content ranking: C1 &gt; C2 &gt; C3', 'D21', 'D25', 'off by default', 'preview.showModal()', 'returnTarget?.focus()']) {
    if (!html.includes(source)) throw new Error(`Command questionnaire is missing ${source}.`);
  }
  if ((html.match(/type="radio"/g) ?? []).length !== 6 || (html.match(/<fieldset>/g) ?? []).length !== 2) {
    throw new Error('Command questionnaire must ask two separable three-option questions.');
  }
  if ((html.match(/class="capture/g) ?? []).length !== 10 || (html.match(/data-scheme="dark"/g) ?? []).length !== 10 || (html.match(/data-scheme="light"/g) ?? []).length !== 10) {
    throw new Error('Command questionnaire must disclose all nine intersections and the wide stress capture in both schemes.');
  }
  if (panelPixel('dark') !== 'srgba(30,31,38,1)' || panelPixel('light') !== 'srgba(231,231,241,1)') {
    throw new Error('Command native panels lost the measured dark/light high-container reference.');
  }
  console.log('Desktop command-bar questionnaire is valid.');
}

if (process.argv[2] === 'build') build();
else if (process.argv[2] === 'validate') validate();
else throw new Error('Usage: node command-question.mjs build|validate');
