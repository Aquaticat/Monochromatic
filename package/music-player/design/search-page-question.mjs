// Build and verify the one-design D47/D48 Search page review.
// The rejected I/G/R questionnaire remains archived and is never rebuilt here.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const templatePath = join(root, 'questions', 'current.template.html');
const outputPath = join(root, 'questions', 'current.html');
const renderPath = join(root, 'questions', 'render');
const referencePath = join(root, 'questions', 'evidence', 'search-page-header-comparison.png');
const modes = ['dark', 'light'];
const stages = ['player', 'open-empty', 'open-results', 'open-none', 'open-unavailable'];
const groups = {
  COMPACT: stages.map((stage) => ({ stage, size: 'compact' })),
  WIDE: stages.slice(0, 3).map((stage) => ({ stage, size: 'wide' })),
  STRESS: stages.map((stage) => ({ stage, size: 'stress' })),
};
const titles = {
  player: 'Player · Search button',
  'open-empty': 'Search page · empty',
  'open-results': 'Search page · sample results',
  'open-none': 'Search page · no results',
  'open-unavailable': 'Search page · library unavailable',
};

/** Names one native Slint state without a positional screenshot index. */
function basename({ stage, mode, size }) {
  return `search-page-${stage}-${mode}-${size}`;
}

/** Reads the exact native image for one state and scheme. */
function encodedImage(scene) {
  return readFileSync(join(renderPath, `${basename(scene)}.png`)).toString('base64');
}

/** Embeds both schemes for one state while keeping every card's label specific. */
function cardHtml({ stage, size }) {
  const dark = `data:image/png;base64,${encodedImage({ stage, mode: 'dark', size })}`;
  const light = `data:image/png;base64,${encodedImage({ stage, mode: 'light', size })}`;
  const width = size === 'wide' ? 1100 : (size === 'stress' ? 360 : 480);
  const height = size === 'compact' ? 600 : 640;
  const label = `${titles[stage]} · ${width} × ${height}px`;
  return `<figure class="capture" data-stage="${stage}" data-size="${size}" data-label="${label}">
    <h3>${label}</h3>
    <picture><source media="(prefers-color-scheme: dark)" srcset="${dark}"><img src="${light}" width="${width}" height="${height}" alt="Native Slint ${label}, scheme follows system setting"></picture>
    <figcaption class="small">Native Slint · light and dark · ${size} desktop study.</figcaption>
    <div class="preview-actions"><button type="button" data-scheme="dark">Preview dark</button><button type="button" data-scheme="light">Preview light</button></div>
  </figure>`;
}

/** Replaces native-state and reference slots without external resources. */
function build() {
  const template = readFileSync(templatePath, 'utf8');
  const filled = Object.entries(groups).reduce((markup, [name, scenes]) => {
    const slot = `__${name}_CARDS__`;
    if (!markup.includes(slot)) throw new Error(`Search-page template lost ${slot}.`);
    return markup.replace(slot, scenes.map(cardHtml).join('\n'));
  }, template);
  const playerDark = encodedImage({ stage: 'player', mode: 'dark', size: 'compact' });
  const playerLight = encodedImage({ stage: 'player', mode: 'light', size: 'compact' });
  const reference = readFileSync(referencePath).toString('base64');
  const placeholders = ['__FLOW_DARK__', '__FLOW_LIGHT__', '__SEARCH_REFERENCE__', '__REFERENCE_WIDTH__', '__REFERENCE_HEIGHT__'];
  if (placeholders.some((slot) => !filled.includes(slot))) throw new Error('Search-page template lost a flow or reference slot.');
  const html = filled
    .replace('__FLOW_DARK__', `data:image/png;base64,${playerDark}`)
    .replace('__FLOW_LIGHT__', `data:image/png;base64,${playerLight}`)
    .replace('__SEARCH_REFERENCE__', `data:image/png;base64,${reference}`)
    .replace('__REFERENCE_WIDTH__', '948')
    .replace('__REFERENCE_HEIGHT__', '124');
  writeFileSync(outputPath, html);
  console.log('Built self-contained Search button to page review.');
}

/** Samples a native header, divider, and page-body pixel. */
function sample({ mode, point }) {
  const file = join(renderPath, `${basename({ stage: 'open-results', mode, size: 'compact' })}.png`);
  return execFileSync('magick', [file, '-format', `%[pixel:p{${point}}]`, 'info:'], { encoding: 'utf8' }).trim();
}

/** Checks the active-only flow, exact native evidence, and one integrated page header. */
function validate() {
  const html = readFileSync(outputPath, 'utf8');
  if (['__FLOW_DARK__', '__FLOW_LIGHT__', '__SEARCH_REFERENCE__', '__REFERENCE_WIDTH__', '__REFERENCE_HEIGHT__', '__COMPACT_CARDS__', '__WIDE_CARDS__', '__STRESS_CARDS__'].some((slot) => html.includes(slot))) {
    throw new Error('Search-page review retains a placeholder.');
  }
  if (/<script\s+[^>]*src=|<link\s+[^>]*href=/i.test(html) || /navigator\.clipboard|clipboardData|execCommand\(\s*['"]copy/.test(html)) {
    throw new Error('Search-page review depends on an external resource or clipboard API.');
  }
  const scenes = Object.values(groups).flat();
  const urls = [...html.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)].map((match) => match[1]);
  if (urls.length !== scenes.length * 2 + 3 || new Set(urls).size !== scenes.length * 2 + 1) {
    throw new Error(`Search-page review carries ${urls.length} image references and ${new Set(urls).size} distinct rasters; expected ${scenes.length * 2 + 3} and ${scenes.length * 2 + 1}.`);
  }
  const reference = readFileSync(referencePath);
  if (urls.filter((url) => url === reference.toString('base64')).length !== 1 ||
    reference.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
    reference.readUInt32BE(16) !== 948 || reference.readUInt32BE(20) !== 124 ||
    !html.includes('width="948" height="124" alt="Local baseline MD3 full-content Search header')) {
    throw new Error('Search-page review lost the exact normalized one-bar reference.');
  }
  const figures = html.split('<figure class="capture"').slice(1).map((chunk) => chunk.split('</figure>')[0]);
  if (figures.length !== scenes.length) throw new Error('Search-page review lost a native state card.');
  for (const [index, scene] of scenes.entries()) {
    const figure = figures[index];
    const width = scene.size === 'wide' ? 1100 : (scene.size === 'stress' ? 360 : 480);
    const height = scene.size === 'compact' ? 600 : 640;
    const data = [...figure.matchAll(/data:image\/png;base64,([A-Za-z0-9+/=]+)/g)].map((match) => match[1]);
    if (!figure.includes(`data-stage="${scene.stage}" data-size="${scene.size}"`) || data.length !== 2 ||
      data[0] !== encodedImage({ ...scene, mode: 'dark' }) || data[1] !== encodedImage({ ...scene, mode: 'light' }) ||
      !figure.includes(`width="${width}" height="${height}" alt="Native Slint`) ||
      !figure.includes('data-scheme="dark"') || !figure.includes('data-scheme="light"')) {
      throw new Error(`${scene.stage}/${scene.size}: wrong native state or color-scheme pairing.`);
    }
    for (const encoded of data) {
      const image = Buffer.from(encoded, 'base64');
      if (image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || image.readUInt32BE(16) !== width || image.readUInt32BE(20) !== height) {
        throw new Error(`${scene.stage}/${scene.size}: invalid native PNG dimensions.`);
      }
    }
  }
  const hero = html.slice(html.indexOf('<picture id="flow-picture">'), html.indexOf('</picture>', html.indexOf('<picture id="flow-picture">')));
  if (!hero.includes(`srcset="data:image/png;base64,${encodedImage({ stage: 'player', mode: 'dark', size: 'compact' })}"`) ||
    !hero.includes(`src="data:image/png;base64,${encodedImage({ stage: 'player', mode: 'light', size: 'compact' })}"`)) {
    throw new Error('Search-page flow does not start at the native player Search trigger.');
  }
  if (html.includes('name="inapp"') || html.includes('name="global"') || html.includes('name="search"') || html.includes('I/G/R choices to make.</strong>')) {
    throw new Error('Rejected command-bar choice structure resurfaced in the Search page.');
  }
  for (const text of ['D47', 'D48', 'one</strong> top bar', 'id="open-page"', 'id="back-player"', 'id="sample-query"', '<option value="cam">cam</option>', '<option value="zzq">zzq</option>', 'sampleQuery.addEventListener(\'change\'', 'id="unavailable"', 'showStage(\'open-empty\')', 'showStage(\'player\')', 'backPlayer.focus()', 'openPage.focus()', 'preview.showModal()', 'await previewImage.decode()', 'returnTarget?.focus()', 'Math.min(0.25, fitScale() / 2)', 'stepZoom(-0.25)', 'id="correction"']) {
    if (!html.includes(text)) throw new Error(`Search-page review is missing ${text}.`);
  }
  if ((html.match(/class="capture"/g) ?? []).length !== scenes.length || (html.match(/data-scheme="dark"/g) ?? []).length !== scenes.length || (html.match(/data-scheme="light"/g) ?? []).length !== scenes.length) {
    throw new Error('Search-page review must show every native state in both schemes.');
  }
  for (const [mode, header, divider, body] of [
    ['dark', 'srgba(30,31,38,1)', 'srgba(115,117,127,1)', 'srgba(0,0,0,1)'],
    ['light', 'srgba(231,231,241,1)', 'srgba(121,122,132,1)', 'srgba(255,255,255,1)'],
  ]) {
    if (sample({ mode, point: '200,30' }) !== header || sample({ mode, point: '200,71' }) !== divider || sample({ mode, point: '200,105' }) !== body) {
      throw new Error(`${mode} Search page lost its one-bar header, divider or separate body.`);
    }
  }
  console.log('One-bar Search page review is valid.');
}

if (process.argv[2] === 'build') build();
else if (process.argv[2] === 'validate') validate();
else throw new Error('Usage: node search-page-question.mjs build|validate');
