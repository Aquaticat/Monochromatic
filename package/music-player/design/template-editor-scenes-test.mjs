import assert from 'node:assert/strict';
import { defaultTemplate } from './template-reference.mjs';
import { drawnTexts, expected, library, scenes, standIns } from './template-editor-scenes.mjs';

//region What each authored state draws, written out so a change in the reference or the scenes is noticed
const drawn = Object.fromEntries(scenes.map(state => [state.id, expected(state)]));
assert.deepEqual(Object.keys(drawn), ['list', 'default', 'help', 'unknown-field', 'open-formula', 'custom', 'no-library']);
const libraryRows = [{ title: 'Another Xronixle', supporting: '4:35 · −1.2 dBTP' }, { title: 'Burning Aquamarine', supporting: '5:12' }];
for (const id of ['list', 'default', 'help', 'unknown-field', 'open-formula']) assert.deepEqual(drawn[id].previewRows, libraryRows, id);
assert.deepEqual(drawn.custom.previewRows, [{ title: 'Another Xronixle', supporting: 'FLAC · 4:35' }, { title: 'Burning Aquamarine', supporting: 'FLAC · 5:12' }]);
assert.deepEqual(drawn['no-library'].previewRows, [{ title: 'Track title', supporting: '3:20 · −1.0 dBTP' }, { title: 'Track not analysed yet', supporting: '3:20' }]);
assert.deepEqual(drawn.list.listEntry, { title: 'Track row supporting line', supporting: '4:35 · −1.2 dBTP' });
assert.equal(drawn.list.page, 'list');
assert.deepEqual(drawn.help.help, { signature: 'tf(seconds, [format])', parameter: 'format',
  description: "Format: h, m and s for hours, minutes and seconds; a doubled letter pads with a zero; text between apostrophes is kept. Without it, m:ss." });
assert.deepEqual(drawn['unknown-field'].errors, ['mi: unknown field peek']);
assert.deepEqual(drawn['open-formula'].errors, ['formula: the formula opened at character 1 is not closed']);
assert.equal(drawn.default.previewNote, 'From your library. The second file is not analysed yet.');
assert.equal(drawn['unknown-field'].previewNote, 'Rows keep the last valid template.');
assert.equal(drawn['no-library'].previewNote, 'No library is open. These are sample values.');
assert.deepEqual(drawn.default.fields.map(field => field.label + '|' + field.insert + '|' + field.value), [
  'Title|mi(title)|Another Xronixle', 'File name|mi(file)|かめりあ(Camellia) - Another Xronixle', 'Extension|mi(ext)|flac', 'Folder|mi(folder)|Camellia',
  'Path|mi(path)|Camellia/かめりあ(Camellia) - Another Xronixle.flac', 'Duration|mi(len)|275', 'True peak|mi(peak)|−1.2']);
//endregion

//region Invariants every state keeps
for (const state of Object.values(drawn)) {
  // Mistakes take the place of typing help, and help needs a caret.
  assert.ok(!(state.errors.length > 0 && state.help), state.id);
  assert.equal(state.valid, state.errors.length === 0, state.id);
  assert.ok(state.help === undefined || state.focused, state.id);
  assert.equal(state.resetEnabled, state.template !== defaultTemplate, state.id);
  assert.equal(state.previewRows.length, 2, state.id);
  assert.ok(state.caret === undefined || (state.caret >= 0 && state.caret <= state.template.length), state.id);
  assert.ok(!state.template.includes('|'), state.id);
}
assert.deepEqual(Object.values(drawn).filter(state => state.focused).map(state => state.id), ['help', 'unknown-field', 'open-formula']);
// Each preview pair shows one file with a true peak and one without, so the fallback is always on screen.
for (const pair of [library, standIns]) assert.deepEqual(pair.map(track => track.peak === undefined), [false, true]);
// The page's whole copy, in reading order: the list page is short, an editor page has its sections in a fixed order.
assert.deepEqual(drawnTexts(scenes[0]).map(item => item.role + '=' + item.text),
  ['page-title=Settings', 'section-templates=Templates', 'entry-title=Track row supporting line', 'entry-supporting=4:35 · \u22121.2 dBTP']);
for (const state of scenes.slice(1)) {
  const roles = drawnTexts(state).map(item => item.role);
  assert.deepEqual(roles.filter(role => !/^(preview-supporting|error|help|field-(name|value|insert))-/u.test(role) && !/^preview-title-/u.test(role)),
    ['page-title', 'section-preview', 'preview-note', 'field-label', 'template', 'section-fields', 'reset'], state.id);
  assert.equal(roles.filter(role => role.startsWith('field-name-')).length, 7, state.id);
  assert.equal(new Set(roles).size, roles.length, state.id);
}
// Both preview rows draw a second line; the unanalysed one holds only the duration.
assert.deepEqual(drawnTexts(scenes[1]).filter(item => item.role.startsWith('preview-')).map(item => item.role),
  ['preview-title-0', 'preview-supporting-0', 'preview-title-1', 'preview-supporting-1', 'preview-note']);
assert.equal(drawnTexts(scenes.find(state => state.id === 'unknown-field')).find(item => item.role === 'error-0').text, 'mi: unknown field peek');
//endregion
console.log('Template editor scenes: ' + scenes.length + ' states and their drawn text passed.');
