#!/usr/bin/env node
// Observe committed inlay-hint and diagnostic regressions failing after guard removal in a disposable package copy.
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
const artifact = mkdtempSync(join(privateRoot, 'ide-annotation-guard-'));
const source = join(artifact, 'package');
const origin = process.cwd();
cpSync(origin, source, { recursive: true, filter: path => !['target', '.git', 'node_modules'].includes(relative(origin, path).split(sep)[0]) });
mkdirSync(join(source, 'target'), { recursive: true });
console.log('ANNOTATION_GUARD_ARTIFACT=' + artifact);

const replaceOne = (text, before, after) => {
  const start = text.indexOf(before);
  if (start < 0) throw new Error('Mutation source anchor is absent: ' + before);
  if (text.indexOf(before, start + before.length) >= 0) throw new Error('Mutation source anchor is not unique: ' + before);
  return text.slice(0, start) + after + text.slice(start + before.length);
};
const equality = 'assertion `left == right` failed';
const cases = [
  // Stale snapshots: hints and diagnostics are painted only for the displayed file generation and revision.
  { name: 'hint-stamp', file: 'src/annotation/blocks.rs', before: 'let labelled = self.labelled == Some(displayed);', after: 'let labelled = self.labelled.is_some();', integration: 'annotation', test: 'stale_snapshots_paint_nothing_and_show_no_card', failure: 'a stale hint was painted' },
  { name: 'hint-stamp-native', file: 'src/annotation/blocks.rs', before: 'let labelled = self.labelled == Some(displayed);', after: 'let labelled = self.labelled.is_some();', native: true, test: 'stale_snapshots_disappear_after_reload_and_file_switch', failure: 'stale hints were painted after reload' },
  { name: 'diagnostic-stamp', file: 'src/annotation.rs', before: '.is_some_and(|snapshot| return snapshot.stamp == stamp);', after: '.is_some_and(|snapshot| return snapshot.stamp.file == snapshot.stamp.file || stamp.file == 0);', integration: 'annotation', test: 'stale_snapshots_paint_nothing_and_show_no_card', failure: 'a stale message was painted' },
  { name: 'diagnostic-stamp-native', file: 'src/annotation.rs', before: '.is_some_and(|snapshot| return snapshot.stamp == stamp);', after: '.is_some_and(|snapshot| return snapshot.stamp.file == snapshot.stamp.file || stamp.file == 0);', native: true, test: 'stale_snapshots_disappear_after_reload_and_file_switch', failure: 'stale markers were painted after reload' },
  // The Language poll's entry points: a snapshot of other text is refused, and accepted diagnostics are indexed.
  { name: 'accept-hints-stamp', file: 'src/annotation.rs', before: 'snapshot: Arc<HintsSnapshot>,\n    ) -> bool {\n        if snapshot.stamp != displayed {', after: 'snapshot: Arc<HintsSnapshot>,\n    ) -> bool {\n        if snapshot.stamp.file != displayed.file {', integration: 'annotation', test: 'accepting_stores_only_snapshots_of_the_displayed_text', failure: 'hints for an earlier revision were stored' },
  { name: 'accept-diagnostics-stamp', file: 'src/annotation.rs', before: 'snapshot: Arc<DiagnosticsSnapshot>,\n    ) -> bool {\n        if snapshot.stamp != displayed {', after: 'snapshot: Arc<DiagnosticsSnapshot>,\n    ) -> bool {\n        if snapshot.stamp.file != displayed.file {', integration: 'annotation', test: 'accepting_stores_only_snapshots_of_the_displayed_text', failure: 'diagnostics for an earlier revision were stored' },
  { name: 'accept-diagnostics-index', file: 'src/annotation.rs', before: '        self.problems = problems;\n        self.reach = reach;\n', after: '        let _unused = (problems, reach);\n', integration: 'annotation', test: 'accepting_stores_only_snapshots_of_the_displayed_text', failure: 'accepted diagnostics were not indexed' },
  { name: 'accessor-stamp', file: 'src/annotation.rs', before: '            .hints\n            .as_deref()\n            .filter(|held| return held.stamp == displayed);', after: '            .hints\n            .as_deref()\n            .filter(|held| return held.stamp.file == displayed.file);', integration: 'annotation', test: 'accepting_stores_only_snapshots_of_the_displayed_text', failure: 'hints were handed out for another revision' },
  { name: 'accept-native', file: 'src/annotation.rs', before: 'snapshot: Arc<HintsSnapshot>,\n    ) -> bool {\n        if snapshot.stamp != displayed {', after: 'snapshot: Arc<HintsSnapshot>,\n    ) -> bool {\n        if snapshot.stamp.file != displayed.file {', native: true, test: 'accepted_snapshots_show_after_one_render', failure: 'hints for another revision were accepted' },
  // Hints of one revision accumulate by the line range each answer asked about.
  { name: 'hint-range-replaced', file: 'src/annotation/blocks.rs', before: '        for line in stale {\n            self.labels.remove(&line);\n            self.placed.remove(&line);\n        }\n', after: '', integration: 'annotation', test: 'hints_of_one_revision_accumulate_by_line_range', failure: 'an answer did not replace the hints of its own lines' },
  { name: 'hint-revision-dropped', file: 'src/annotation/blocks.rs', before: '            self.labels.clear();\n            self.placed.clear();\n', after: '', integration: 'annotation', test: 'hints_of_one_revision_accumulate_by_line_range', failure: 'hints of the previous revision were kept' },
  // Space held across a reload: for one text only, hint space until hints for the line arrive, all of it until its time.
  { name: 'held-text-only', file: 'src/annotation/blocks.rs', before: 'if self.held_for == Some(displayed) {', after: 'if self.held_for.is_some() {', integration: 'annotation', test: 'held_space_keeps_block_heights_until_hints_return_or_time_passes', failure: 'held space was applied to another text' },
  { name: 'hint-space-released', file: 'src/annotation/blocks.rs', before: '            if asked.contains(&part.line) {\n                part.hints = 0.0;\n            }\n', after: '', integration: 'annotation', test: 'held_space_keeps_block_heights_until_hints_return_or_time_passes', failure: 'hint space was not given up when hints for the line arrived' },
  { name: 'hold-expiry', file: 'src/annotation/blocks.rs', before: 'let due = self.held_until.is_some_and(|until| return now >= until);', after: 'let due = false;', integration: 'annotation', test: 'held_space_keeps_block_heights_until_hints_return_or_time_passes', failure: 'space was not given up when its time had passed' },
  { name: 'hold-on-reload', file: 'src/native/reload.rs', before: '        rows::hold(&mut current, carried, window.window().scale_factor());', after: '        rows::refresh(&mut current, window.window().scale_factor());', native: true, test: 'a_reload_holds_row_space_until_annotations_return', failure: 'the reload changed where lines are' },
  { name: 'hold-expiry-render', file: 'src/native/reload.rs', before: '        if due {\n            render(&active_window, &state);\n        }\n', after: '', native: true, test: 'stale_snapshots_disappear_after_reload_and_file_switch', failure: 'held space was never given up' },
  // Bounded windows: only the diagnostics of the materialized rows are underlined, and ranges starting above them are found.
  { name: 'diagnostic-window', file: 'src/annotation.rs', before: 'if problem.mark.start >= end {', after: 'if false {', native: true, test: 'only_visible_annotation_changes_repaint', failure: 'a change outside the materialized rows repainted the source' },
  { name: 'reach-index', file: 'src/annotation.rs', before: '        let from = self\n            .reach\n            .partition_point(|furthest| return *furthest < start);', after: '        let from = self\n            .problems\n            .partition_point(|problem| return problem.mark.start < start);', integration: 'annotation', test: 'diagnostic_window_finds_ranges_starting_above_it', failure: equality },
  { name: 'omitted-severity', file: 'src/annotation.rs', before: 'return severity.unwrap_or(Severity::Warning);', after: 'return severity.unwrap_or(Severity::Error);', integration: 'annotation', test: 'caret_problems_include_range_ends_and_order_by_severity', failure: equality },
  { name: 'worst-first', file: 'src/annotation.rs', before: '            problems.sort_by_key(|problem| return rank(problem.mark.severity));\n', after: '', native: true, test: 'caret_problems_follow_the_caret_and_are_spelled_out_in_full', failure: 'messages above a line are listed worst first, then in source order' },
  // Message rows: a runaway message and a pile of messages are capped with a count.
  { name: 'message-cap', file: 'src/virtual_row.rs', before: 'if total > MESSAGE_ROWS && index + 1 == MESSAGE_ROWS {', after: 'if false {', integration: 'virtual_row', test: 'a_runaway_message_is_cut_and_counts_what_is_left_out', failure: equality },
  { name: 'pile-cap', file: 'src/virtual_row.rs', before: 'if index == LINE_MESSAGES {', after: 'if false {', integration: 'virtual_row', test: 'a_pile_of_messages_is_capped_with_a_count', failure: equality },
  // Frame stamp: visible annotations and their inks are paint inputs; a frame whose lines did not change is moved, not repainted.
  { name: 'stamp-annotations', file: 'src/source_frame.rs', before: '\n            && (Arc::ptr_eq(&self.annotations, &other.annotations)\n                || self.annotations == other.annotations)', after: '', integration: 'annotation_frame', test: 'visible_annotations_and_inks_are_paint_inputs', failure: 'a different hint label must repaint' },
  { name: 'stamp-annotations-native', file: 'src/source_frame.rs', before: '\n            && (Arc::ptr_eq(&self.annotations, &other.annotations)\n                || self.annotations == other.annotations)', after: '', native: true, test: 'annotations_leave_reading_geometry_copy_and_find_unchanged', failure: 'the injected diagnostics were not marked (positive control)' },
  { name: 'stamp-inks', file: 'src/source_frame.rs', before: '\n            && self.annotation_colors == other.annotation_colors;', after: ';', integration: 'annotation_frame', test: 'visible_annotations_and_inks_are_paint_inputs', failure: 'a different annotation ink must repaint' },
  { name: 'rows-wait-for-scrolling', file: 'src/native/rows.rs', before: 'if kept != offset && same_text && scrolling(current) {', after: 'if false {', native: true, test: 'rows_above_the_view_wait_until_scrolling_has_stopped', failure: 'rows above the view moved the offset while the reader was scrolling' },
  { name: 'rebase-frame', file: 'src/native/render.rs', before: '            && view.rebase(row_map)\n', after: '            && false\n', native: true, test: 'rows_arriving_above_the_view_move_no_visible_pixel', failure: 'a visible pixel moved when rows arrived above the view' },
  // Geometry: terminator runs, point runs, overlap order, hints and messages at their pixel x, packing, and line styles.
  { name: 'terminator-run', file: 'src/annotation_layout.rs', before: 'if mark.start <= row_end && mark.end > row_end {', after: 'if false {', integration: 'annotation_layout', test: 'multi_line_range_marks_every_row_including_an_empty_line', failure: equality },
  { name: 'point-run', file: 'src/annotation_layout.rs', before: 'if mark.start == mark.end {', after: 'if false {', integration: 'annotation_layout', test: 'point_ranges_get_a_terminator_wide_run', failure: equality },
  { name: 'overlap-order', file: 'src/annotation_layout.rs', before: 'underlines.sort_by_key(|run| return 3 - rank(run.severity));', after: '', integration: 'annotation_layout', test: 'overlapping_ranges_draw_the_worst_severity_last', failure: equality },
  { name: 'hint-at-its-position', file: 'src/annotation_layout.rs', before: 'let x = row.caret_x(hint.position, scale);', after: 'let x = 0.0;', integration: 'annotation_layout', test: 'hints_stand_at_the_exact_pixel_x_of_their_position', failure: 'does not stand above it' },
  { name: 'message-at-its-diagnostic', file: 'src/annotation_layout.rs', before: 'let mut x = row.caret_x(message.start, scale);', after: 'let mut x = 0.0;', integration: 'annotation_layout', test: 'message_rows_start_at_their_diagnostic_and_sit_tight_on_the_code_row', failure: equality },
  { name: 'hint-gap', file: 'src/annotation_layout.rs', before: 'if rows == 0 || x < end + HINT_GAP {', after: 'if rows == 0 {', integration: 'annotation_layout', test: 'overlapping_hints_take_a_new_row_and_only_the_current_row_is_considered', failure: equality },
  { name: 'rows-above-the-code-row', file: 'src/text_raster.rs', before: 'let top = view.map.code_top(text.line) - text.rise;', after: 'let top = view.map.code_top(text.line);', integration: 'annotation_paint', test: 'virtual_rows_paint_above_the_code_row_and_never_in_it', failure: 'pixels of its ink' },
  { name: 'line-styles', file: 'src/annotation_paint.rs', before: 'fn lit(severity: Severity, along: f32, scale: f32) -> bool {\n', after: 'fn lit(severity: Severity, along: f32, scale: f32) -> bool {\n    if along >= 0.0 {\n        return true;\n    }\n', integration: 'annotation_paint', test: 'each_severity_has_its_own_line_style_in_its_ink', failure: 'warning dashes' },
  { name: 'selected-underline-ink', file: 'src/annotation_paint.rs', before: 'let color = selection_paint::ink(pen.color, pen.selected, covered, 255);', after: 'let color = if covered > 2.0 { pen.selected } else { pen.color };', integration: 'annotation_paint', test: 'selected_underlines_take_the_selected_ink', failure: 'the selected underline is not in the selected ink' },
  // The vertical mapping: a block belongs to the code row beneath it, blocks take their height, and the view is kept still.
  { name: 'block-belongs-beneath', file: 'src/row_map.rs', before: '            return Place {\n                line: owner,\n                in_block: true,\n            };', after: '            return Place {\n                line: owner.saturating_sub(1),\n                in_block: true,\n            };', integration: 'row_map', test: 'every_pixel_belongs_to_one_line_and_blocks_to_the_row_beneath', failure: equality },
  { name: 'block-belongs-beneath-native', file: 'src/row_map.rs', before: '            return Place {\n                line: owner,\n                in_block: true,\n            };', after: '            return Place {\n                line: owner.saturating_sub(1),\n                in_block: true,\n            };', native: true, test: 'virtual_rows_are_not_source_text', failure: 'did not act on that line' },
  { name: 'blocks-take-their-height', file: 'src/native/rows.rs', before: 'raised.push((block.line, block.height()));', after: 'raised.push((block.line, 0.0));', native: true, test: 'rows_arriving_in_view_move_only_lines_beneath_them', failure: 'changed its pixels' },
  { name: 'view-kept-still', file: 'src/native/rows.rs', before: 'let kept = anchored(&current.row_map, &layout.map, offset).min(limit(&layout.map, height));', after: 'let kept = offset.min(limit(&layout.map, height));', native: true, test: 'rows_arriving_above_the_view_move_no_visible_pixel', failure: 'the offset did not follow the rows that arrived above the view' },
  { name: 'top-stays-top', file: 'src/native/rows.rs', before: '    if offset <= 0.0 {\n        return 0.0;\n    }\n', after: '', native: true, test: 'rows_arriving_above_the_view_move_no_visible_pixel', failure: equality },
  // Native: the scroll range reaches rows past the widest line.
  { name: 'scroll-extent', file: 'src/native/render.rs', before: 'document_width = document_width.max(annotate::extent(view.annotations.as_ref()) + CARET_ROOM);', after: '', native: true, test: 'rows_past_the_widest_line_extend_the_scroll_range', failure: 'the label is outside the scroll range' },
  // Native: the gutter letter names the worst severity starting on a line, and its column never moves the text.
  { name: 'gutter-letter', file: 'src/native/rows.rs', before: 'marks[block.line - current.first] = i32::from(rank(worst.severity)) + 1;', after: 'marks[block.line - current.first] = 0;\n            let _unused = worst;', native: true, test: 'gutter_letters_show_the_worst_severity_in_front_of_the_line_number', failure: 'marks handed to the window' },
  { name: 'gutter-worst', file: 'src/native/rows.rs', before: 'if let Some(worst) = block.messages.first() {', after: 'if let Some(worst) = block.messages.last() {', native: true, test: 'gutter_letters_show_the_worst_severity_in_front_of_the_line_number', failure: 'marks handed to the window' },
  { name: 'gutter-column-fixed', file: 'ui/app.slint', before: 'private property <length> gutter-width: root.mark-column + root.number-column;', after: 'private property <length> gutter-width: root.number-column + (root.line-marks[0] > 0 ? root.mark-column : 0px);', native: true, test: 'gutter_letters_show_the_worst_severity_in_front_of_the_line_number', failure: 'moved sideways when diagnostics arrived' },
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
    const changed = replaceOne(original, item.before, item.after);
    if (changed === original) throw new Error('Mutation did not change ' + item.file);
    writeFileSync(path, changed);
    run(item, 'removed');
  } finally { writeFileSync(path, original); }
  run(item, 'restored');
}
console.log('Annotation guard controls passed: ' + artifact + ' (' + selected.length + ' of ' + cases.length + ' guards)');
