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
  { name: 'hint-stamp', file: 'src/annotation.rs', before: '\n            && snapshot.stamp == stamp\n', after: '\n', integration: 'annotation', test: 'stale_snapshots_paint_nothing_and_show_no_card', failure: 'a stale hint was painted' },
  { name: 'hint-stamp-native', file: 'src/annotation.rs', before: '\n            && snapshot.stamp == stamp\n', after: '\n', native: true, test: 'stale_snapshots_disappear_after_reload_and_file_switch', failure: 'stale hints were painted after reload' },
  { name: 'diagnostic-stamp', file: 'src/annotation.rs', before: '.is_some_and(|snapshot| return snapshot.stamp == stamp);', after: '.is_some_and(|snapshot| return snapshot.stamp.file == snapshot.stamp.file || stamp.file == 0);', integration: 'annotation', test: 'stale_snapshots_paint_nothing_and_show_no_card', failure: 'a stale mark was painted' },
  { name: 'diagnostic-stamp-native', file: 'src/annotation.rs', before: '.is_some_and(|snapshot| return snapshot.stamp == stamp);', after: '.is_some_and(|snapshot| return snapshot.stamp.file == snapshot.stamp.file || stamp.file == 0);', native: true, test: 'stale_snapshots_disappear_after_reload_and_file_switch', failure: 'stale markers were painted after reload' },
  // The Language poll's entry points: a snapshot of other text is refused, and accepted diagnostics are indexed.
  { name: 'accept-hints-stamp', file: 'src/annotation.rs', before: 'snapshot: Arc<HintsSnapshot>) -> bool {\n        if snapshot.stamp != displayed {', after: 'snapshot: Arc<HintsSnapshot>) -> bool {\n        if snapshot.stamp.file != displayed.file {', integration: 'annotation', test: 'accepting_stores_only_snapshots_of_the_displayed_text', failure: 'hints for an earlier revision were stored' },
  { name: 'accept-diagnostics-stamp', file: 'src/annotation.rs', before: 'snapshot: Arc<DiagnosticsSnapshot>,\n    ) -> bool {\n        if snapshot.stamp != displayed {', after: 'snapshot: Arc<DiagnosticsSnapshot>,\n    ) -> bool {\n        if snapshot.stamp.file != displayed.file {', integration: 'annotation', test: 'accepting_stores_only_snapshots_of_the_displayed_text', failure: 'diagnostics for an earlier revision were stored' },
  { name: 'accept-diagnostics-index', file: 'src/annotation.rs', before: '        self.problems = problems;\n        self.reach = reach;\n', after: '        let _unused = (problems, reach);\n', integration: 'annotation', test: 'accepting_stores_only_snapshots_of_the_displayed_text', failure: 'accepted diagnostics were not indexed' },
  { name: 'accessor-stamp', file: 'src/annotation.rs', before: '            .hints\n            .as_deref()\n            .filter(|held| return held.stamp == displayed);', after: '            .hints\n            .as_deref()\n            .filter(|held| return held.stamp.file == displayed.file);', integration: 'annotation', test: 'accepting_stores_only_snapshots_of_the_displayed_text', failure: 'hints were handed out for another revision' },
  { name: 'accept-native', file: 'src/annotation.rs', before: 'snapshot: Arc<HintsSnapshot>) -> bool {\n        if snapshot.stamp != displayed {', after: 'snapshot: Arc<HintsSnapshot>) -> bool {\n        if snapshot.stamp.file != displayed.file {', native: true, test: 'accepted_snapshots_show_after_one_render', failure: 'hints for another revision were accepted' },
  // Bounded windows: only the materialized rows are taken, and ranges starting above them are still found.
  { name: 'hint-window', file: 'src/annotation.rs', before: 'if hint.position >= end {', after: 'if false {', integration: 'annotation', test: 'hint_window_follows_rows_and_line_ends', failure: equality },
  { name: 'diagnostic-window', file: 'src/annotation.rs', before: 'if problem.mark.start >= end {', after: 'if false {', native: true, test: 'only_visible_annotation_changes_repaint', failure: 'a change outside the materialized rows repainted the source' },
  { name: 'reach-index', file: 'src/annotation.rs', before: '            let from = self\n                .reach\n                .partition_point(|furthest| return *furthest < start);', after: '            let from = self\n                .problems\n                .partition_point(|problem| return problem.mark.start < start);', integration: 'annotation', test: 'diagnostic_window_finds_ranges_starting_above_it', failure: equality },
  { name: 'omitted-severity', file: 'src/annotation.rs', before: 'return severity.unwrap_or(Severity::Warning);', after: 'return severity.unwrap_or(Severity::Error);', integration: 'annotation', test: 'caret_problems_include_range_ends_and_order_by_severity', failure: equality },
  // Frame stamp: visible annotations and their inks are paint inputs.
  { name: 'stamp-annotations', file: 'src/source_frame.rs', before: '\n            && (Arc::ptr_eq(&self.annotations, &other.annotations)\n                || self.annotations == other.annotations)', after: '', integration: 'annotation_frame', test: 'visible_annotations_and_inks_are_paint_inputs', failure: 'a different hint label must repaint' },
  { name: 'stamp-annotations-native', file: 'src/source_frame.rs', before: '\n            && (Arc::ptr_eq(&self.annotations, &other.annotations)\n                || self.annotations == other.annotations)', after: '', native: true, test: 'annotations_leave_reading_geometry_copy_and_find_unchanged', failure: 'the injected diagnostics were not marked (positive control)' },
  { name: 'stamp-inks', file: 'src/source_frame.rs', before: '\n            && self.annotation_colors == other.annotation_colors;', after: ';', integration: 'annotation_frame', test: 'visible_annotations_and_inks_are_paint_inputs', failure: 'a different annotation ink must repaint' },
  // Geometry: terminator runs, point runs, overlap order, placement after the text, and line styles.
  { name: 'terminator-run', file: 'src/annotation_layout.rs', before: 'if mark.start <= row_end && mark.end > row_end {', after: 'if false {', integration: 'annotation_layout', test: 'multi_line_range_marks_every_row_including_an_empty_line', failure: equality },
  { name: 'point-run', file: 'src/annotation_layout.rs', before: 'if mark.start == mark.end {', after: 'if false {', integration: 'annotation_layout', test: 'point_ranges_get_a_terminator_wide_run', failure: equality },
  { name: 'overlap-order', file: 'src/annotation_layout.rs', before: 'underlines.sort_by_key(|run| return 3 - rank(run.severity));', after: '', integration: 'annotation_layout', test: 'overlapping_ranges_draw_the_worst_severity_last', failure: equality },
  { name: 'after-the-text', file: 'src/annotation_layout.rs', before: 'let mut x = row.caret_x(row_end, scale) + ITEM_GAP;', after: 'let mut x = ITEM_GAP;', native: true, test: 'late_snapshots_move_no_source_pixel', failure: 'a source pixel moved' },
  { name: 'line-styles', file: 'src/annotation_paint.rs', before: 'fn lit(severity: Severity, along: f32, scale: f32) -> bool {\n', after: 'fn lit(severity: Severity, along: f32, scale: f32) -> bool {\n    if along >= 0.0 {\n        return true;\n    }\n', integration: 'annotation_paint', test: 'each_severity_has_its_own_line_style_in_its_ink', failure: 'warning dashes' },
  { name: 'selected-underline-ink', file: 'src/annotation_paint.rs', before: 'let color = selection_paint::ink(pen.color, pen.selected, covered, 255);', after: 'let color = if covered > 2.0 { pen.selected } else { pen.color };', integration: 'annotation_paint', test: 'selected_underlines_take_the_selected_ink', failure: 'the selected underline is not in the selected ink' },
  // Native: the scroll range reaches labels, and the card shows only with source focus.
  { name: 'scroll-extent', file: 'src/native/render.rs', before: 'document_width = document_width.max(annotate::extent(view.annotations.as_ref()) + CARET_ROOM);', after: '', native: true, test: 'hint_labels_after_the_widest_line_extend_the_scroll_range', failure: 'the label is outside the scroll range' },
  { name: 'card-focus', file: 'ui/app.slint', before: 'problem-card-visible: code-focus.has-focus && root.caret-problems != "";', after: 'problem-card-visible: root.caret-problems != "";', native: true, test: 'caret_card_follows_the_caret_and_spells_out_the_problems', failure: 'assertion failed: !window.get_problem_card_visible()' },
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
