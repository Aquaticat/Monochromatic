import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

//region Rule helper and pinned artifact, not a stored preference or a working setting
const questions = join(process.cwd(), 'questions');
const evidence = join(questions, 'evidence');
const artifact = {
  apkSha256: '85e4a2080d1d737eb01a16bdcc5172bcc7103fe014770891d68d3cdf1854ca50',
  prototypeCommit: '483f16cdd4c0bda6269ae2e4666732db6407ce75',
  containerImageId: '4b8805002ee369c81b7826b941afc52c0c9678a0d0e427a0fefd1684b78b5f94',
  systemImageFingerprint: 'google/sdk_gphone16k_x86_64/emu64xa16k:17/CE2A.260420.050/16231978:user/dev-keys',
  renderer: 'Android Emulator OpenGL ES Translator (llvmpipe (LLVM 20.1.2, 256 bits))',
};
// Every rule is one `need` statement on one line with a unique name. The consumer test deletes
// exactly that line and expects its own case to stop reporting the name, so no rule goes unexercised.
function need({ rule, holds, detail }) {
  if (!holds) throw new Error(`Settings-pane [${rule}] ${detail}.`);
}
function rectangle(value) {
  return Array.isArray(value) && value.length === 4 && value.every(Number.isInteger) && value[2] > value[0] && value[3] > value[1];
}
function inside({ inner, outer }) {
  return inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];
}
function same(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}
// A clipped part is absent, or an integer rectangle inside its whole element.
function part({ visible, whole }) {
  return visible === null || (rectangle(visible) && inside({ inner: visible, outer: whole }));
}
// Header, image data and end chunks only, each within the file, with nothing after the end chunk.
function essentialChunksOnly(png) {
  let offset = 8;
  while (offset + 12 <= png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    const next = offset + 12 + length;
    if (!['IHDR', 'IDAT', 'IEND'].includes(type) || next > png.length) return false;
    if (type === 'IEND') return length === 0 && next === png.length;
    offset = next;
  }
  return false;
}
//endregion

//region Exact inspected native Settings cohort
const manifest = JSON.parse(readFileSync(join(evidence, 'settings-pane-witnesses.json'), 'utf8'));
need({ rule: 'manifest-schema', holds: manifest.schema === 1, detail: 'manifest schema is not 1' });
need({ rule: 'manifest-apk', holds: manifest.apkSha256 === artifact.apkSha256, detail: 'APK digest differs from the inspected artifact' });
need({ rule: 'manifest-commit', holds: manifest.prototypeCommit === artifact.prototypeCommit, detail: 'prototype commit differs from the inspected artifact' });
need({ rule: 'manifest-witness-list', holds: Array.isArray(manifest.witnesses), detail: 'manifest has no witness list' });
// D11's row order, and the switch field each row draws.
const rowFields = [['strip-common-prefixes', 'strip'], ['resume-where-left-off', 'resume'], ['analyse-in-background', 'analyse']];
const states = {
  closed: { opened: false, strip: true, resume: true, analyse: false },
  accepted: { opened: true, strip: true, resume: true, analyse: false },
  inverse: { opened: true, strip: false, resume: false, analyse: true },
};
const images = {};
const opened = [];
for (const [index, capture] of manifest.witnesses.entries()) {
  const at = `witness ${index + 1}: `;
  need({ rule: 'witness-record', holds: typeof capture === 'object' && capture !== null, detail: at + 'is not a record' });
  const { file, panel, view, position, scheme, fontScale } = capture;
  const path = /^settings-pane-(?:inner|cover)-[a-z-]+-(?:light|dark)-s(?:100|200)\.png$/;
  need({ rule: 'witness-path', holds: typeof file === 'string' && path.test(file), detail: at + 'image path is outside the evidence boundary' });
  // Strict types: a template literal would coerce `"2"` or `["cover"]` and let later comparisons disagree.
  need({ rule: 'witness-panel', holds: panel === 'inner' || panel === 'cover', detail: at + 'panel is not inner or cover' });
  need({ rule: 'witness-scheme', holds: scheme === 'light' || scheme === 'dark', detail: at + 'theme is not light or dark' });
  need({ rule: 'witness-font-scale', holds: fontScale === 1 || fontScale === 2, detail: at + 'font scale is not the number 1 or 2' });
  need({ rule: 'witness-view', holds: typeof view === 'string' && Object.hasOwn(states, view), detail: at + 'view is not an authored view' });
  need({ rule: 'witness-position', holds: position === 'none' || position === 'start' || position === 'end', detail: at + 'scroll position is not none, start or end' });
  need({ rule: 'witness-position-view', holds: (view === 'closed') === (position === 'none'), detail: at + 'only the closed player has no scroll position' });
  const named = `settings-pane-${panel}-${view}${position === 'end' ? '-end' : ''}-${scheme}-s${fontScale * 100}.png`;
  need({ rule: 'witness-filename', holds: file === named, detail: at + 'filename and metadata disagree' });

  //region Crop follows the measured application root
  const width = panel === 'inner' ? 2076 : 1080;
  const physicalHeight = panel === 'inner' ? 2152 : 2424;
  const bounds = capture.applicationRoot;
  need({ rule: 'root-rectangle', holds: rectangle(bounds), detail: at + 'application root is not an integer rectangle' });
  need({ rule: 'root-width', holds: bounds[0] === 0 && bounds[2] === width, detail: at + 'application root does not span the panel width' });
  need({ rule: 'root-status-strip', holds: bounds[1] >= 1 && bounds[1] < physicalHeight / 2, detail: at + 'application root has no status strip above it' });
  need({ rule: 'root-bottom', holds: bounds[3] > physicalHeight / 2 && bounds[3] <= physicalHeight, detail: at + 'application root bottom is outside the lower half of the panel' });
  const panelPixels = JSON.stringify([width, physicalHeight]);
  need({ rule: 'physical-pixels', holds: JSON.stringify(capture.physicalPixels) === panelPixels, detail: at + 'physical size is not this panel' });
  const height = physicalHeight - bounds[1];
  const crop = capture.cropPixels;
  need({ rule: 'crop-record', holds: typeof crop === 'object' && crop !== null, detail: at + 'crop record is absent' });
  need({ rule: 'crop-origin', holds: crop.x === 0 && crop.y === bounds[1], detail: at + 'crop does not start at the measured application root' });
  need({ rule: 'crop-size', holds: crop.width === width && crop.height === height, detail: at + 'crop size is not the panel below the status strip' });
  //endregion

  //region Displayed bytes are the hashed, sanitized image
  const png = readFileSync(join(evidence, file));
  const hash = createHash('sha256').update(png).digest('hex');
  need({ rule: 'png-digest', holds: hash === capture.sha256, detail: at + 'image digest differs' });
  need({ rule: 'png-signature', holds: png.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', detail: at + 'image is not a PNG' });
  const headerFirst = png.length >= 33 && png.readUInt32BE(8) === 13 && png.subarray(12, 16).toString('ascii') === 'IHDR';
  need({ rule: 'png-header-chunk', holds: headerFirst, detail: at + 'image does not start with a header chunk' });
  need({ rule: 'png-size', holds: png.readUInt32BE(16) === width && png.readUInt32BE(20) === height, detail: at + 'image size is not the crop size' });
  need({ rule: 'png-opaque-rgb', holds: png[24] === 8 && png[25] === 2, detail: at + 'image is not 8-bit opaque RGB' });
  need({ rule: 'png-chunks', holds: essentialChunksOnly(png), detail: at + 'image carries metadata, trailing bytes or a malformed chunk' });
  //endregion

  //region Acquisition and authored state
  need({ rule: 'density', holds: capture.densityDpi === 390, detail: at + 'density is not 390dpi' });
  need({ rule: 'inspected', holds: capture.inspected === true, detail: at + 'image was not inspected' });
  need({ rule: 'fresh-hierarchy', holds: capture.freshHierarchyValidated === true, detail: at + 'hierarchy was not validated as fresh' });
  need({ rule: 'keyboard-closed', holds: capture.keyboardClosed === true, detail: at + 'keyboard was not recorded closed' });
  need({ rule: 'stable-frames', holds: capture.stableAppFrames === true, detail: at + 'app frames were not recorded stable' });
  need({ rule: 'retained-rgb', holds: capture.exactRetainedRgb === true, detail: at + 'retained RGB was not proven exact' });
  need({ rule: 'sanitized-opaque', holds: capture.opaque === true, detail: at + 'sanitized image was not recorded opaque' });
  need({ rule: 'sanitized-chunks', holds: capture.essentialPngChunksOnly === true, detail: at + 'sanitized image was not recorded metadata-free' });
  need({ rule: 'authored-state', holds: same(capture.state, states[view]), detail: at + 'state is not the authored state of its view' });
  need({ rule: 'container-image', holds: capture.containerImageId === artifact.containerImageId, detail: at + 'capture container image differs' });
  need({ rule: 'system-image', holds: capture.systemImageFingerprint === artifact.systemImageFingerprint, detail: at + 'system image differs' });
  need({ rule: 'renderer', holds: capture.renderer === artifact.renderer, detail: at + 'renderer differs' });
  //endregion

  const key = `comparison/${panel}/${view}/${scheme}/${fontScale}/${position}`;
  need({ rule: 'witness-unique', holds: !Object.hasOwn(images, key), detail: at + 'repeats another witness' });
  let fitNote;
  if (view === 'closed') {
    //region Closed player, the baseline both Back paths return to
    const { player } = capture;
    need({ rule: 'closed-player-rectangle', holds: rectangle(player), detail: at + 'closed player is not an integer rectangle' });
    need({ rule: 'closed-player-root', holds: same(player, bounds), detail: at + 'closed player does not fill the application root' });
    const absent = ['pane', 'header', 'back', 'title', 'viewport', 'closing', 'left', 'rows', 'visible', 'scrollMaxPixels', 'titleLines', 'titleOverflow', 'closingLines', 'closingOverflow'];
    need({ rule: 'closed-no-pane', holds: absent.every(name => capture[name] === null), detail: at + 'closed player records Settings geometry' });
    fitNote = 'player with Settings closed';
    //endregion
  } else {
    //region Measured page, header, rows and closing sentence in physical screenshot pixels
    // 72dp header, 48dp floors and the 52 by 32dp switch at the measured 390dpi density.
    const { pane, header, back, title, viewport, closing, left, rows, visible } = capture;
    need({ rule: 'closed-only-player', holds: capture.player === null, detail: at + 'open Settings view records a closed player' });
    need({ rule: 'pane-rectangle', holds: rectangle(pane), detail: at + 'Settings page is not an integer rectangle' });
    const placed = same(pane, panel === 'inner' ? [1038, 0, 2076, 2152] : [0, 0, 1080, 2424]);
    need({ rule: 'pane-placement', holds: placed, detail: at + 'Settings page is not the unfolded right half or the full cover' });
    need({ rule: 'left-half', holds: same(left, panel === 'inner' ? [0, 0, 1038, 2152] : null), detail: at + 'retained player half is not the unfolded left half' });
    need({ rule: 'header-rectangle', holds: rectangle(header), detail: at + 'header is not an integer rectangle' });
    const headed = header[0] === pane[0] && header[2] === pane[2] && header[1] === bounds[1];
    need({ rule: 'header-position', holds: headed, detail: at + 'header does not span the page at the application root top' });
    need({ rule: 'header-height', holds: header[3] - header[1] === 176, detail: at + 'header is not 176px high' });
    need({ rule: 'back-rectangle', holds: rectangle(back), detail: at + 'Back target is not an integer rectangle' });
    need({ rule: 'back-floor', holds: back[2] - back[0] >= 117 && back[3] - back[1] >= 117, detail: at + 'Back target is below the 117px layout floor' });
    need({ rule: 'back-inside-header', holds: inside({ inner: back, outer: header }), detail: at + 'Back target leaves the header' });
    need({ rule: 'title-rectangle', holds: rectangle(title), detail: at + 'page title is not an integer rectangle' });
    need({ rule: 'title-inside-header', holds: inside({ inner: title, outer: header }), detail: at + 'page title leaves the header' });
    need({ rule: 'back-before-title', holds: back[2] <= title[0], detail: at + 'Back target overlaps the page title' });
    need({ rule: 'title-one-line', holds: capture.titleLines === 1 && capture.titleOverflow === false, detail: at + 'page title is not one unclipped line' });
    need({ rule: 'viewport-rectangle', holds: rectangle(viewport), detail: at + 'scroll viewport is not an integer rectangle' });
    const below = viewport[0] === pane[0] && viewport[2] === pane[2] && viewport[1] >= header[3] && viewport[1] - header[3] <= 3 && viewport[3] === pane[3];
    need({ rule: 'viewport-position', holds: below, detail: at + 'scroll viewport does not fill the page below the header' });
    const scroll = capture.scrollMaxPixels;
    need({ rule: 'scroll-extent', holds: Number.isInteger(scroll) && scroll >= 0, detail: at + 'scroll extent is not a whole pixel count' });
    need({ rule: 'rows-list', holds: Array.isArray(rows) && rows.length === 3, detail: at + 'page does not record three rows' });
    need({ rule: 'visible-record', holds: typeof visible === 'object' && visible !== null && Array.isArray(visible.rows) && visible.rows.length === 3, detail: at + 'visible-part record is absent' });
    const offset = position === 'end' ? scroll : 0;
    let previousBottom = viewport[1] - offset;
    const information = [title];
    const shownRows = [];
    for (const [rowIndex, row] of rows.entries()) {
      const on = `${at}row ${rowIndex + 1}: `;
      need({ rule: 'row-record', holds: typeof row === 'object' && row !== null, detail: on + 'is not a record' });
      need({ rule: 'row-identity', holds: row.id === rowFields[rowIndex][0], detail: on + 'is not in the accepted row order' });
      const drawn = ['row', 'title', 'supporting', 'switch'].every(name => rectangle(row[name]));
      need({ rule: 'row-rectangles', holds: drawn, detail: on + 'row, text or switch is not an integer rectangle' });
      need({ rule: 'row-spans-page', holds: row.row[0] === pane[0] && row.row[2] === pane[2], detail: on + 'does not span the page' });
      need({ rule: 'row-floor', holds: row.row[3] - row.row[1] >= 117, detail: on + 'is below the 117px layout floor' });
      need({ rule: 'row-order', holds: row.row[1] >= previousBottom && row.row[1] - previousBottom <= 3, detail: on + 'does not follow the previous row or the content start' });
      previousBottom = row.row[3];
      const switchSize = row.switch[2] - row.switch[0] === 127 && row.switch[3] - row.switch[1] === 78;
      need({ rule: 'switch-size', holds: switchSize, detail: on + 'switch is not 127 by 78px' });
      const contained = ['title', 'supporting', 'switch'].every(name => inside({ inner: row[name], outer: row.row }));
      need({ rule: 'row-parts-inside', holds: contained, detail: on + 'text or switch leaves its row' });
      need({ rule: 'title-above-supporting', holds: row.supporting[1] >= row.title[3], detail: on + 'supporting text overlaps its title' });
      const clear = row.title[2] <= row.switch[0] && row.supporting[2] <= row.switch[0];
      need({ rule: 'text-clear-of-switch', holds: clear, detail: on + 'text runs under its switch' });
      const counted = Number.isInteger(row.titleLines) && row.titleLines >= 1 && Number.isInteger(row.supportingLines) && row.supportingLines >= 1;
      need({ rule: 'row-text-lines', holds: counted, detail: on + 'text line counts are not whole positive numbers' });
      need({ rule: 'row-text-overflow', holds: row.titleOverflow === false && row.supportingOverflow === false, detail: on + 'native layout reports text overflow' });
      const seen = visible.rows[rowIndex];
      need({ rule: 'visible-row-record', holds: typeof seen === 'object' && seen !== null && seen.id === row.id, detail: on + 'visible part belongs to another row' });
      need({ rule: 'visible-row-part', holds: part({ visible: seen.row, whole: row.row }), detail: on + 'visible row is not part of its row' });
      need({ rule: 'visible-switch-part', holds: part({ visible: seen.switch, whole: row.switch }), detail: on + 'visible switch is not part of its switch' });
      information.push(row.title, row.supporting, row.switch);
      shownRows.push({ whole: same(seen.row, row.row) && row.row[3] <= bounds[3], switchWhole: same(seen.switch, row.switch) });
    }
    need({ rule: 'closing-rectangle', holds: rectangle(closing), detail: at + 'closing sentence is not an integer rectangle' });
    need({ rule: 'closing-below-rows', holds: closing[1] >= previousBottom, detail: at + 'closing sentence overlaps the rows' });
    need({ rule: 'closing-inside-page', holds: closing[0] >= pane[0] && closing[2] <= pane[2], detail: at + 'closing sentence leaves the page width' });
    const closingText = Number.isInteger(capture.closingLines) && capture.closingLines >= 1 && capture.closingOverflow === false;
    need({ rule: 'closing-text', holds: closingText, detail: at + 'closing sentence is not whole unclipped lines' });
    information.push(closing);
    // E2: information stays off the fold connector, which ends at x 1093 on the unfolded panel.
    const offConnector = panel === 'cover' || information.every(rect => rect[0] >= 1093);
    need({ rule: 'fold-connector', holds: offConnector, detail: at + 'information starts inside the fold connector' });
    need({ rule: 'visible-closing-part', holds: part({ visible: visible.closing, whole: closing }), detail: at + 'visible closing sentence is not part of the sentence' });
    const closingWhole = same(visible.closing, closing) && closing[3] <= bounds[3];
    need({ rule: 'position-scroll', holds: position === 'start' || scroll > 0, detail: at + 'end-of-column view exists for a column that does not scroll' });
    // The column ends 54px (22dp) below its closing sentence plus the navigation inset under the application root.
    const overhang = closing[3] + offset + 54 + (pane[3] - bounds[3]) - viewport[3];
    need({ rule: 'scroll-geometry', holds: scroll === Math.max(0, overhang), detail: at + 'scroll extent is not what the measured column overhangs its viewport' });
    const everything = closingWhole && shownRows.every(row => row.whole);
    need({ rule: 'fits-without-scroll', holds: scroll > 0 || everything, detail: at + 'a column that does not scroll hides a row or its closing sentence' });
    need({ rule: 'end-shows-closing', holds: position === 'start' || closingWhole, detail: at + 'end-of-column view does not show the whole closing sentence' });
    const heights = rows.map(row => row.row[3] - row.row[1]);
    fitNote = `rows ${heights.join(', ')} px high · closing sentence ${capture.closingLines} lines · ` + (scroll === 0 ? 'whole column fits without scrolling'
      : position === 'end' ? `column scrolled ${scroll} px to its end` : `column scrolls ${scroll} px; ${closingWhole ? 'closing sentence already shown' : 'closing sentence not wholly shown until scrolled'}`);
    opened.push({ capture, key, heights, closingWhole, shownRows });
    //endregion
  }
  images[key] = { file, hash, width, height, density: 390, fitNote, source: `data:image/png;base64,${png.toString('base64')}` };
}
//endregion

//region Cohort shape: every environment has its three views, and an end view exactly where its column scrolls
const expected = [];
for (const panel of ['inner', 'cover']) for (const scheme of ['light', 'dark']) for (const scale of [1, 2]) {
  expected.push(`comparison/${panel}/closed/${scheme}/${scale}/none`);
  for (const view of ['accepted', 'inverse']) {
    expected.push(`comparison/${panel}/${view}/${scheme}/${scale}/start`);
    const start = opened.find(item => item.key === `comparison/${panel}/${view}/${scheme}/${scale}/start`);
    if (start && start.capture.scrollMaxPixels > 0) expected.push(`comparison/${panel}/${view}/${scheme}/${scale}/end`);
  }
}
need({ rule: 'exact-cohort', holds: same(Object.keys(images).sort(), expected.sort()), detail: 'review requires exact panel, view, theme, scale and scroll-position combinations' });
// Whole-element layout, which neither a switch position nor a theme may change.
function layout(capture) {
  const { pane, header, back, title, viewport, closing, scrollMaxPixels, closingLines } = capture;
  return [pane, header, back, title, viewport, closing, scrollMaxPixels, closingLines, capture.rows.map(row => [row.row, row.title, row.supporting, row.switch, row.titleLines, row.supportingLines])];
}
for (const item of opened) {
  const { panel, view, scheme, fontScale, position } = item.capture;
  const reference = opened.find(other => other.key === `comparison/${panel}/accepted/light/${fontScale}/${position}`);
  need({ rule: 'layout-stable', holds: reference !== undefined && same(layout(reference.capture), layout(item.capture)), detail: `${item.capture.file}: a switch position or theme changed the layout` });
  if (position === 'end') {
    const start = opened.find(other => other.key === `comparison/${panel}/${view}/${scheme}/${fontScale}/start`);
    const moved = item.capture.scrollMaxPixels;
    const shifted = start !== undefined && start.capture.closing[1] - item.capture.closing[1] === moved && start.capture.rows.every((row, index) => {
      const after = item.capture.rows[index].row;
      return row.row[1] - after[1] === moved && row.row[3] - after[3] === moved;
    });
    need({ rule: 'end-shift', holds: shifted, detail: `${item.capture.file}: end-of-column rows are not the start rows moved by the scroll extent` });
  }
}
//endregion

//region Switch positions re-measured from the embedded images, so a drawn state is not only asserted
// On the 52dp-wide Material switch the handle is centred 16dp from the leading edge when off and
// 36dp when on; 4dp from that edge is track in both positions. On the vertical centre line, the
// handle centre whose colour differs from the track by more than 24 of 255 in a channel holds the handle.
// Decoded RGB bytes of one image region, or null when the image does not hold the whole region.
function imageRegion({ file, left, top, width, height }) {
  const rgb = execFileSync('magick', ['-limit', 'thread', '2', '-limit', 'memory', '256MiB', join(evidence, file),
    '-crop', `${width}x${height}+${left}+${top}`, '+repage', '-depth', '8', 'rgb:-'], { maxBuffer: 24 * 1024 * 1024 });
  return rgb.length === width * height * 3 ? rgb : null;
}
// The same region addressed by a measured screenshot rectangle, moved into the cropped image.
function measuredRegion({ capture, rectangle: bounds }) {
  const [left, top, right, bottom] = bounds;
  const width = right - left;
  const height = bottom - top;
  return { width, height, rgb: imageRegion({ file: capture.file, left: left - capture.cropPixels.x, top: top - capture.cropPixels.y, width, height }) };
}
function drawnSwitch({ capture, rectangle: bounds }) {
  const { width, height, rgb } = measuredRegion({ capture, rectangle: bounds });
  if (rgb === null) return null;
  const middle = Math.floor(height / 2);
  function differs(dp) {
    const sample = (middle * width + Math.round(width * dp / 52)) * 3;
    const track = (middle * width + Math.round(width * 4 / 52)) * 3;
    return [0, 1, 2].some(channel => Math.abs(rgb[sample + channel] - rgb[track + channel]) > 24);
  }
  const handleLeading = differs(16);
  const handleTrailing = differs(36);
  if (handleLeading === handleTrailing) return null;
  return handleTrailing;
}
function switchesMatchPixels(item) {
  return item.capture.rows.every((row, index) => {
    if (!item.shownRows[index].switchWhole) return true;
    return drawnSwitch({ capture: item.capture, rectangle: row.switch }) === item.capture.state[rowFields[index][1]];
  });
}
//endregion

//region Header legibility re-measured from the embedded images, because rectangles cannot show a colour defect
// WCAG relative luminance of one pixel, and the strongest contrast any pixel of a header rectangle has
// against the header ground at that rectangle's trailing top corner, which holds no glyph.
function luminance({ rgb, offset }) {
  const linear = [0, 1, 2].map(channel => {
    const value = rgb[offset + channel] / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function strongestContrast({ capture, rectangle: bounds }) {
  const { width, rgb } = measuredRegion({ capture, rectangle: bounds });
  if (rgb === null) return 0;
  const ground = luminance({ rgb, offset: (2 * width + width - 3) * 3 });
  let strongest = 1;
  for (let offset = 0; offset < rgb.length; offset += 3) {
    const ink = luminance({ rgb, offset });
    strongest = Math.max(strongest, (Math.max(ink, ground) + 0.05) / (Math.min(ink, ground) + 0.05));
  }
  return strongest;
}
//endregion

//region Retained left half compared with the published accepted Search page, which keeps the same half
// D51's accepted Search page keeps the folder browser and deck on the unfolded left half. These are
// its published images, pinned by digest. Shades a step or two apart between capture sessions are the
// same drawn element, so a pixel counts as different only above 24 of 255 in a channel.
const searchEvidence = {
  'light/1': { file: 'search-filename-comparison-inner-literalfull-light-s100.png', sha256: 'b191dc7d9f1c20b6f1338183cdd6bd1034d7e2f5e44a16544a3fbb092baf4b62' },
  'dark/1': { file: 'search-filename-comparison-inner-literalfull-dark-s100.png', sha256: '8459f260bd0e147eed39f170c7a587d99aa967acc7ec6da4283fe3a88116cf73' },
  'light/2': { file: 'search-filename-comparison-inner-literalfull-light-s200.png', sha256: 'b4ed43b3d65583e76a7da99de48ec5342c7bbc49e72c1c9b4397289dd1881636' },
  'dark/2': { file: 'search-filename-comparison-inner-literalfull-dark-s200.png', sha256: '6968493f24577d019018c61d6035c8760ccc355f682421fd16f51a1731750b1e' },
};
function leftHalfDifference(capture) {
  const region = { left: 0, top: 0, width: 1038, height: capture.applicationRoot[3] - capture.applicationRoot[1] };
  const settings = imageRegion({ file: capture.file, ...region });
  const search = imageRegion({ file: searchEvidence[`${capture.scheme}/${capture.fontScale}`].file, ...region });
  if (settings === null || search === null) return Number.POSITIVE_INFINITY;
  let differing = 0;
  for (let offset = 0; offset < settings.length; offset += 3) {
    if ([0, 1, 2].some(channel => Math.abs(settings[offset + channel] - search[offset + channel]) > 24)) differing++;
  }
  return differing;
}
//endregion

//region Inspection findings and provenance stated from validated data, so the page cannot drift from its evidence
function range(values) {
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high ? String(low) : `${low} to ${high}`;
}
// Names the panels and text scales a set of views covers, for example `the cover and inner panels at 200% text`.
function conditions(items) {
  const scales = [...new Set(items.map(item => item.capture.fontScale))].sort();
  return scales.map(scale => {
    const panels = [...new Set(items.filter(item => item.capture.fontScale === scale).map(item => item.capture.panel))].sort();
    return `the ${panels.join(' and ')} panel${panels.length > 1 ? 's' : ''} at ${scale * 100}% text`;
  }).join(' and ');
}
function sameConditions(first, second) {
  return conditions(first) === conditions(second);
}
const starts = opened.filter(item => item.capture.position === 'start');
const scrolling = starts.filter(item => item.capture.scrollMaxPixels > 0);
const hiddenClosing = scrolling.filter(item => !item.closingWhole);
const normal = starts.filter(item => item.capture.fontScale === 1);
const large = starts.filter(item => item.capture.fontScale === 2);
const scrollSentence = scrolling.length === 0
  ? 'The whole column, closing sentence included, fits without scrolling in every condition.'
  : `On ${conditions(scrolling)} the column scrolls, by ${range(scrolling.map(item => item.capture.scrollMaxPixels))} physical pixels; ` +
    (hiddenClosing.length === 0 ? 'its closing sentence is still wholly shown before scrolling.'
      : sameConditions(hiddenClosing, scrolling) ? 'there the closing sentence is not wholly shown until the column is scrolled.'
        : `on ${conditions(hiddenClosing)} the closing sentence is not wholly shown until the column is scrolled.`) +
    ' Everywhere else the whole column fits.';
const findings = `<p id="inspection-findings" class="note">Inspection and measurement found this.
${scrollSentence}
Rows are ${range(normal.flatMap(item => item.heights))} physical pixels high at 100% text
and ${range(large.flatMap(item => item.heights))} at 200%, against a 117 pixel floor;
no row title, supporting line or closing sentence reports overflow.
Supporting lines wrap to at most ${Math.max(...normal.flatMap(item => item.capture.rows.map(row => row.supportingLines)))} lines at 100%
and ${Math.max(...large.flatMap(item => item.capture.rows.map(row => row.supportingLines)))} at 200%.
Neither a switch position nor the theme changes any measured rectangle.</p>`;
const provenance = `<p id="provenance" class="digest">Artifact: prototype commit ${artifact.prototypeCommit} ·
APK SHA-256 ${artifact.apkSha256} · renderer ${artifact.renderer} ·
system image ${artifact.systemImageFingerprint} · capture container image ${artifact.containerImageId}.</p>`;
//endregion

//region Offline review preserves the accepted pane and keeps observations optional
const template = readFileSync(join(questions, 'settings-pane.template.html'), 'utf8');
for (const slot of ['IMAGES', 'FINDINGS', 'PROVENANCE']) {
  need({ rule: 'template-slot', holds: template.split(`__SETTINGS_PANE_${slot}__`).length === 2, detail: `template needs exactly one ${slot} slot` });
}
const html = template.replace('__SETTINGS_PANE_FINDINGS__', () => findings)
  .replace('__SETTINGS_PANE_PROVENANCE__', () => provenance)
  .replace('__SETTINGS_PANE_IMAGES__', () => JSON.stringify(images).replaceAll('<', '\\u003c'));
const output = join(questions, 'settings-pane.html');
if (process.argv[2] === 'build') {
  writeFileSync(output, html);
  console.log('Built offline native Settings-pane evidence from exact inspected witnesses.');
} else if (process.argv[2] === 'validate') {
  need({ rule: 'output-current', holds: readFileSync(output, 'utf8') === html, detail: 'output differs from its template and evidence' });
  for (const marker of ['color-scheme: light dark', 'D11 is settled; no new preference ballot',
    'Every switch position is authored debug state', 'it was not separately chosen', 'id="inspection-findings"',
    'settles nothing about how the two relate', 'id="provenance"', 'No production implementation is authorized', 'id="final-notes"',
    'Native pixels', 'Reset 100% dp']) {
    need({ rule: 'required-statement', holds: html.includes(marker), detail: 'review is missing ' + marker });
  }
  need({ rule: 'single-form', holds: (html.match(/<form\b/gi) ?? []).length === 1, detail: 'review must hold exactly one form' });
  const scripts = (html.match(/<script\b/gi) ?? []).length === 1 && !/<script\b[^>]*\bsrc\b/i.test(html);
  need({ rule: 'single-inline-script', holds: scripts, detail: 'review must hold exactly one inline script' });
  need({ rule: 'no-unresolved-slot', holds: !/__SETTINGS_PANE_[A-Z_]+__/.test(html), detail: 'review holds an unresolved slot' });
  // Base64 image data cannot contain `:`, `(` or `@`, so these patterns only ever match authored markup.
  need({ rule: 'no-external-reference', holds: !/https?:\/\/|@import|url\(|<link\b/i.test(html), detail: 'review must stay offline, without external references' });
  need({ rule: 'no-input-control', holds: !/<input\b/i.test(html), detail: 'review must not hold input controls; observations use one optional text area' });
  const required = /<(?:textarea|select)\b(?:[^"'<>]|"[^"]*"|'[^']*')*?\srequired(?:\s|=|>)/i.test(html);
  need({ rule: 'no-required-field', holds: !required, detail: 'review must not require an answer' });
  const fields = (html.match(/<textarea\b/gi) ?? []).length === 2 && (html.match(/<select\b/gi) ?? []).length === 3;
  need({ rule: 'observation-fields-only', holds: fields, detail: 'review must keep one observation field, one prepared reply and three viewing selects' });
  for (const pinned of Object.values(searchEvidence)) {
    const path = join(evidence, pinned.file);
    const current = existsSync(path) ? createHash('sha256').update(readFileSync(path)).digest('hex') : 'absent';
    need({ rule: 'search-evidence-digest', holds: current === pinned.sha256, detail: `${pinned.file}: published Search evidence differs from its pinned digest` });
  }
  for (const item of opened) {
    const at = item.capture.file + ': ';
    need({ rule: 'switch-position-pixels', holds: switchesMatchPixels(item), detail: at + 'a drawn switch position differs from its authored state' });
    // 4.5 to 1 for text and 3 to 1 for a graphic are the WCAG 2 contrast minimums.
    need({ rule: 'title-contrast-pixels', holds: strongestContrast({ capture: item.capture, rectangle: item.capture.title }) >= 4.5, detail: at + 'page title does not reach 4.5 to 1 against the header' });
    need({ rule: 'back-contrast-pixels', holds: strongestContrast({ capture: item.capture, rectangle: item.capture.back }) >= 3, detail: at + 'Back glyph does not reach 3 to 1 against the header' });
    const sameHalf = item.capture.panel === 'cover' || leftHalfDifference(item.capture) === 0;
    need({ rule: 'left-half-search', holds: sameHalf, detail: at + 'retained left half differs from the published accepted Search page' });
  }
  console.log('Validated exact offline native Settings-pane evidence, authored-state limits, drawn switch positions, header contrast and the retained left half.');
} else {
  throw new Error('Expected build or validate.');
}
//endregion
