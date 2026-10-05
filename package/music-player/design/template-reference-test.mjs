import assert from 'node:assert/strict';
import { defaultTemplate, errorLines, evaluateTemplate, fields, functions, helpAt, parseTemplate } from './template-reference.mjs';

//region Fixture tracks: one analysed, one not yet analysed, one with nothing but a path
const analysed = { title: 'Another Xronixle', file: 'かめりあ(Camellia) - Another Xronixle', ext: 'flac', folder: 'Camellia', path: 'Camellia/かめりあ(Camellia) - Another Xronixle.flac', len: 275, peak: '\u22120.3' };
const waiting = { ...analysed, title: 'Exit This Earth\'s Atomosphere', peak: undefined };
const bare = { title: 'x', file: 'x', ext: 'mp3', folder: '', path: 'x.mp3', len: undefined, peak: undefined };
let cases = 0;
function shows({ text, track, expected }) {
  const result = evaluateTemplate({ text, track });
  assert.deepEqual({ valid: result.valid, text: result.text }, { valid: true, text: expected }, text);
  cases += 1;
}
function refuses({ text, track = analysed, lines }) {
  const result = evaluateTemplate({ text, track });
  assert.equal(result.valid, false, text);
  assert.equal(result.text, undefined, text);
  assert.deepEqual(errorLines(result.errors), lines, text);
  cases += 1;
}
//endregion

//region Text, fields and the default line
shows({ text: '', track: analysed, expected: '' });
shows({ text: 'plain text, no formula', track: analysed, expected: 'plain text, no formula' });
shows({ text: defaultTemplate, track: analysed, expected: '4:35 · \u22120.3 dBTP' });
shows({ text: defaultTemplate, track: waiting, expected: '4:35' });
shows({ text: defaultTemplate, track: bare, expected: '' });
for (const field of fields) shows({ text: '[$mi(' + field.mode + ')$]', track: analysed, expected: '[' + String(analysed[field.mode]) + ']' });
shows({ text: '$mi(folder)$/$mi(file)$.$mi(ext)$', track: analysed, expected: 'Camellia/かめりあ(Camellia) - Another Xronixle.flac' });
shows({ text: '$mi(peak)$', track: waiting, expected: '' });
shows({ text: '$mi(title)$$mi(ext)$', track: analysed, expected: 'Another Xronixleflac' });
//endregion

//region Duration formats
shows({ text: '$tf(mi(len))$', track: analysed, expected: '4:35' });
shows({ text: '$tf(mi(len), mm:ss)$', track: analysed, expected: '04:35' });
shows({ text: '$tf(mi(len), h:mm:ss)$', track: analysed, expected: '0:04:35' });
shows({ text: '$tf(4000, m:ss)$', track: analysed, expected: '66:40' });
shows({ text: '$tf(4000, h:mm:ss)$', track: analysed, expected: '1:06:40' });
shows({ text: '$tf(4000, hh:mm:ss)$', track: analysed, expected: '01:06:40' });
shows({ text: '$tf(59.9, m:ss)$', track: analysed, expected: '0:59' });
// A bare letter in the format is always a time part; apostrophes keep text as written.
shows({ text: '$tf(mi(len), "m min")$', track: analysed, expected: '4 4in' });
shows({ text: '$tf(mi(len), "m\' min\'")$', track: analysed, expected: '4 min' });
shows({ text: '$tf(4000, "h\' hours\' and m\' minutes\'")$', track: analysed, expected: '1 hours and 6 minutes' });
shows({ text: '$tf(mi(len), m:ss)$', track: bare, expected: '' });
refuses({ text: '$tf(mi(title))$', lines: ['tf: needs a number of seconds, not Another Xronixle'] });
refuses({ text: '$tf()$', lines: ['tf: takes 1 or 2 values, as in tf(seconds, [format])'] });
refuses({ text: '$tf(1, m, s)$', lines: ['tf: takes 1 or 2 values, as in tf(seconds, [format])'] });
//endregion

//region Text conversion
shows({ text: '$tc(low, mi(title))$', track: analysed, expected: 'another xronixle' });
shows({ text: '$tc(up, mi(ext))$', track: analysed, expected: 'FLAC' });
shows({ text: '$tc(cap, "hello there")$', track: analysed, expected: 'Hello there' });
shows({ text: '$tc(cap, "")$', track: analysed, expected: '' });
shows({ text: '$tc(cut, mi(title), 7)$', track: analysed, expected: 'Another' });
shows({ text: '$tc(cut, mi(file), 4)$', track: analysed, expected: 'かめりあ' });
shows({ text: '$tc(cut, mi(title), 0)$', track: analysed, expected: '' });
shows({ text: '$tc(cut, mi(title), 99)$', track: analysed, expected: 'Another Xronixle' });
refuses({ text: '$tc(cut, mi(title))$', lines: ['tc: cut needs a length, as in tc(cut, text, 10)'] });
refuses({ text: '$tc(cut, mi(title), -1)$', lines: ['tc: cut needs a length, as in tc(cut, text, 10)'] });
refuses({ text: '$tc(ell, mi(title), 5)$', lines: ['tc: unknown mode ell'] });
refuses({ text: '$tc(up)$', lines: ['tc: takes 2 or 3 values, as in tc(mode, text, [length])'] });
//endregion

//region Conditions, comparisons and joining
shows({ text: '$if(mi(peak) != "", "analysed", "waiting")$', track: analysed, expected: 'analysed' });
shows({ text: '$if(mi(peak) != "", "analysed", "waiting")$', track: waiting, expected: 'waiting' });
shows({ text: '$if(mi(peak) = "", "waiting")$', track: analysed, expected: '' });
shows({ text: '$if(mi(peak), yes, no)$', track: waiting, expected: 'no' });
shows({ text: '$if(0, yes, no)$', track: analysed, expected: 'no' });
shows({ text: '$if(1, yes, no)$', track: analysed, expected: 'yes' });
shows({ text: '$if(mi(peak) > -1, hot, fine)$', track: analysed, expected: 'hot' });
shows({ text: '$if(mi(peak) > -1, hot, fine)$', track: waiting, expected: 'fine' });
shows({ text: '$if(mi(peak) > -1, hot, fine)$', track: { ...analysed, peak: '\u22121.2' }, expected: 'fine' });
shows({ text: '$if(mi(peak) = -0.3, same, different)$', track: analysed, expected: 'same' });
shows({ text: '$if(mi(len) >= 275, long, short)$', track: analysed, expected: 'long' });
shows({ text: '$if(mi(len) < 275, short, long)$', track: analysed, expected: 'long' });
shows({ text: '$if(mi(len) <= 275, short, long)$', track: analysed, expected: 'short' });
shows({ text: '$if(mi(ext) = flac, lossless, lossy)$', track: analysed, expected: 'lossless' });
shows({ text: '$if(mi(ext) != flac, lossy, lossless)$', track: analysed, expected: 'lossless' });
shows({ text: '$if(2 = 2.0, same, different)$', track: analysed, expected: 'same' });
shows({ text: '$mi(len) = 275$', track: analysed, expected: '1' });
shows({ text: '$mi(len) = 1$', track: analysed, expected: '0' });
shows({ text: '$"a" + "b" + mi(ext)$', track: analysed, expected: 'abflac' });
shows({ text: '$1 + 2$', track: analysed, expected: '12' });
// A nested `if` covers two fields that may each be absent, which is why combining with & and | is left out (D90).
shows({ text: '$if(mi(len) != "", if(mi(peak) != "", both, "length only"), neither)$', track: waiting, expected: 'length only' });
refuses({ text: '$if(1)$', lines: ['if: takes 2 or 3 values, as in if(condition, then, [else])'] });
// A mistake in the branch this track does not take is still reported.
refuses({ text: '$if(1, fine, mi(nope))$', lines: ['mi: unknown field nope'] });
//endregion

//region Mistakes are named, ordered by where they sit, and never shown as text
refuses({ text: '$xx(1)$ and $mi(nope)$', lines: ['xx: unknown function', 'mi: unknown field nope'] });
refuses({ text: '$mi(title)', lines: ['formula: the formula opened at character 1 is not closed'] });
refuses({ text: 'a $mi(title) - text', lines: ['formula: the formula opened at character 3 is not closed', 'formula: unexpected -'] });
refuses({ text: '$mi(title$', lines: ['mi: a closing bracket is missing'] });
refuses({ text: '$mi("title)$', lines: ['mi: a closing bracket is missing', 'text: a quotation mark is not closed'] });
refuses({ text: '$$', lines: ['formula: a value is missing'] });
refuses({ text: '$+$', lines: ['formula: a value is missing before +', 'formula: a value is missing'] });
refuses({ text: '$mi(title) mi(ext)$', lines: ['formula: unexpected mi'] });
refuses({ text: '$mi(,)$', lines: ['formula: a value is missing before ,', 'formula: a value is missing before )'] });
refuses({ text: '$mi()$', lines: ['mi: takes 1 value, as in mi(field)'] });
refuses({ text: '$' + 'tc(up, '.repeat(13) + 'x' + ')'.repeat(13) + '$', lines: ['tc: calls are nested too deeply'] });
refuses({ text: '$constructor(1)$', lines: ['constructor: unknown function'] });
refuses({ text: '$mi(__proto__)$', lines: ['mi: unknown field __proto__'] });
assert.equal(evaluateTemplate({ text: '$' + 'tc(up, '.repeat(12) + 'x' + ')'.repeat(12) + '$', track: analysed }).text, 'X');
cases += 1;
// Text that looks like another syntax stays text.
shows({ text: '<b>&amp; "quoted" \\n {x} `y` ; rm -rf ../', track: analysed, expected: '<b>&amp; "quoted" \\n {x} `y` ; rm -rf ../' });
shows({ text: 'line one\nline two $mi(ext)$', track: analysed, expected: 'line one\nline two flac' });
shows({ text: '$"<script>" + mi(ext)$', track: analysed, expected: '<script>flac' });
//endregion

//region Help follows the caret into the innermost call
function help({ text, marker = '|' }) {
  const caret = text.indexOf(marker);
  assert.ok(caret >= 0, text);
  const found = helpAt({ text: text.replace(marker, ''), caret });
  cases += 1;
  return found === undefined ? undefined : found.signature + ' / ' + found.parameter;
}
assert.equal(help({ text: 'plain| text' }), undefined);
assert.equal(help({ text: '$|mi(title)$' }), undefined);
assert.equal(help({ text: '$mi|(title)$' }), undefined);
assert.equal(help({ text: '$mi(|title)$' }), 'mi(field) / field');
assert.equal(help({ text: '$mi(title|)$' }), 'mi(field) / field');
assert.equal(help({ text: '$mi(title)|$' }), undefined);
assert.equal(help({ text: '$tf(|' }), 'tf(seconds, [format]) / seconds');
assert.equal(help({ text: '$tf(mi(|len), m:ss)$' }), 'mi(field) / field');
assert.equal(help({ text: '$tf(mi(len)|, m:ss)$' }), 'tf(seconds, [format]) / seconds');
assert.equal(help({ text: '$tf(mi(len), m:|ss)$' }), 'tf(seconds, [format]) / format');
assert.equal(help({ text: '$if(mi(peak) != "", " · " + mi(peak|) + " dBTP")$' }), 'mi(field) / field');
assert.equal(help({ text: '$if(mi(peak) != "", " · " + mi(peak) + " dBTP"|)$' }), 'if(condition, then, [else]) / then');
assert.equal(help({ text: '$if(a, b, c, |d)$' }), 'if(condition, then, [else]) / else');
assert.equal(help({ text: '$xx(|1)$' }), undefined);
assert.equal(help({ text: '$mi(title)$ and $tc(up, |' }), 'tc(mode, text, [length]) / text');
assert.equal(helpAt({ text: '$tf(', caret: 4 }).description, functions.tf.parameters[0].description);
cases += 1;
//endregion

//region The parse keeps where each formula sits
const parsed = parseTemplate('a$mi(ext)$b$mi(');
assert.deepEqual(parsed.parts.map(part => part.kind + ':' + (part.kind === 'literal' ? part.value : part.start + '-' + part.end + (part.closed ? '' : ' open'))),
  ['literal:a', 'formula:1-10', 'literal:b', 'formula:11-15 open']);
cases += 1;
//endregion
console.log('Template reference: ' + cases + ' cases passed.');
