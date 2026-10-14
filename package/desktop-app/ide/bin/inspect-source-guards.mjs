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
  // A line past the raster limit is painted in a clip that follows the view, in a raster within the limit.
  { name: 'clip-chosen', file: 'src/native/viewport.rs', before: 'if bottom - first_top <= cap {', after: 'if true {', native: true, test: 'a_line_past_the_raster_limit_is_painted_in_a_clip_that_follows_the_view', failure: 'the window shows an error' },
  { name: 'clip-edges', file: 'src/native/viewport.rs', before: 'Some(clip) => (first_top + clip.top, first_top + clip.bottom),', after: 'Some(_) => (first_top, current.row_map.block_top(end)),', native: true, test: 'a_line_past_the_raster_limit_is_painted_in_a_clip_that_follows_the_view', failure: 'does not hold the view' },
  { name: 'clip-gutter', file: 'src/native/rows.rs', before: 'if view.viewport.clip.is_some() && (top + CODE_ROW <= band.0 || top >= band.1) {', after: 'if false {', native: true, test: 'a_line_past_the_raster_limit_is_painted_in_a_clip_that_follows_the_view', failure: 'the gutter lists' },
  { name: 'clip-cap', file: 'src/native/render.rs', before: 'let rows = MAX_RASTER_BYTES / 4 / columns;', after: 'let rows = MAX_RASTER_BYTES / 1 / columns;', native: true, test: 'a_line_past_the_raster_limit_is_painted_in_a_clip_that_follows_the_view', failure: 'the window shows an error' },
  { name: 'clip-origin', file: 'src/shaped_text.rs', before: 'Some(clip) => (first_top + clip.top, clip.bottom - clip.top),', after: 'Some(clip) => (first_top, clip.bottom - clip.top),', integration: 'wrap_rows', test: 'a_clipped_tile_holds_the_pixels_of_its_band', failure: equality },
  { name: 'clip-rebase', file: 'src/shaped_text/view.rs', before: 'let skip = self.viewport.clip.map_or(0.0, |clip| return clip.top);', after: 'let skip = 0.0;', integration: 'wrap_rows', test: 'a_clipped_tile_holds_the_pixels_of_its_band', failure: equality },
  { name: 'clip-rounding', file: 'src/native/viewport.rs', before: '    cut = cut.min(top + allowed);\n', after: '', native: true, test: 'a_clip_stays_within_the_raster_limit_for_every_window_size', failure: 'passes the limit' },
  { name: 'wrapped-tile-holds', file: 'src/native/viewport.rs', before: 'if shown.width == width && holds(current, shown, view, height) {', after: 'if false && holds(current, shown, view, height) {', native: true, test: 'scrolling_inside_a_built_tile_of_a_wrapped_file_does_no_source_work', failure: 'the source tile worker did not finish the re-center' },
  // Tab correction: the passes a line gets fall with its length, so the characters shaped stay near a budget.
  { name: 'tab-budget', file: 'src/tab_layout.rs', before: 'for _ in 0..passes_for(projection.text.len()) {', after: 'for _ in 0..TAB_PASSES {', lib: true, test: 'tab_layout::tests::a_long_tabbed_line_shapes_no_more_passes_than_its_length_allows', failure: 'more than the' },
  { name: 'tab-budget-formula', file: 'src/tab_layout.rs', before: 'return (TAB_BUDGET / length.max(1)).clamp(TAB_MIN_PASSES, TAB_PASSES);', after: 'return TAB_PASSES;', lib: true, test: 'tab_layout::tests::passes_fall_with_the_length_of_the_line', failure: equality },
  // A very long line: its caret stops come from a rope, so the lookups of the walk scan chunks, not the whole line.
  { name: 'long-line-stops', file: 'src/text_projection.rs', before: 'let slice = if source.len() <= FLAT_LINE_BYTES {', after: 'let slice = if true {', lib: true, test: 'text_projection::tests::the_work_of_finding_stops_grows_with_the_line_not_its_square', failure: 'the lookups scanned' },
  // Tab stops: the half-space rule, the unusable-advance guard, and the scale conversion of corrections.
  { name: 'tab-half-space', file: 'src/tab_stop.rs', before: 'if distance < space / 2.0 {', after: 'if false {', integration: 'tab_stop', test: 'tab_narrower_than_half_a_space_uses_the_following_stop', failure: 'a sliver tab was kept instead of the next stop' },
  { name: 'tab-unusable-space', file: 'src/tab_stop.rs', before: 'if !usable {', after: 'if false {', integration: 'tab_stop', test: 'unusable_space_advance_keeps_one_space_width', failure: equality },
  { name: 'tab-scale', file: 'src/tab_layout.rs', before: 'spacings.push((*byte, extra / scale));', after: 'spacings.push((*byte, extra));', integration: 'tab_geometry', test: 'tab_geometry_is_the_same_at_every_scale', failure: 'at scale 1' },
  { name: 'tab-leading-shortcut', file: 'src/tab_layout.rs', before: 'if *byte != ordinal {', after: 'if false {', integration: 'tab_geometry', test: 'tabs_end_on_multiples_of_two_measured_space_advances', failure: 'the tab ends at' },
  // Reading geometry: hits never split a grapheme, and a selected terminator is marked.
  { name: 'grapheme-snap', file: 'src/shaped_row.rs', before: 'return self.source_start + self.snapped(proposed, x, row);', after: 'return self.source_start + proposed;', integration: 'reading_boundaries', test: 'every_pixel_hits_the_nearest_grapheme_boundary', failure: 'hit inside a grapheme' },
  { name: 'terminator-mark', file: 'src/shaped_text/view.rs', before: 'if start <= row_end && end > row_end {', after: 'if false {', integration: 'reading_boundaries', test: 'selected_terminators_are_copied_and_marked', failure: 'terminator mark' },
  // Vertical movement: the remembered column belongs to one caret position, and the text ends stop the caret.
  { name: 'stale-column', file: 'src/vertical_motion.rs', before: '        && column.head == head\n', after: '        && true\n', integration: 'vertical_motion', test: 'stale_preferred_column_is_ignored', failure: 'a column remembered for another caret position moved the caret' },
  { name: 'first-line-stop', file: 'src/vertical_motion.rs', before: 'if rows < 0 && first_row {', after: 'if false {', integration: 'vertical_motion', test: 'first_and_last_line_stop_at_the_ends_of_text', failure: equality },
  { name: 'last-line-stop', file: 'src/vertical_motion.rs', before: 'if rows > 0 && last_row {', after: 'if false {', integration: 'vertical_motion', test: 'first_and_last_line_stop_at_the_ends_of_text', failure: 'a last line without terminator ends at the end of text' },
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
  { name: 'page-keys-move-view', file: 'src/native/input.rs', before: '                scrolled = down_pixels;\n', after: '', native: true, test: 'page_keys_move_by_the_visible_height_and_keep_the_caret_in_view', failure: 'PageDown must move the view by the same whole lines' },
  { name: 'shift-click-ends-count', file: 'src/native/input.rs', before: '            pressed.clicks.reset();\n', after: '', native: true, test: 'shift_click_extends_the_selection_from_its_anchor', failure: 'a plain click after Shift+click must be a single click' },
  { name: 'caret-follow', file: 'src/native/input.rs', before: '        follow(&window, &state, scrolled);', after: '        render(&window, &state);', native: true, test: 'view_follows_the_caret_with_the_smallest_scroll', failure: 'one line past the bottom edge must scroll by the missing part of that line only' },
  // Soft wrap: the caret room at the right edge of the wrapped text, and visual rows in hits and selected ink.
  { name: 'caret-room', file: 'src/native/viewport.rs', before: 'pub(super) const CARET_ROOM: f32 = 2.0;', after: 'pub(super) const CARET_ROOM: f32 = 0.0;', native: true, test: 'the_caret_after_a_full_row_stays_inside_the_view', failure: 'the caret after a full row is cut by the view edge' },
  { name: 'hit-visual-row', file: 'src/shaped_row.rs', before: 'return self.hit_physical(x * scale, y * scale);', after: 'return self.hit_physical(x * scale, 0.0);', integration: 'wrap', test: 'hit_probes_the_visual_row_under_the_point', failure: 'lower row hit' },
  { name: 'click-visual-row', file: 'src/native/input.rs', before: 'let hit = candidate.hit_at(x, within, view.viewport.scale);', after: 'let hit = candidate.hit_at(x, 0.0, view.viewport.scale);', native: true, test: 'a_click_on_a_continuation_row_places_the_caret_in_that_row', failure: 'placed the caret at' },
  { name: 'selected-ink-visual-row', file: 'src/text_raster.rs', before: 'if let Some(index) = row.visual_row_holding(rectangle.y, factor) {', after: 'if let Some(index) = row.visual_row_holding(rectangle.y, factor).filter(|first| return *first == 0) {', integration: 'wrap_rows', test: 'selected_ink_reaches_continuation_rows', failure: 'has selected ink' },
  // Soft wrap: the gutter, the measured rows, and the worker that measures them.
  { name: 'gutter-number-on-first-row-only', file: 'src/native/rows.rs', before: 'numbers.push(if visual == 0 {', after: 'numbers.push(if true {', native: true, test: 'the_gutter_numbers_first_rows_and_marks_continuation_rows', failure: 'continuation rows exist' },
  { name: 'pass-take-limit', file: 'src/native/tile.rs', before: 'worker.take_pass(TAKE_LIMIT)', after: 'worker.take_pass(usize::MAX)', native: true, test: 'opening_fifty_thousand_lines_never_blocks_the_window_thread', failure: 'past the bound of' },
  { name: 'view-kept-still-across-wrapped-rows', file: 'src/native/rows.rs', before: 'return (next.code_top(line) + within).max(0.0);', after: 'return offset;', native: true, test: 'rows_above_the_view_changing_height_move_no_visible_pixel', failure: 'the line at the top of the view moved on screen' },
  { name: 'rebreak-in-place', file: 'src/shaped_text/pass.rs', before: '&& self.rebreak(&mut stale, request.scale, width)', after: '&& false', integration: 'wrap_rows', test: 'a_new_width_breaks_kept_rows_again_without_shaping', failure: 'no line may be shaped again' },
  { name: 'pass-again-after-new-width', file: 'src/native/tile.rs', before: '    if current.shown.width != bounds.width {\n        current.pass_posted = None;\n    }', after: '    if false {\n        current.pass_posted = None;\n    }', native: true, test: 'a_measurement_applied_before_the_tile_of_a_new_width_leaves_no_stale_heights', failure: 'keep a stale height' },
  { name: 'tile-heights-merged', file: 'src/native/tile.rs', before: 'rows::absorb(&mut current, built.measured.iter().copied())', after: 'false', native: true, test: 'a_recenter_while_the_pass_runs_is_built_on_the_worker', failure: 'the worker\'s tile was discarded' },
  { name: 'mouse-drag-selects', file: 'ui/app.slint', before: '                    mouse-drag-pan-enabled: false;\n', after: '', native: true, test: 'drag_selects_text_by_characters_and_by_words_without_panning', failure: equality },
  { name: 'left-button-only', file: 'ui/app.slint', before: '                            if !self.pressed { return; }\n', after: '', native: true, test: 'drag_selects_text_by_characters_and_by_words_without_panning', failure: 'a drag with the middle button changed the selection' },
  { name: 'observer-scope-not-a-stop', file: 'ui/app.slint', before: '        focus-on-tab-navigation: false;\n', after: '', native: true, test: 'tab_cycles_tree_divider_and_source_while_find_is_closed', failure: 'Tab must cycle tree, divider, and source only' },
  { name: 'find-scope-not-a-stop', file: 'ui/find.slint', before: '        focus-on-tab-navigation: false;\n', after: '', native: true, test: 'tab_visits_tree_source_and_open_find_bar_in_reading_order', failure: 'Tab order with an open find bar' },
  { name: 'back-tab-leaves-source', file: 'ui/app.slint', before: ' || event.text == Key.Backtab', after: '', native: true, test: 'tab_cycles_tree_divider_and_source_while_find_is_closed', failure: 'the dedicated back-tab key did not leave the source view' },
  // Overscan tile: a view still inside the tile must not reach render, so it spends no tile, row, or image.
  { name: 'overscan-early-return', file: 'src/native/viewport.rs', before: '        if !changed {\n            return;\n        }', after: '        if false {\n            return;\n        }', native: true, test: 'scrolling_inside_the_overscan_tile_does_no_source_work', failure: 'scrolling inside the overscan tile must not enter render' },
  // Scroll re-center: a reader's re-center that the worker should build must not reach the window thread's shaping and painting.
  { name: 'recenter-on-window-thread', file: 'src/native/viewport.rs', before: '        if current.shown.width == current.width {\n            current.scroll_wanted', after: '        if false {\n            current.scroll_wanted', native: true, test: 'leaving_the_overscan_tile_re_centers_on_the_worker_thread', failure: 'the window thread paints no tile for a scroll re-center' },
  // A new wrap width: the window thread paints the tile for it within a counted allowance; what does not fit goes to the worker.
  { name: 'resize-on-window-thread', file: 'src/native/viewport.rs', before: '            current.rewrap = true;', after: '            current.scroll_wanted = Some(tile::requested(current));', native: true, test: 'the_first_frame_after_a_new_width_is_wrapped_to_it', failure: 'the displayed tile is not for the new width' },
  { name: 'drawn-frame-after-resize', file: 'src/native/viewport.rs', before: '            current.rewrap = true;', after: '            current.scroll_wanted = Some(tile::requested(current));', native: true, test: 'a_frame_drawn_right_after_a_resize_event_is_wrapped_to_the_new_width', failure: 'rows of the drawn frame run to its right edge' },
  { name: 'rewrap-view-past-cap', file: 'src/native/rewrap.rs', before: 'if requested.count > REWRAP_LINES {', after: 'if false {', also: [{ file: 'src/native/rewrap.rs', before: '                lines: REWRAP_LINES,', after: '                lines: usize::MAX,' }, { file: 'src/native/rewrap.rs', before: 'return columns * rows * 4 <= REWRAP_RASTER_BYTES;', after: 'return true;' }], native: true, test: 'a_view_taller_than_the_clip_cap_is_left_to_the_worker', failure: 'was not left to the worker' },
  { name: 'rewrap-lines-bound', file: 'src/native/rewrap.rs', before: 'if requested.count > REWRAP_LINES {', after: 'if false {', also: [{ file: 'src/native/rewrap.rs', before: '                lines: REWRAP_LINES,', after: '                lines: usize::MAX,' }], native: true, test: 'a_view_with_more_lines_than_the_allowance_is_left_to_the_worker', failure: 'was not left to the worker' },
  { name: 'rewrap-work-budget', file: 'src/shaped_text/pass.rs', before: '&& !limit.spend(line_work(document, row))', after: '&& !limit.spend(0)', native: true, test: 'lines_over_the_work_allowance_are_left_to_the_worker', failure: 'was not left to the worker' },
  { name: 'rewrap-tab-passes', file: 'src/shaped_text/pass.rs', before: '1 + passes_for(length)', after: '1', native: true, test: 'tabbed_lines_are_charged_for_their_corrective_passes_and_left_to_the_worker', failure: 'was not left to the worker' },
  { name: 'rewrap-raster-bound', file: 'src/native/rewrap.rs', before: 'return columns * rows * 4 <= REWRAP_RASTER_BYTES;', after: 'return true;', native: true, test: 'a_tile_with_a_huge_raster_is_left_to_the_worker', failure: 'was not left to the worker' },
  // Soft wrap keys: Home and End by visual row, Up and Down and paging by visual row, and the side of a wrap offset.
  { name: 'home-row-start', file: 'src/line_boundary.rs', before: 'return downstream(rows[row].start);', after: 'return downstream(line_start);', integration: 'wrap_keys', test: 'home_goes_to_the_row_start_then_the_first_non_blank', failure: 'inside the last row' },
  { name: 'home-continuation-start', file: 'src/line_boundary.rs', before: 'if head > rows[row].start {', after: 'if true {', integration: 'wrap_keys', test: 'home_goes_to_the_row_start_then_the_first_non_blank', failure: 'at a continuation row start: the first non-blank' },
  { name: 'home-first-row-toggle', file: 'src/line_boundary.rs', before: 'Some(indent) if indent < head => downstream(indent),', after: 'Some(indent) if false => downstream(indent),', integration: 'wrap_keys', test: 'home_goes_to_the_row_start_then_the_first_non_blank', failure: 'an end of the first row, past the first non-blank' },
  { name: 'end-trailing-blanks', file: 'src/line_boundary.rs', before: "if text.char(index) != ' ' && text.char(index) != '\\t' {", after: 'if true {', integration: 'wrap_keys', test: 'end_goes_to_the_row_end_then_the_line_end', failure: 'before the two trailing blanks of the first row' },
  { name: 'end-upper-row-side', file: 'src/line_boundary.rs', before: 'affinity: if row < last {', after: 'affinity: if false {', integration: 'wrap_keys', test: 'end_goes_to_the_row_end_then_the_line_end', failure: 'the end of the upper row is drawn on it' },
  { name: 'end-from-row-end', file: 'src/line_boundary.rs', before: 'if head == rows[row].end && row < last {', after: 'if false {', integration: 'wrap_keys', test: 'end_goes_to_the_row_end_then_the_line_end', failure: 'from the end of an upper row to the line end' },
  { name: 'end-blank-row-whole', file: 'src/line_boundary.rs', before: 'if rows.iter().skip(1).any(|other| return other.start == index) {', after: 'if false {', integration: 'wrap_keys', test: 'end_goes_to_the_row_end_then_the_line_end', failure: 'a row of blanks only keeps its whole end' },
  { name: 'vertical-wrapped-rows', file: 'src/vertical_motion.rs', before: 'let current = shaper.wrapped_row(document, line, scale, width);', after: 'let current = shaper.row(document, line, scale);', integration: 'wrap_keys', test: 'down_and_up_visit_every_visual_row', failure: 'Down 1' },
  { name: 'vertical-remembered-side', file: 'src/vertical_motion.rs', before: '        && column.affinity == affinity\n', after: '        && true\n', integration: 'wrap_keys', test: 'a_remembered_column_belongs_to_one_side_of_a_wrap_offset', failure: 'moved a caret at the end of the upper row' },
  { name: 'page-counts-rows', file: 'src/row_map.rs', before: 'if row >= self.rows_of(line) {', after: 'if true {', integration: 'wrap_rows', test: 'a_page_step_counts_visual_rows_with_the_blocks_above_their_first_rows', failure: 'the first row of line 3 carries its 26 px block' },
  { name: 'select-keeps-side', file: 'src/document.rs', before: '            affinity: position.affinity,\n        };', after: '            affinity: ReadingAffinity::Downstream,\n        };', integration: 'document', test: 'the_side_of_a_wrap_offset_is_kept_by_selection_and_by_a_reload_that_leaves_the_head', failure: 'a selection keeps the side it names' },
  { name: 'reload-resets-side', file: 'src/document.rs', before: 'if mapped.head != position.head {', after: 'if false {', integration: 'document', test: 'the_side_of_a_wrap_offset_is_kept_by_selection_and_by_a_reload_that_leaves_the_head', failure: 'a head that moved takes the default side' },
  { name: 'empty-tail-not-a-row', file: 'src/shaped_row.rs', before: 'return self.layout.len() - usize::from(self.has_empty_tail());', after: 'return self.layout.len();', integration: 'wrap_keys', test: 'a_hanging_blank_at_the_end_of_the_text_leaves_no_empty_row', failure: 'no counted row is empty' },
  { name: 'indent-scale', file: 'src/shaped_text.rs', before: 'let space = self.space_advance(request.scale) / request.scale;', after: 'let space = self.space_advance(request.scale);', integration: 'wrap', test: 'continuation_row_starts_at_the_indent', failure: 'scale 2: the continuation row starts at' },
  { name: 'rebreak-indent-scale', file: 'src/shaped_text/pass.rs', before: 'let space = self.space_advance(scale) / scale;', after: 'let space = self.space_advance(scale);', integration: 'wrap_rows', test: 'a_new_width_breaks_kept_rows_like_a_fresh_shaping_at_scale_two', failure: 'broken again like a fresh shaping' },
  // Soft wrap keys and pointer in the window.
  { name: 'key-end-follows-rows', file: 'src/native/input.rs', before: '        return Some(Edge::End);\n', after: '        return None;\n', native: true, test: 'home_and_end_follow_the_visual_rows', failure: 'End goes before the blanks that end the first row' },
  { name: 'page-by-visual-rows', file: 'src/native/input.rs', before: '(up as isize, down as isize)', after: '(up as isize, 1)', native: true, test: 'page_keys_move_by_visual_rows_and_keep_the_caret_in_view', failure: 'moves the caret by' },
  { name: 'word-keys-by-offset', file: 'src/native/input.rs', before: 'modified = Some(Motion::WordRight);', after: 'modified = Some(Motion::Right);', native: true, test: 'word_motion_crosses_a_wrap_offset_by_document_offset', failure: 'Ctrl+Right from' },
  { name: 'click-keeps-side', file: 'src/native/input.rs', before: '        position.affinity = if position.head == hit {\n            side\n        } else {', after: '        position.affinity = if false {\n            side\n        } else {', native: true, test: 'a_click_at_a_wrap_offset_keeps_the_side_that_was_clicked', failure: "right of the upper row's last glyph the caret is on the upper row" },
  { name: 'click-counts-visual-rows', file: 'src/native/input.rs', before: 'let row = line + current.row_map.line_rows().extra_before(line) + visual;', after: 'let row = line;', native: true, test: 'quick_presses_on_two_rows_of_one_line_are_not_a_double_click', failure: 'a second press on the next row of the line is a single click' },
  { name: 'drag-visual-row', file: 'src/native/input.rs', before: 'let hit = candidate.hit_at(x, within, view.viewport.scale);', after: 'let hit = candidate.hit_at(x, 0.0, view.viewport.scale);', native: true, test: 'a_drag_selects_across_visual_rows', failure: 'the drag reaches the third row' },
  { name: 'triple-click-whole-line', file: 'src/pointer_selection.rs', before: 'return line_range(text, position);', after: 'return word_range(text, position);', native: true, test: 'double_and_triple_clicks_work_on_wrapped_lines', failure: 'the triple click takes the whole line' },
  { name: 'view-follows-visual-row', file: 'src/native/viewport.rs', before: 'return row.caret_at(position, affinity, view.viewport.scale).row;', after: 'return 0;', native: true, test: 'the_view_follows_the_caret_through_every_visual_row', failure: 'left the caret row out of view' },
  { name: 'reveal-measures-its-line', file: 'src/native/viewport.rs', before: '    if down > 0 && has_wrap_width(current.width) {', after: '    if false {', native: true, test: 'revealing_a_late_row_of_an_unmeasured_last_line_puts_it_in_view', failure: 'the revealed range is outside the view' },
  // Minimap: the viewport box follows the scroll, a press centers its row, a drag scrolls with the box, and the wheel
  // over it reaches the view.
  { name: 'minimap-box-share', file: 'ui/app.slint', before: '* clamp(-scroll.content-y / root.minimap-range, 0, 1)', after: '* 0', native: true, test: 'the_box_matches_the_geometry_at_every_offset', failure: 'box top' },
  { name: 'minimap-drag-ratio', file: 'src/minimap/geometry.rs', before: 'return (start_offset + (y - start_y) * range / room).clamp(0.0, range);', after: 'return (start_offset + (y - start_y)).clamp(0.0, range);', integration: 'minimap', test: 'dragging_the_box_moves_it_with_the_pointer', failure: 'put the box at' },
  { name: 'minimap-position-clamp', file: 'src/minimap/geometry.rs', before: 'return (y.clamp(0.0, track) / self.scale()).min(self.content);', after: 'return (y / self.scale()).min(self.content);', integration: 'minimap', test: 'positions_outside_the_range_are_clamped_at_both_ends', failure: equality },
  { name: 'minimap-work-budget', file: 'src/minimap/raster.rs', before: '        if work > self.left {', after: '        if false {', integration: 'minimap', test: 'a_line_the_budget_cannot_pay_is_cut_into_equal_rows', failure: equality },
  { name: 'minimap-press-centers', file: 'src/native/minimap.rs', before: '.centered(top + CODE_ROW / 2.0)', after: '.centered(top)', native: true, test: 'a_press_outside_the_box_jumps_to_the_row_and_the_keyboard_still_works', failure: 'the pressed row is centered' },
  { name: 'minimap-press-caret', file: 'src/native/minimap.rs', before: '    current.document.select(position);\n', after: '', native: true, test: 'a_press_outside_the_box_jumps_to_the_row_and_the_keyboard_still_works', failure: 'the caret is on the pressed row' },
  { name: 'minimap-shift-anchor', file: 'src/native/minimap.rs', before: '    if !shift {\n        position.anchor = hit;\n    }\n', after: '    position.anchor = hit;\n', native: true, test: 'a_press_outside_the_box_jumps_to_the_row_and_the_keyboard_still_works', failure: 'a Shift press keeps the anchor' },
  { name: 'minimap-drag-scrolls', file: 'src/native/minimap.rs', before: '        scroll_to(&active, &drag_state, offset);\n', after: '        let _ = offset;\n', native: true, test: 'dragging_the_box_scrolls_continuously_and_release_ends_it', failure: 'step 1' },
  { name: 'minimap-release-ends-drag', file: 'src/native/minimap.rs', before: '        release_state.borrow_mut().minimap.drag = None;\n', after: '        let _ = &release_state;\n', native: true, test: 'dragging_the_box_scrolls_continuously_and_release_ends_it', failure: 'after the release the pointer moves nothing' },
  { name: 'minimap-wheel-reaches-view', file: 'ui/minimap.slint', before: '        moved => {\n            if !self.pressed { return; }\n            root.drag(self.mouse-y);\n        }\n', after: '        moved => {\n            if !self.pressed { return; }\n            root.drag(self.mouse-y);\n        }\n        scroll-event(event) => { return EventResult.accept; }\n', native: true, test: 'the_wheel_over_the_minimap_scrolls_like_the_wheel_over_the_text', failure: 'the wheel over the minimap scrolled by the same amount' },
  // Minimap worker boundary: the picture is valid for the text and never for the scroll offset, it is built on the
  // worker, and a stale picture is never shown.
  { name: 'minimap-key-has-no-scroll', file: 'src/native/minimap.rs', before: 'size: (width.to_bits(), height.to_bits()),', after: 'size: (width.to_bits(), (height + current.offset).to_bits()),', native: true, test: 'scrolling_posts_no_request_and_sets_no_picture', failure: 'a scroll posted a minimap request' },
  { name: 'minimap-built-on-worker', file: 'src/native/minimap_build.rs', before: '.name(THREAD_NAME.to_string())', after: '.name("window".to_string())', native: true, test: 'the_picture_is_built_on_the_worker_and_stays_inside_its_bounds', failure: 'a picture was built off the worker' },
  { name: 'minimap-stale-text', file: 'src/native/minimap.rs', before: '&& reply.key.stamp == displayed(&current);', after: '&& true;', native: true, test: 'a_stale_picture_is_dropped_and_a_current_one_is_shown', failure: 'a stale picture was set' },
  { name: 'minimap-older-request', file: 'src/native/minimap.rs', before: 'let fresh = reply.id >= current.minimap.shown_id &&', after: 'let fresh = true &&', native: true, test: 'a_stale_picture_is_dropped_and_a_current_one_is_shown', failure: 'a stale picture was set' },
];
// An optional comma-separated list reruns only the named guards, for example after adding one.
const only = process.env.usage_only ? new Set(process.env.usage_only.split(',')) : undefined;
const selected = only ? cases.filter(item => only.has(item.name)) : cases;
if (only && selected.length !== only.size) throw new Error('Unknown guard name in: ' + process.env.usage_only);
const results = [];
const baselined = new Set();
const run = (item, phase) => {
  // A case names a native test, a unit test of the library (`lib`), or an integration test file.
  let command = ['cargo', 'test', '--offline', '--no-default-features', '--test', item.integration, item.test, '--', '--nocapture'];
  if (item.native) command = ['cargo', 'nextest', 'run', '--offline', '--features', 'slint/mcp', '--bin', 'monochromatic-ide', '--filter-expr', 'test(' + item.test + ')'];
  if (item.lib) command = ['cargo', 'test', '--offline', '--no-default-features', '--lib', item.test, '--', '--nocapture'];
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
  // A guard whose rule is enforced at two places names the second place in `also`, and both are removed together.
  const edits = [item, ...(item.also ?? [])].map(edit => ({ path: join(source, edit.file), original: readFileSync(join(source, edit.file), 'utf8'), edit }));
  try {
    for (const { path, edit } of edits) {
      const current = readFileSync(path, 'utf8');
      const changed = replaceOne(current, edit.before, edit.after, edit.occurrence);
      if (changed === current) throw new Error('Mutation did not change ' + edit.file);
      writeFileSync(path, changed);
    }
    run(item, 'removed');
  } finally { for (const { path, original } of edits) writeFileSync(path, original); }
  run(item, 'restored');
}
console.log('Source guard controls passed: ' + artifact + ' (' + selected.length + ' of ' + cases.length + ' guards)');
