#!/usr/bin/env node
// Observe committed source-view reading regressions failing after guard removal in a disposable package copy.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, sep } from 'node:path';

const privateRoot = join(homedir(), 'temp', 'agent');
if ((statSync(privateRoot).mode & 0o077) !== 0) throw new Error('Guard scratch root must exclude group and other permissions: ' + privateRoot);
if (!process.env.usage_cache) throw new Error('Provide the disposable Cargo target-cache directory');
const cache = realpathSync(process.env.usage_cache);
if (!cache.startsWith(realpathSync(privateRoot) + sep) || !statSync(cache).isDirectory()) throw new Error('Target cache must be a disposable directory below ' + privateRoot);
// A private Cargo home copy keeps disposable builds off the shared volume's package-cache lock.
let cargoHome = 'ide-cargo';
if (process.env.usage_cargo) {
  cargoHome = realpathSync(process.env.usage_cargo);
  if (!cargoHome.startsWith(realpathSync(privateRoot) + sep) || !statSync(cargoHome).isDirectory()) throw new Error('Cargo home copy must be a disposable directory below ' + privateRoot);
}
const artifact = mkdtempSync(join(privateRoot, 'ide-source-guard-'));
const source = join(artifact, 'package');
const origin = process.cwd();
cpSync(origin, source, { recursive: true, filter: path => !['target', '.git', 'node_modules'].includes(relative(origin, path).split(sep)[0]) });
mkdirSync(join(source, 'target'), { recursive: true });
console.log('SOURCE_GUARD_ARTIFACT=' + artifact);

const replaceOne = (text, before, after, occurrence = 0) => {
  let offset = 0;
  let start = -1;
  for (let index = 0; index <= occurrence; index++) {
    start = text.indexOf(before, offset);
    if (start < 0) throw new Error('Mutation source anchor is absent: ' + before);
    offset = start + before.length;
  }
  return text.slice(0, start) + after + text.slice(start + before.length);
};
const equality = 'assertion `left == right` failed';
const cases = [
  // Tab stops: the half-space rule, the unusable-advance guard, and the scale conversion of corrections.
  { name: 'tab-half-space', file: 'src/tab_stop.rs', before: 'if distance < space / 2.0 {', after: 'if false {', integration: 'tab_stop', test: 'tab_narrower_than_half_a_space_uses_the_following_stop', failure: 'a sliver tab was kept instead of the next stop' },
  { name: 'tab-unusable-space', file: 'src/tab_stop.rs', before: 'if !usable {', after: 'if false {', integration: 'tab_stop', test: 'unusable_space_advance_keeps_one_space_width', failure: equality },
  { name: 'tab-scale', file: 'src/tab_layout.rs', before: 'spacings.push((*byte, extra / scale));', after: 'spacings.push((*byte, extra));', integration: 'tab_geometry', test: 'tab_geometry_is_the_same_at_every_scale', failure: 'at scale 1' },
  { name: 'tab-leading-shortcut', file: 'src/tab_layout.rs', before: 'if *byte != ordinal {', after: 'if false {', integration: 'tab_geometry', test: 'tabs_end_on_multiples_of_two_measured_space_advances', failure: 'the tab ends at' },
  // Reading geometry: hits never split a grapheme, and a selected terminator is marked.
  { name: 'grapheme-snap', file: 'src/shaped_row.rs', before: 'return self.source_start + self.snapped(proposed, x * scale);', after: 'return self.source_start + proposed;', integration: 'reading_boundaries', test: 'every_pixel_hits_the_nearest_grapheme_boundary', failure: 'hit inside a grapheme' },
  { name: 'terminator-mark', file: 'src/shaped_text.rs', before: 'if start <= row_end && end > row_end {', after: 'if false {', integration: 'reading_boundaries', test: 'selected_terminators_are_copied_and_marked', failure: 'terminator mark' },
  // Vertical movement: the remembered column belongs to one caret position, and the text ends stop the caret.
  { name: 'stale-column', file: 'src/vertical_motion.rs', before: '&& column.head == head', after: '&& true', integration: 'vertical_motion', test: 'stale_preferred_column_is_ignored', failure: 'a column remembered for another caret position moved the caret' },
  { name: 'first-line-stop', file: 'src/vertical_motion.rs', before: 'if rows < 0 && row == 0 {', after: 'if false {', integration: 'vertical_motion', test: 'first_and_last_line_stop_at_the_ends_of_text', failure: equality },
  { name: 'last-line-stop', file: 'src/vertical_motion.rs', before: 'if rows > 0 && row == last {', after: 'if false {', integration: 'vertical_motion', test: 'first_and_last_line_stop_at_the_ends_of_text', failure: 'a last line without terminator ends at the end of text' },
  // Word units stay on their line.
  { name: 'word-stays-on-line', file: 'src/caret_motion.rs', before: 'while start > first && class_at', after: 'while start > 0 && class_at', integration: 'caret_motion', test: 'word_range_prefers_a_word_and_stays_on_its_line', failure: 'leading blanks stay on their own line' },
  // Click counting: interval, row, distance, and the restart after a triple click.
  { name: 'click-interval', file: 'src/pointer_selection.rs', before: '&& at.saturating_duration_since(previous.at) <= CLICK_INTERVAL', after: '&& true', integration: 'pointer_selection', test: 'slow_or_distant_presses_are_single_clicks', failure: 'a pause longer than the interval must start over' },
  { name: 'click-row', file: 'src/pointer_selection.rs', before: '&& previous.row == row', after: '&& true', integration: 'pointer_selection', test: 'slow_or_distant_presses_are_single_clicks', failure: 'a press on another row must start over' },
  { name: 'click-slop', file: 'src/pointer_selection.rs', before: '&& (previous.x - x).abs() <= CLICK_SLOP', after: '&& true', integration: 'pointer_selection', test: 'slow_or_distant_presses_are_single_clicks', failure: 'a press farther away than the slop must start over' },
  { name: 'click-restart', file: 'src/pointer_selection.rs', before: '&& previous.count < 3', after: '&& true', integration: 'pointer_selection', test: 'quick_presses_cycle_through_character_word_and_line', failure: equality },
  { name: 'drag-keeps-unit', file: 'src/pointer_selection.rs', before: 'return (origin.1, start);', after: 'return (origin.0, start);', integration: 'pointer_selection', test: 'drag_extends_by_whole_units_and_keeps_the_pressed_unit', failure: 'dragging left must keep the pressed word and take the whole earlier word' },
  // Selection ink: the white-first rule and the translucent-fill fallback.
  { name: 'ink-white-first', file: 'src/selection_ink.rs', before: 'if contrast(WHITE, background) >= WHITE_MINIMUM {', after: 'if contrast(WHITE, background) >= contrast(BLACK, background) {', integration: 'selection_ink', test: 'dark_scheme_selection_ink_is_light_on_the_fluent_selection_background', failure: 'dark-scheme selected text stayed dark on the selection background' },
  { name: 'ink-translucent', file: 'src/selection_ink.rs', before: 'if background[3] != 255 {', after: 'if false {', integration: 'selection_ink', test: 'translucent_selection_background_keeps_the_palette_ink', failure: equality },
  // Native bindings: key filters, the column reset, caret room, drag selection, and focus stops.
  { name: 'alt-is-not-a-caret-key', file: 'src/native/input.rs', before: '        if alt {\n            return;\n        }', after: '', native: true, test: 'horizontal_keys_move_by_grapheme_word_line_and_document_and_extend_with_shift', failure: 'Alt combinations are not caret keys' },
  { name: 'control-vertical-unbound', file: 'src/native/input.rs', before: '            && !control\n', after: '', native: true, test: 'horizontal_keys_move_by_grapheme_word_line_and_document_and_extend_with_shift', failure: 'Ctrl+Down and Ctrl+PageDown are unbound' },
  { name: 'horizontal-resets-column', file: 'src/native/input.rs', before: '            column = None;\n', after: '', native: true, test: 'vertical_keys_keep_a_preferred_column_and_extend_with_shift', failure: 'Down after Home must stay in column zero' },
  { name: 'selection-collapse-left', file: 'src/native/input.rs', before: 'if !shift && start != end && motion == Motion::Left {', after: 'if false {', native: true, test: 'horizontal_keys_move_by_grapheme_word_line_and_document_and_extend_with_shift', failure: 'Left collapses a selection to its start' },
  { name: 'selection-collapse-right', file: 'src/native/input.rs', before: '} else if !shift && start != end && motion == Motion::Right {', after: '} else if false {', native: true, test: 'horizontal_keys_move_by_grapheme_word_line_and_document_and_extend_with_shift', failure: 'Right collapses a selection to its end' },
  { name: 'page-keys-move-view', file: 'src/native/input.rs', before: '                scrolled = rows as f32 * 24.0;\n', after: '', native: true, test: 'page_keys_move_by_the_visible_height_and_keep_the_caret_in_view', failure: 'PageDown must move the view by the same whole lines' },
  { name: 'shift-click-ends-count', file: 'src/native/input.rs', before: '            pressed.clicks.reset();\n', after: '', native: true, test: 'shift_click_extends_the_selection_from_its_anchor', failure: 'a plain click after Shift+click must be a single click' },
  { name: 'caret-follow', file: 'src/native/input.rs', before: '        follow(&window, &state, scrolled);', after: '        render(&window, &state);', native: true, test: 'view_follows_the_caret_with_the_smallest_scroll', failure: 'one line past the bottom edge must scroll by the missing part of that line only' },
  { name: 'caret-room', file: 'src/native/render.rs', before: 'row.layout.full_width() / factor + CARET_ROOM', after: 'row.layout.full_width() / factor', native: true, test: 'view_follows_the_caret_with_the_smallest_scroll', failure: 'End on a long line must show the whole caret' },
  { name: 'mouse-drag-selects', file: 'ui/app.slint', before: '                    mouse-drag-pan-enabled: false;\n', after: '', native: true, test: 'drag_selects_text_by_characters_and_by_words_without_panning', failure: equality },
  { name: 'left-button-only', file: 'ui/app.slint', before: '                            if !self.pressed { return; }\n', after: '', native: true, test: 'drag_selects_text_by_characters_and_by_words_without_panning', failure: 'a drag with the middle button changed the selection' },
  { name: 'observer-scope-not-a-stop', file: 'ui/app.slint', before: '        focus-on-tab-navigation: false;\n', after: '', native: true, test: 'tab_alternates_between_tree_and_source_while_find_is_closed', failure: 'Tab must cycle tree and source only' },
  { name: 'find-scope-not-a-stop', file: 'ui/find.slint', before: '        focus-on-tab-navigation: false;\n', after: '', native: true, test: 'tab_visits_tree_source_and_open_find_bar_in_reading_order', failure: 'Tab order with an open find bar' },
  { name: 'back-tab-leaves-source', file: 'ui/app.slint', before: ' || event.text == Key.Backtab', after: '', native: true, test: 'tab_alternates_between_tree_and_source_while_find_is_closed', failure: 'the dedicated back-tab key did not leave the source view' },
];
// An optional comma-separated list reruns only the named guards, for example after adding one.
const only = process.env.usage_only ? new Set(process.env.usage_only.split(',')) : undefined;
const selected = only ? cases.filter(item => only.has(item.name)) : cases;
if (only && selected.length !== only.size) throw new Error('Unknown guard name in: ' + process.env.usage_only);
const results = [];
const baselined = new Set();
const run = (item, phase) => {
  const command = item.native
    ? ['cargo', 'nextest', 'run', '--offline', '--features', 'slint/mcp', '--bin', 'monochromatic-ide', '--filter-expr', 'test(' + item.test + ')']
    : ['cargo', 'test', '--offline', '--no-default-features', '--test', item.integration, item.test, '--', '--nocapture'];
  const result = spawnSync('podman', [
    'run', '--rm', '--network=none', '--memory=2g', '--cpus=2', '--pids-limit=512',
    '--ulimit', 'nofile=4096:4096', '--security-opt', 'label=disable',
    '--volume', source + ':/work', '--volume', cache + ':/work/target', '--volume', cargoHome + ':/cargo',
    '--workdir', '/work', '--env', 'CARGO_BUILD_JOBS=2', '--env', 'SLINT_EMIT_DEBUG_INFO=1',
    '--env', 'SLINT_BACKEND=headless', '--env', 'SLINT_MCP_PORT=0', '--env', 'HELIX_RUNTIME=/work/target/debug/runtime',
    'localhost/monochromatic/ide', ...command,
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  writeFileSync(join(artifact, item.name + '-' + phase + '.log'), output);
  if (result.error) throw result.error;
  const failedAsExpected = result.status !== 0 && output.includes(item.test) && output.includes(item.failure);
  const passedAsExpected = result.status === 0 && output.includes(item.test) && /1 (?:test|passed)/.test(output);
  const accepted = phase === 'removed' ? failedAsExpected : passedAsExpected;
  results.push({ name: item.name, phase, test: item.test, status: result.status, accepted });
  writeFileSync(join(artifact, 'results.json'), JSON.stringify(results, null, 2));
  if (!accepted) throw new Error('Unexpected ' + phase + ' result for ' + item.name + '; inspect ' + artifact);
  console.log(JSON.stringify(results.at(-1)));
};
for (const item of selected) {
  // A restored run of an earlier case is already this test's unmodified baseline.
  if (!baselined.has(item.test)) {
    run(item, 'baseline');
    baselined.add(item.test);
  }
  const path = join(source, item.file);
  const original = readFileSync(path, 'utf8');
  try {
    const changed = replaceOne(original, item.before, item.after, item.occurrence);
    if (changed === original) throw new Error('Mutation did not change ' + item.file);
    writeFileSync(path, changed);
    run(item, 'removed');
  } finally { writeFileSync(path, original); }
  run(item, 'restored');
}
console.log('Source guard controls passed: ' + artifact + ' (' + selected.length + ' of ' + cases.length + ' guards)');
