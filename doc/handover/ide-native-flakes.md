# Native suite flakes: state after the second flake session

The branch is `worktree-agent-a5d7faec36a652c16`,
package `package/desktop-app/ide`.
No test runs under retries,
and `.config/nextest.toml` of the package is unchanged.
The owner rule of 2026-10-20 (recorded in `doc/handover/slint-ide-0x.md`) holds:
"proven unfixably flaky" is a very high bar,
and a retry override needs a report that lists every alternative tried or ruled out with evidence.
No test met that bar,
so there is no override.

## The stress tool

Run it with `mise run //package/desktop-app/ide:test:native:stress --filter '<nextest expression>' --count N --copies K --threads T`.
The tool builds once in a container with the normal build bound.
It then runs the filtered tests inside a second GPU container limited to 2 CPUs and 2 GiB,
and prints failures per test.
The tests contend with each other inside that cap;
the tool starts no host load.
Its logs are under `~/temp/agent/stress-*`.

What the settings measure (observed in this session):

- A filter that selects one test,
  with `--copies 3 --threads 2`,
  runs about three test processes at once on the 2 CPUs.
  That is little contention:
  `rows_arriving_in_view_move_only_lines_beneath_them` passed 300 of 300 that way
  in 39 s.
- `--copies 8 --threads 1` raised the contention (800 runs of the same test in 104 s,
  video memory peak 6.75 GiB)
  and still passed 800 of 800.
- The failures this suite had were seen under a host load of 10 to 12 CPUs on the first version of the tool,
  which is banned (rule `NLG`).
  A rate seen there cannot be re-measured with the permitted tool,
  which is why deterministic controls
  (a chosen hold time,
  an injected state) are used below where the cause is known.
- The build container uses 75 percent of the host's CPUs unless `IDE_CONTAINER_CPUS` is set;
  this session set it to 8 for every build and every task run.

## Fixed in this session

### Find box context menu (`query_input_tests::find_box_context_menu_runs_each_entry`)

Cause,
found by reading the toolkit source and confirmed by a control:

1.  The find bar sits at the bottom of the 660 px window.
   The test right-clicked at `find_clear_x - 60` and `find_clear_y + 24` (y = 632,
   x = 951 or 964).
   `place_popup` (`window/popup.rs` of `i-slint-core` 1.18.1) clamps the menu into the window,
   so the menu is pushed up and left,
   and the pointer rests on one of its entries
   (which entry was not measured).
2.  A menu entry runs on a pointer release when 300 ms have passed since the entry was created
   (`widgets/common/menu-base.slint` of `i-slint-compiler` 1.18.1,
   the `up` branch of `pointer-event`:
   `animation-tick() - root.open-time > 300ms`,
   inside the entry's rectangle).
3.  `process_mouse_input` (`window.rs` of `i-slint-core`) refreshes the animation clock from the real clock
   on every pointer event,
   so the 300 ms are real time between the right press and the right release.
   Under host load the test thread was descheduled for that long,
   the release ran the entry under the pointer,
   and the entry closed the menu.
   The keys then went to the find box:
   Return stepped the find match (status "2/2"),
   and a typed character was appended ("needlex" against "x",
   the older message).

The earlier reading,
a release that closes the popup by a second Slint path,
was wrong:
the popup counts "before the press 0,
after it 1,
after the release 0" are exactly this path.

Fix (commit `39065b2c14`):
the test right-clicks at the left part of the text area,
`sidebar width + divider + 36 px`.
The clamp leaves the menu's x at the pointer's x there,
so the pointer rests on the menu's frame,
outside every entry.
The helper `open_menu` takes a hold time between press and release.
The new test `a_slow_right_click_leaves_the_find_menu_open` holds 400 ms.

Guard proof (GFP) and counts,
4 copies x 150 iterations on the 2-CPU tool,
one thread per copy:

- Old click position,
  hold 400 ms:
  600 of 600 failed,
  with the natural signature
  ("popups before the press 0,
  after it 1,
  after the release 0,
  after settling 0;
  find status 1/2").
- Old click position,
  `find_box_context_menu_runs_each_entry` itself:
  0 of 600 failed.
  The natural rate on the permitted tool is below that;
  the heavy-load rates were 2 of 240 and 5 of 480.
- New click position:
  hold test 0 of 600 failed,
  the original test 0 of 600 failed.

The deterministic hold stands in for the load-dependent rate;
the 2 of 240 and 5 of 480 are not re-measurable.

### Highlighting-reply wait in the other fixtures that open files

`wait_for_highlighting` in `src/native/find_tests.rs` (extracted from `reader()`) is now also called by
`watch_tests::open`,
`refresh_latency_tests::measure`,
the first fixture of `navigation_tests`,
and `language/test_support.rs` (`reader_with`).
The second `navigation_tests` fixture (`native_failed_open_keeps_source_and_does_not_promote_history`)
opens no file at start (`State::new("", None)`),
so there is no reply to wait for and it is unchanged.
`minimap_tests::open` and `wrap_tests::open` go through `reader()` and already waited.

This removes an exposure;
no failure of those fixtures was ever measured,
so there is no before count.
After:
42 tests of `watch_tests`,
`navigation_tests` and `native::language`,
3 copies x 8 iterations,
0 failures
(the only guard of the wait is `a_reader_is_opened_with_its_highlighting_applied`,
which covers `reader()`).

### Frames kept by every stability comparison

`kept_if_different` in `annotation_stability_tests.rs` writes both frames to `target/flake-frames/`
for every frame comparison of that file that fails (before,
only `moved` and the rigid scroll did).

## Open, not reproduced

### Annotation stability tests

The recorded failure (log `stress-lV2AMP/copy-7.log`,
heavy-load tool,
480-run hunt):
`rows_arriving_in_view_move_only_lines_beneath_them`,
"line 1 changed its pixels in row 8 of its code row
(window rows 64 and 64);
4 of 696 texels differ,
by 104 levels at most,
the first at index 1 (146 against 250)";
facts before:
`renders 4 tiles_rendered 1`,
after:
`renders 5 tiles_rendered 2`.
So the window frames straddle one tile re-render,
and 4 texels at the start of the compared part of the row
(which begins at the line's number) differ by more than the measured render noise of one level.
The rigid scroll failure of the same hunt:
31 rows differ from row 101 to 511,
largest channel difference 198.

Tried this session,
with the permitted tool:

- With the highlighting-reply wait:
  `rows_arriving_in_view...` 1,145 passed of 1,145 (45 + 300 + 800 runs);
  `scrolling_across_annotated_lines_is_rigid` 165 of 165 (45 + 120);
  the other four tests of the file 45 of 45 each.
- With the wait disabled in a disposable edit (so the late reply can re-render):
  every test of the file 90 of 90.
  So the late reply is not shown to cause these failures,
  and its removal did not make them reproducible.
- The tile render itself is stable:
  `repeated_renders_of_one_tile_spread` passed 400 of 400 runs
  (16,000 renders),
  none above one level.
  The window frame (Slint's own text and gutter) is not covered by that probe.

Not reproducible with the permitted tool,
and the cause is not found.
The next failure now keeps its frames (`target/flake-frames/*-first.ppm` and `-second.ppm`),
and the message names the texels and the facts of both moments.
Next step when a failure exists:
open both frames,
find the 4 texels,
and decide between a sub-pixel glyph shift
of the gutter number and a renderer outlier.
This stays an open,
instrumented flake and is not retried.

### Not reproduced, no instrumentation added

`write_wait_tests` (one failure in 19 parallel runs of an earlier head,
in `doc/planning/ide-gpu-snapshot-harness.md`),
the two `watch_tests` with 400 ms budgets (failed together once in the same 19),
`wrap_tests::rows_above_the_view_changing_height_move_no_visible_pixel`,
and the nine-level pixel difference of `rows_above_the_view_wait_until_scrolling_has_stopped`
(0 of 135 in this session:
45 with the wait and 90 without).
The 400 ms budgets state how soon the product must follow a file change,
so a longer budget would weaken them;
no change was made without a reproduction.

### Environmental

A full disk (`No space left on device`) in `opening_fifty_thousand_lines_never_blocks_the_window_thread`
and a wgpu `vello.scene` buffer validation error in `the_extent_settles_as_chunks_arrive` were seen once each.
Video memory sits at the card's limit in full runs (next section),
which is one candidate for the second;
unproven.

## Test thread count against video memory

The card reports 7.98 GiB.
One reading with no run of mine active:
0.5 GiB (a desktop session and other agents share the card).
Peaks the stress tool sampled in this session (all programs on the card):
5.57 GiB with about 3 test processes,
6.75 GiB with 8,
and 7.3 to 7.5 GiB with 6 of the mixed annotation tests.
Use per process varies with the window size of the test,
so the count alone does not predict the peak.
Not measured:
a full default run (21 threads on this host) against a capped run,
because that needs a second
full run of one snapshot,
which the rules forbid.
No failure in this session is attributed to video memory,
so no default was changed.
The override exists already:
`IDE_CONTAINER_TEST_THREADS` (`bin/container-bounds.ts`).
A cap should be proposed only with a failure it removes;
the `vello.scene` error above is the only candidate.

## Gates on the final tip

Run once each on the final code tip (the documents after it change no code):
`lint` passes (rustfmt diffs fixed with `format:rust`,
semantic-line-break findings fixed),
`test:native -- 'all()'` 275 passed and 5 skipped with no FLAKY or FAIL line (177 s),
`test` 797 passed and 1 skipped,
`test:bin` 60 passed,
`build` finished the release profile,
`inspect:no-software-renderer` reports the software renderer is not linked.
`inspect:source-guards` was not run:
no guard was edited (the guards patch product sources;
none names a file this
work changed except `bin/inspect-refresh-latency.mjs`,
a measurement and not a guard).

## Flaky test ledger

Zero tests are under retries.
Counts are failures over runs;
"heavy" means the banned host-load version of the tool or parallel full runs
under a shared host,
"tool" means the permitted 2-CPU tool.
History sources:
`doc/planning/ide-gpu-snapshot-harness.md` ("Flakes after the merge"),
`doc/handover/slint-ide-0x.md`,
and the entries above.

- `query_input_tests::find_box_context_menu_runs_each_entry`.
  Cause:
  release over a menu entry more than 300 ms after the menu opened.
  Fix:
  `39065b2c14` (click position).
  Before:
  2 of 240 and 5 of 480 heavy,
  once in full runs (README Minimap section,
  "needlex" message).
  After:
  0 of 600 tool,
  with the deterministic control 600 of 600 before and 0 of 600 after.
- `native::annotation_stability_tests` (`a_reload_holds_row_space_until_annotations_return`,
  `moved` users).
  Cause:
  Vello re-renders are not bit-identical (one level,
  rounding ties in the coverage sum).
  Fix:
  `same_pixels` with `RENDER_NOISE` of one level where a frame follows a re-render
  (2026-10-20,
  agent `a717e60922dca0448`);
  guard proof in the planning document.
  Before:
  9 of 70 full runs on `main` at the merge across four causes;
  after:
  15 of 15 and 5 of 5 full runs.
- `minimap_reflection_tests::the_minimap_of_find_matches_is_the_average_of_the_windows_pixels`.
  Cause:
  Enter pressed after the first match was already selected.
  Fix:
  the test presses no Enter.
  Before:
  5 to 7 of 72 at 16 busy loops;
  after:
  0 of 72.
- `refused_tile_tests::a_failed_worker_tile_frees_its_job_and_the_next_placement_gets_its_tile`.
  Cause:
  the test polled for an error message that the retry render cleared within 0.2 ms.
  Fix:
  failures kept in debug builds,
  the test waits for the first one.
  Before:
  4 of about 410 runs hung;
  after:
  no recurrence in the later runs.
- `wrap_tests::a_resize_breaks_kept_rows_again_without_shaping`.
  Cause:
  the test counted passes while the syntax reply could still arrive.
  Fix:
  the test waits for the reply.
  Before:
  3 of about 410;
  after:
  no recurrence in the later runs.
- `wrap_clip_tests::revealing_a_late_row_of_an_unmeasured_last_line_puts_it_in_view`.
  Cause (product):
  `TileWorker::take_pass` closed a pass on the finishing output of a replaced pass.
  Fix:
  `8627edeeba`.
  Before:
  about 1 of 100 at one CPU;
  after:
  0 of 1500 (the fix author),
  and 400 of 400 stress runs (the coordinator).
- Two find tests (the paint test among them).
  Cause:
  waits that did not require the active match to spell the whole query.
  Fix:
  `4ab83c59e`.
  Before:
  failed in gate runs;
  after:
  the rerun passed.
- The scroll quiet-time test and the find reveal test.
  Cause:
  a clock the test could not hold;
  a line the test measured too late.
  Fix:
  recorded in `doc/handover/slint-ide-0x.md` ("Both flaky tests of the guard runs were fixed").
  Before:
  3 of 16 at baseline for find reveal.
  After:
  no recurrence recorded.
- `the_view_follows_the_caret_through_every_visual_row`.
  Cause (package `README.md`):
  the test read the row map before the measurement had finished shrinking it.
  Before:
  3 of 23 on the minimap branch and 1 of 10 on `main`.
  Fix and after-count:
  not verified in this session;
  the test passed in the one full run of this tip.
- `tall_window_minimap_tests`.
  Cause:
  the fixture read the minimap picture of the window before it was resized.
  Fix:
  `87d02a02d8` (the fixture waits for a picture taller than 1000 rows).
  Before:
  once in a loaded full run,
  6 of 6 alone;
  after:
  no recurrence recorded.
- The refused-tile test of the first flake session.
  Cause:
  its assertion ran after a legitimate later request of the wanted tile (the late reply).
  Fix:
  the direct test in `tile.rs`,
  an integration test that waits for the end state,
  and the reader wait.
  Before:
  10 of 360;
  after:
  0 of 360.
- The wrap clip test with an extra render,
  and every `reader()` fixture.
  Cause:
  the highlighting reply arriving after the first frame.
  Fix:
  `wait_for_highlighting` (reader),
  `a_reader_is_opened_with_its_highlighting_applied` guards it.
  Before:
  28 of 160 probes had the reply missing,
  wrap clip 3 of 240;
  after:
  0 of 160 and 0 of 240.
- `minimap_tests::an_external_edit_of_fifty_thousand_lines_renders_only_the_band_it_touches` (CPU minimap).
  Cause:
  probably the late reply (unproven).
  Fix:
  the test and its subsystem were deleted.
  Before:
  13 of 120.
  The successor `an_external_edit_of_fifty_thousand_lines_shapes_only_the_line_it_touches` passed 120 of 120
  with the wait and 90 of 90 without it (no baseline failure to compare with).
- Open:
  the annotation stability tests above (one failure each of `rows_arriving_in_view...` and
  `scrolling_across_annotated_lines_is_rigid` in 480 heavy runs;
  0 failures in 1,310 tool runs of the two).
- Open and not reproduced:
  `write_wait_tests`,
  the two `watch_tests`,
  and the nine-level pixel difference.

## What was not run

- A repeat of any full `test:native`:
  one per snapshot,
  as the rules require.
- A comparison of a capped and an uncapped full run for video memory.
- The guard runners (`inspect:*-guards`),
  because no guard changed.
- Any run with host load:
  the tool is the only repeated-run mechanism.
- The annotation tests under the heavy-load conditions that showed their failures.

## Next steps

1.  When an annotation stability test fails again,
    read `target/flake-frames/` of that run before changing anything.
2.  If a `vello.scene` error recurs,
    propose a thread cap with that failure as the evidence.
3.  Re-run the stress tool for the menu tests after any change of the find bar layout:
   the click position depends on the sidebar width and the find box padding.
