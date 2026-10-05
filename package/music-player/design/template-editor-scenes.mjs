import { defaultTemplate, errorLines, evaluateTemplate, fields, helpAt } from './template-reference.mjs';

//region Authored states of the template editor study, with what each must draw
// One template is studied: the track row's supporting line (D35, D81). Every text a state draws is
// computed here from the reference, so the native fixture's authored copy can be checked against
// what the grammar yields. Design evidence only; no production implementation is authorized.

/** Two files of the open library in the study: one analysed, one not analysed yet. */
export const library = [
  { title: 'Another Xronixle', file: 'かめりあ(Camellia) - Another Xronixle', ext: 'flac', folder: 'Camellia',
    path: 'Camellia/かめりあ(Camellia) - Another Xronixle.flac', len: 275, peak: '−1.2' },
  { title: 'Burning Aquamarine', file: 'かめりあ(Camellia) - Burning Aquamarine', ext: 'flac', folder: 'Camellia',
    path: 'Camellia/かめりあ(Camellia) - Burning Aquamarine.flac', len: 312, peak: undefined },
];

/** Stand-in rows for the preview when no library is open (D90). */
export const standIns = [
  { title: 'Track title', file: 'File name', ext: 'flac', folder: 'Folder', path: 'Folder/File name.flac', len: 200, peak: '−1.0' },
  { title: 'Track not analysed yet', file: 'File name', ext: 'flac', folder: 'Folder', path: 'Folder/File name.flac', len: 200, peak: undefined },
];

/**
 * `caret` is a position in the template text and means the field has focus and the keyboard is open;
 * without it the field is not focused. `|` in `typed` marks that position and is not part of the template.
 */
function scene({ id, page = 'editor', typed, libraryOpen = true }) {
  const caret = typed.indexOf('|');
  return { id, page, template: typed.replace('|', ''), caret: caret < 0 ? undefined : caret, libraryOpen };
}
export const scenes = [
  scene({ id: 'list', page: 'list', typed: defaultTemplate }),
  scene({ id: 'default', typed: defaultTemplate }),
  scene({ id: 'help', typed: defaultTemplate.replace('m:ss', 'm:|ss') }),
  scene({ id: 'unknown-field', typed: '$tf(mi(len), m:ss)$ · $mi(peek)$ dBTP|' }),
  scene({ id: 'open-formula', typed: '$tf(mi(len), m:ss)|' }),
  scene({ id: 'custom', typed: '$tc(up, mi(ext))$ · $tf(mi(len), m:ss)$' }),
  scene({ id: 'no-library', typed: defaultTemplate, libraryOpen: false }),
];

/** Every text the state draws that the grammar decides. */
export function expected(state) {
  const tracks = state.libraryOpen ? library : standIns;
  const results = tracks.map(track => evaluateTemplate({ text: state.template, track }));
  const valid = results.every(result => result.valid);
  // While the template is invalid the rows keep the last valid template, which in the study is the default (D90).
  const shown = valid ? results : tracks.map(track => evaluateTemplate({ text: defaultTemplate, track }));
  const errors = valid ? [] : errorLines(results[0].errors);
  // Mistakes take the place of typing help under the field; help is shown only for a template that applies.
  const help = valid && state.caret !== undefined ? helpAt({ text: state.template, caret: state.caret }) : undefined;
  return {
    id: state.id,
    page: state.page,
    template: state.template,
    caret: state.caret,
    focused: state.caret !== undefined,
    libraryOpen: state.libraryOpen,
    valid,
    previewRows: tracks.map((track, index) => ({ title: track.title, supporting: shown[index].text })),
    previewNote: !state.libraryOpen ? 'No library is open. These are sample values.' :
      valid ? 'From your library. The second file is not analysed yet.' : 'Rows keep the last valid template.',
    errors,
    help: help === undefined ? undefined : { signature: help.signature, parameter: help.parameter, description: help.description },
    fields: fields.map(field => ({ label: field.label, insert: 'mi(' + field.mode + ')', value: String(tracks[0][field.mode] ?? '') })),
    resetEnabled: state.template !== defaultTemplate,
    listEntry: { title: 'Track row supporting line', supporting: shown[0].text },
  };
}
//endregion

if (process.argv[1]?.endsWith('template-editor-scenes.mjs')) {
  console.log(JSON.stringify(scenes.map(expected), null, 2));
}
