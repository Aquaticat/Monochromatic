# IDE GPU migration, stages 5 and 6: state at the stop

Branch `worktree-agent-a0880539282a3162b`, base `63991e9923`.
Work was stopped on the coordinator's request so the machine could be rebooted.
Measurements and design are in `doc/planning/ide-gpu-snapshot-harness.md`, section "Stages 5 and 6".

## Done

- The minimap is a Vello scene drawn by the code view's one renderer, in chunks of at most 512 rows,
  copied into a slice texture; the CPU painting code and the `swash` dependency are deleted.
- All 45 `minimap-*` source guards fail when removed and pass restored (disposable copy).
- A missing redraw request after a slice was found by screenshots and fixed (`src/native/minimap/picture.rs`).
- README of the package and `doc/planning/ide-vello-text.md` describe the new minimap.

## Gates

- Passed on the snapshot before the last two test commits: `lint` (0 findings), `test` (790),
  `test:minimap`, `test:annotations`, `test:bin`, `build`, `inspect:software-renderer`.
- `test:native`: passed 265 of 265 on one snapshot; failed once on that snapshot's predecessor
  (`an_external_edit_of_fifty_thousand_lines_shapes_only_the_line_it_touches`).
- Never ran on the final tip: `lint`, `test:native`, `test`, `test:bin`, `build`, `inspect:software-renderer`
  (the run was stopped).
- The owner's rule: one gate run per committed snapshot, no repeated full-suite batches, no load generation.

## Not done

- The final-tip gates above.
- Chunk seam check in a screenshot and a window taller than the compositor's 3,704 px.
- A quiet-host cadence run of `big.rs` after the redraw fix.
- The external edit test is a timing test that failed in about 4 of 32 full runs before its last fix
  (lines that never wrap); that fix passed alone 4 of 4 and is not proven in full runs.

## Next steps

1. `mise run //package/desktop-app/ide:lint`, then `test:native` once, then `test`, `test:bin`, `build`,
   `inspect:software-renderer`.
2. If the external edit test fails again, read the `EDIT before ... after ...` line it prints
   (picture window and statistics before and after the edit).
3. Look at a 4x crop of a chunk boundary in a window of about 3,700 px.
4. Owner questions are listed at the end of the "Stages 5 and 6" section.
5. The baseline worktree `.claude/worktrees/ide-gpu56-baseline` (detached at `origin/main` `625bcecb61`) can be removed
   with `git worktree remove` after the cadence comparison is no longer wanted.

## Stacked textures

Owner decision of 2026-10-21: a window taller than the device's texture limit stacks several textures,
so the minimap covers the whole window.
Built on branch `worktree-agent-a4d54af4e63faea6b` (off `a7f8523f0c`).

### What changed

- `src/minimap/plan.rs`: `texture_rows` (the most rows of one texture: the device's side, or fewer when its bytes
  would pass the 64 MiB rule of the source tile) and `texture_runs` (groups the chunks of a picture into textures of
  whole chunks, none taller than that).
- `src/native/minimap/request.rs`: the key no longer caps the bands at one texture (`most_bands` is kept and tested,
  and no longer used where the key is made); the key now holds the texture limit, so a changed limit posts a picture.
- `src/native/gpu_tile/slice.rs` (`draw_stack`), `gpu_tile.rs`, `gpu_tile/types.rs`: the picture is rendered chunk by
  chunk and copied on the GPU into as many textures as `texture_runs` names, each with its own `Image`;
  `Picture::Minimap` is gone from the single-texture targets.
  A recorded limit below one chunk (512 rows), as a test may set, gives one chunk per texture;
  a device whose own side is below one chunk is refused with the existing "does not fit a texture" message.
- `ui/minimap.slint`, `ui/app.slint`: `minimap-image` is replaced by a `[MinimapSlice]` model (image, first row,
  height, all in physical pixels) drawn by a `for` loop at whole-pixel rows, so the textures abut without a gap.
  `minimap-picture-width`, `-height` (now the textures together) and `-top` are kept for the tests and pointer code.
- Tests: `tall_window_minimap_tests.rs`, `minimap_seam_tests.rs` (new), `tests/minimap_scene.rs`.
  The old test `a_picture_taller_than_the_device_limit_is_cut_to_the_limit` asserted the defect
  and became `a_picture_taller_than_the_device_limit_covers_the_whole_track`.
  `the_minimap_of_a_tall_window_is_a_picture_of_glyphs_not_blocks` now bounds each texture by the limit
  instead of the whole picture.

### Evidence

- Failing before the fix (commit `10fb0e26ef`, filter `test(/tall_window_minimap/)`):
  `the picture is 8064 rows of a track of 11968`.
  The 12,000 px window over the harness device capped to 8,192 gave one texture that ended at row 8064.
- Passing after (commit `27c8877907`): the same test passes with two textures that are each at most 8,192 rows,
  together as tall as the track, with no error and no blank chunk.
- Seam and three or more textures, `textures_that_stack_show_the_picture_one_texture_shows`:
  the picture of a 3,500 px window (one texture) is drawn again at a texture limit of 1,536 (three textures),
  1,024 (four) and 512 (seven).
  Every texel read back from the stack equals the texel of the one texture to within the renderer's noise of one level,
  the rows on both sides of each seam are inked,
  and the window's own frame, read whole, shows the same column of minimap pixels.
  Positive controls: the stack shifted by one row is not equal, in the textures and in the frame.
- The guard fails when broken (rule GFP, committed test, fault applied to `slice.rs`, then restored):
  a placement of every texture after the first one row too low fails on
  `the composited column differs at limit 1536`;
  a copy of the chunks one row early inside a texture fails on
  `the stack of 3 textures differs from the one texture at limit 1536`.
  A first version of the frame check read only the 660 rows of the harness frame and a one-row placement fault
  passed it; the harness frame is as big as the size the adapter was told (`Window::set_size`), not the size a
  resize event gives, and the test now sets it (commit `d2c7e4aa5c`).
- `minimap_seam_tests.rs`: the chunks of a picture of about 1,500 rows (three chunks, two seams), stacked,
  equal one unsplit render of the same rows at scales 1 and 1.5.
  Positive control at scale 1.5, where a seam falls through a line:
  chunks that keep only the items inside their rows differ from the unsplit render.
  At scale 1 a 512 row seam is a code row edge and the control would lose nothing, so it is not asserted there.
- Unit tests of the grouping in `tests/minimap_scene.rs`: limits that are and are not multiples of a chunk, a limit
  of exactly one chunk, one under a chunk, an empty picture, and the byte rule for a wide picture.

### Not exercised

- A device whose texture limit is above 8,192 (16,384 is common) or below it: the harness device is capped to 8,192,
  and three or more textures were made by lowering the recorded limit (`set_texture_dimension`) after the first frame,
  not by a window of 17,000 px or more.
- A composited frame at a fractional display scale or at scale 2 with a stack of textures:
  the placement is whole physical pixels by construction, but only scale 1 was read back.
- The cost of a very tall window: a 12,000 px window renders about 24 chunks in the frame the picture arrives in,
  on the window thread, as the cut picture rendered about 16 before.
  Its frame time was not measured.
- The densest text (`minimap_dense_tests.rs`) was not stacked.
- No look at the minimap of a tall window in a real or nested compositor window.
- The recorded limit is read when a picture is requested and when it is drawn;
  a device change at run time (a new device with another limit) is posted again through the key,
  but a window that moves to another GPU was not tried.

### The scroll hitch the first version of the stack caused

The orchestrating session's cadence A/B (release, 1100 by 660, 50,000 line `big.rs`, scroll scenario, recorder at 60 Hz)
showed one identical (missed) recorded frame at slot 35
in 11 of 13 runs of the stacked tree and in 6 of 27 of the baseline.

#### Cause

- A picture of the first stacked version replaced the list of textures that the markup draws
  (`set_minimap_slices` with a new `VecModel`) every time one arrived, for a picture of the same shape as well.
  The markup's `for` loop then dropped and made every `Image` item again inside the frame of a scroll step.
  The old code set one `Image` once and later only changed numbers.
- The window thread cost does not show it: the frame that takes in a picture lasts 5 to 8 ms in the stacked tree and in
  the baseline alike, and the frames after it 2.4 to 3.5 ms in both, so the loss is outside the window thread's own work
  (the toolkit's image items, the compositor), and it was not located further.
- Intervention, not inference: the same release binary with only this change (commit `3247690ff8`, `show_slices` in
  `src/native/gpu_tile/types.rs`) brings the count down to the baseline's.
- Not the cause: the request cadence (ids and posts are the same in both trees over the first 2 s, 50 ms after the
  scroll starts for the first one), the texture limit in the key (no re-post), the grouping (one texture here),
  and a new texture or `Image` per picture (the textures are reused while their sizes stay).

#### Counts (identical recorded frames out of 119 in the input window, one run each)

Runs whose highlighting failed (`syntax parse failed ... configured timeout was exceeded`, an error banner of 30 px
shows and the first picture request comes at 183 ms instead of 50 ms, so the hitch moves from slot 35 to slot 43) are
counted apart: they are a load-dependent change of the fixture, not of the tree.
The coordinator's earlier counts include such runs on both sides.

- Question 1, baseline (`origin/main`) against the first stacked tip, 6 pairs interleaved:
  baseline 0 of 6 runs with an identical frame;
  stacked 6 of 6 (4 of the 4 whose highlighting worked, at slot 35 in all four; the two that failed highlighting at 43).
- Question 2, baseline against the fix, 10 pairs interleaved:
  baseline, highlighting worked in 9 runs: 2 with an identical frame (slot 35 once, slot 99 once);
  fix, highlighting worked in 8 runs: 2 with an identical frame (slots 67 and 130, and 67; none at 35).
  The floor is the baseline's own rate, 2 of 9 runs (no run of the baseline against itself was made).
  The longest identical run is 1 in every run.
- The extra frame that the baseline has too: `picture.rs` asks for a redraw when it hands a picture to the GPU,
  so a frame lands between two scroll steps; it is on `origin/main` and was not changed
  (single instrumented runs of the baseline with highlighting show the same timeline as the stack: request at 50 ms,
  picture at 70 ms, a 5.5 ms frame, then a hitch at slot 35 in that run).

#### Guard

`a_picture_of_the_same_shape_changes_the_rows_of_the_list_and_never_replaces_it` counts the lists the window is given
(`SLICE_LISTS_SET`) across a picture of the same bands, forced by a resize of one pixel.
It failed while every picture made a new list (commit `ee59d9630f`, `the window was given a new list of textures`)
and passes with the fix.
The source guard `minimap-slices-in-place` removes the fix in a disposable copy.

#### Not done here

- The remaining recorded identical frames in both trees (slot 35 once, slots 67, 99, 130) were not explained;
  the baseline has them too, at the same rate as the fix.
- The cadence was measured with the nested compositor only, on a host that other sessions load;
  the pressure stall values are in `~/temp/agent/a4d5-q1.jsonl` and `a4d5-q2.jsonl`.

#### Gates of the fix

Run once each on tip `105686effa`:
`lint` 0 findings; `test:native` 274 passed, 5 skipped; `test` 797 passed, 1 skipped; `test:bin` 60 passed;
`build` finished; `inspect:software-renderer` not linked, as before.
`inspect:source-guards` for `minimap-slices-in-place` only (1 of 148 guards): baseline passes, removed fails with
`the window was given a new list of textures`, restored passes.

### Gates of the stacked textures

Run once each, in this order, on tip `89924c2a12` (the tree that this section's commit follows):

- `lint`: 0 findings (clippy, rustfmt, monochromatic-lint including the README and the Rust doc comments, slint).
  Earlier runs on the way found shadowed bindings, avoidable closures, a file past the 300 line limit
  (the test-only readers moved to `src/native/gpu_tile/probe.rs`), and semantic line breaks; all fixed.
- `test:native`: 273 passed, 5 skipped (not selected by the task), 0 failed.
- `test`: 797 passed, 1 skipped, 0 failed.
- `test:bin`: 60 passed, 0 failed.
- `build` (release): finished.
- `inspect:software-renderer`: the software renderer is not linked, and both positive controls reach it.

Not run: `inspect:source-guards` (it builds disposable copies of the package for every guard).
Its entries for the minimap were updated by hand:
`minimap-bands-fit-the-device` became `minimap-bands-uncapped`,
`minimap-chunk-copy-row` follows the new test and indentation,
and `minimap-texture-limit-key`, `minimap-texture-runs` and `minimap-texture-top` are new.
None of the five was executed, so each is unproven until that task runs.
The two faults tried by hand (see Evidence) are the same as `minimap-texture-top`
and a variant of `minimap-chunk-copy-row`.

## The extra frame at a picture hand-over

Session of 2026-10-21 on branch `worktree-agent-a3a543d4c80040d25`, base `e2f7ee81f2`.
It answers the open item of "The scroll hitch the first version of the stack caused":
why one scripted-scroll frame is a missed frame at slots 35, 67, 99 or 130 in both trees,
a period of about 32 slots.

### Cause

- `src/native/minimap/picture.rs` called `request_redraw()` the moment it handed a picture to the GPU.
  In a scroll the window already draws a frame at every wheel step, and the GPU draws a waiting picture inside the next
  frame, so the request added a second frame between two steps.
- The period is the picture cadence, not a beat with the recorder.
  In the instrumented run `ide-cadence-RjmA8F` the hand-overs fall at slots 34, 66, 94, 98, 125, 129, 156 and 160,
  and the stall follows the first one at slot 35.
  Not every hand-over stalls (that run stalls after 34 only); where in the tick the extra frame lands decides it.
- What the second frame does in the recording, measured with the nested compositor's recorder
  (it captures at each tick and sends the frame callbacks right after;
  `package/cli/nested-wayland-session/src/recorder.rs`):
  the text area does not move for one tick (a shift of 0 px where every other tick shifts 25 px),
  and the later ticks go on shifting 25 px, never 50.
  The window log of the same run shows one wheel event per tick, and at the hand-over a
  "set a minimap picture" line, a "winit asked for a redraw" in the same millisecond, and a 5.4 ms frame that no wheel
  event started.
- Why the compositor shows the next scroll frame one tick later is a reading, not a measurement:
  the extra frame takes the present slot of the tick, so the following scroll frames queue one behind.
  The intervention below shows that the extra frame is what produces the stall; the queueing is not shown.

### The cadence tool undercounts this

The hash of the whole frame (`identical` in `inspect:cadence`) hid the stall in most runs.
In `ide-cadence-RjmA8F` slot 35 is "changed" by two pixels (x 1015 to 1081, y 323 to 618) and the text area is
unchanged; in `ide-cadence-y1JxNU` slot 35 is zero pixels different.
The new minimap picture is drawn into the extra frame, so the frame differs by a few pixels or by none,
depending on whether the new picture equals the old one.
The measurement therefore also counts a stalled tick: a tick of the input window in which the text area
(x 330 to 900, y 160 to 480) moved 0 rows against the frame before, found by matching row hashes at shifts of
-150 to 150 (scratch `mm-stall.mjs`, one 25 px step per tick is expected).
Positive control: the runs of the old behavior stall at the first hand-over in 20 of 20 runs (slot 35 in 16, slot 43 in
4), and the hash tool saw an identical frame there in 7 of those 20.

### Fix

The window no longer asks for a frame at the hand-over.
It starts a single-shot timer of 20 ms (`FRAME_WAIT`, longer than a frame at 50 Hz) and asks for a frame only if the
picture is still waiting then (`GpuTile::minimap_waiting`).
A scroll draws the picture in its next step and nothing is asked for; an idle window gets its frame 20 ms later.

- Guards: `a_picture_that_a_frame_draws_asks_for_no_frame_of_its_own` (commit `727242fa73`) counts the frames asked for
  (`PICTURE_FRAMES_ASKED`) across a hand-over and a drawn frame and expects none;
  `a_picture_that_no_frame_draws_asks_for_a_frame` expects exactly one in an idle window.
  Source guards `minimap-picture-waits-for-frame` and `minimap-picture-asks-when-idle` remove each half.

### Counts

Release build, `big.rs`, 1100x660, scroll scenario, recorder at 60 Hz, one run at a time, alternating pairs.
The measured binary carried a temporary environment switch (`IDE_REDRAW_NOW` restored the immediate request);
it is removed in the final tip, which was measured again below.
"First hand-over stall" is a stalled tick at slots 33 to 37, or 41 to 45 when highlighting timed out under load
(a 30 px banner moves the first hand-over, as in the section above).

- A against A (5 pairs, both with the immediate request): first hand-over stall in 5 of 5 and 5 of 5 runs (slot 35
  in 9 of 10, slot 43 in 1); stalls per run 2, 2, 3, 2, 2 and 2, 2, 3, 2, 2 (11 and 11);
  runs with a hash-identical frame 2 of 5 and 1 of 5.
  This is the floor: the stall is the same in every run, and the hash count alone moves between 1 and 2 of 5.
- Immediate request (A) against the fix (B), 10 pairs:
  first hand-over stall A 10 of 10 (slot 35 in 7, slot 43 in 3), B 0 of 10;
  runs with a hash-identical frame A 6 of 10 (7 frames), B 0 of 10;
  stalls per run A 1, 2, 2, 2, 2, 1, 3, 1, 3, 2 (19), B 2, 2, 1, 1, 1, 2, 1, 2, 2, 1 (15).
  Both differences are far past the floor.

The final tip, without the switch (3 pairs of the same binary, 6 runs):
no stalled tick at the first hand-over in 6 of 6, and no hash-identical frame in 6 of 6.

### Stalled ticks that remain

Stalls per run fall from 1.9 to 1.5 and do not reach zero.
The ones left (slots 50 and 98 in most runs, sometimes 74, 120 or 142) are not picture hand-overs.
A run logged at debug level (`ide-cadence-vQjf3g`, the final binary) shows the same pattern at them:
"window thread applied a finished tile" and a "winit asked for a redraw" that no wheel event started, then a 5 ms frame
(+320 ms and +1117 ms after the first wheel event, the stalls of that run at slots 50 and 98).
`src/native/render/present.rs` (the `request_redraw()` after `submit_tile` and after `submit_sign`)
asks for a frame at the tile hand-over the way `picture.rs` did.
That the stall at slot 50 is this one is read from the log, not shown by an intervention; it was not changed.
(The later session in "The extra frame at a tile hand-over" ran the interventions: the redraw request named here is
not the cause, the swap of the tile is.)

### Limits

- Measured only in the nested compositor, with its recorder as the clock, on a host that other sessions load
  (pressure stall average over 10 s between 0 and 16 during the runs).
  A real compositor (KWin, Mutter) was not tried, so the visible effect there is not shown.
- Scroll scenario only. The drag scenario was not run; a held drag also hands pictures over.
- A picture that arrives in an idle window is drawn up to 20 ms later than before. Not measured as a latency.
- On a display slower than 50 Hz the wait ends before the next frame, and the old extra frame comes back.
- The first picture of a file, a resize and a theme change hand a picture over in an idle window;
  the second test covers the request, and a look at the screen after each was not made.

### Gates

Run once each on the tip that follows the last code commit (`style(ide): rustfmt the picture frame code`):
`lint` 0 findings (a first run found rustfmt diffs, fixed with `format:rust`);
`test:native` 277 passed, 5 skipped (171 s);
`test` 797 passed, 1 skipped;
`test:bin` 60 passed;
`build` finished;
`inspect:no-software-renderer` passes (the software renderer is not linked;
`slint/renderer-software` and `slint/mcp` do reach it);
`inspect:source-guards` for the two new guards (2 of 150): baseline passes, removed fails, restored passes, for both.
The other 148 guards were not run.

## The extra frame at a tile hand-over

Session of 2026-10-21 on branch `worktree-agent-a0b5a3cdf2d733095`, base `b4e9063c3a`.
It answers the open item of the section "The extra frame at a picture hand-over":
the stall at slot 50 of the scripted scroll, which the previous session read from a log and attributed to the
`request_redraw()` calls after `submit_tile` and `submit_sign` in `src/native/render/present.rs`.

### Method

One release binary carried temporary environment switches (commit `ddca86e067`, removed in `d8ab9f62f2`):
`IDE_X_PICTURE=now` restored the immediate picture request (the old behavior, tree A), `IDE_X_TILE=none` removed the
`request_redraw()` after `submit_tile`, and `IDE_X_HOLD=1` was the fix below.
The measure is the frame-shift probe (ticks of the input window in which the text area moved 0 rows), one app run at a
time, alternating order, release, `big.rs`, 1100x660, scroll scenario, frames deleted after each run.
The probe sees the stall that the whole-frame hash misses; its positive control is the restored picture request,
which stalls at slot 35 in 6 of 6 runs.

### Interventions

- A against A, the floor (6 pairs, both with the switch unset): slot 50 in 6 of 6 and 6 of 6 runs;
  stalls in total 10 and 12 (other slots 74, 98, 120, 141, 142).
  The stall at slot 50 does not move between runs of one binary.
- Picture request restored (tree A, 6 runs): slot 35 in 6 of 6, slot 50 in 0 of 6, 13 stalls in total.
  The stall does not move to the next extra frame; the extra frame at slot 35 changes the timing of the whole run.
  In the debug timeline of such a run (`~/temp/agent/tile-dbg-p.timeline`)
  the tile is applied 1 ms after a wheel event, inside the frame the wheel started, so it adds no frame.
  Why the picture's frame moves the tile to such a moment is a reading from that one run (the 20 ms poll of the tile
  worker against the 16.7 ms steps drifts), not a measurement.
- The request after `submit_tile` removed (`IDE_X_TILE=none`, 6 runs): slot 50 in 6 of 6, 10 stalls in total.
  The explicit request is not the cause.
  The timeline of such a run (`~/temp/agent/tile-dbg-t0b.timeline`) still shows "winit asked for a redraw"
  4 ms after the wheel event,
  at the moment of "window thread applied a finished tile", and a 5 ms frame that draws the tile; the next wheel event
  follows 17 ms after the previous one.
  Something in the swap asks for that frame; the setters that `show` runs for the tile (the image's size and place,
  the selection rows as a new model, the caret) are the candidates, and which one does it was not isolated.
  What the intervention shows is that leaving the whole swap for the next step removes the frame and the stall.

### Cause

The poll timer of the tile worker (`src/native/tile.rs`, 20 ms) swaps a finished tile in at a moment unrelated to the
scroll steps (16.7 ms apart).
The swap makes the toolkit ask for a frame of its own, so between two steps there is a second frame,
which is the same effect as the picture hand-over's.
The text area then does not move for one tick.

### Fix

A finished tile is left for the next scroll step (`step_due` in `src/native/tile.rs`).
The timer does not poll while the last step is less than `STEP_WAIT` (20 ms) old; the step itself polls, at the end of
`on_viewport_changed` (`src/native/viewport.rs`), so the setters run in the frame that step draws.
With no step coming, the timer takes the tile 20 ms later, so an idle window does not keep the old tile.
The explicit `request_redraw()` calls stay: they draw a tile that changed no property the window watches.

The first version polled at the start of `on_viewport_changed`, before the step had placed the view.
It made the native test `an_external_edit_of_fifty_thousand_lines_shapes_only_the_line_it_touches` fail 20 of 20 in the
container (the baseline passed 20 of 20): the picture of the file before the edit had 190 lines where the baseline's
has 194, because the finished tile and the pass it carries were taken against a state that the step was about to
change.
Polling after the step's own work restores the order the timer has, and the test passes.

- Guards: `a_tile_that_finishes_between_two_steps_is_left_for_the_next_step` and
  `a_tile_that_finishes_with_no_step_due_is_taken_by_the_poll` (`src/native/tile_step_tests.rs`).
  Source guards `tile-left-for-next-step`, `tile-taken-by-the-step` and `tile-taken-by-the-poll-when-idle`.

### Counts

- The fix with the poll before the step (`IDE_X_HOLD=1`, 8 pairs against the unset binary): slot 50 in 8 of 8 against
  0 of 8; stalls in total 11 against 0.
- The fix with the poll before the step as the final binary against the baseline `b4e9063c3a` (8 pairs): 0 against 13
  stalls in total, slot 50 in 0 of 8 against 8 of 8.
  This binary failed the native test above and is not the shipped one.
- The final tip (`2fba9c567c`, poll after the step) against the baseline (8 pairs): 1 against 13 stalls in total;
  slot 50 in 0 of 8 against 8 of 8.
  The one stall is at slot 33 in a run of the fix (the baseline shows none there in 36 runs of this session);
  one run of the fix and one of the baseline also show a row shift of 50 px in a tick, a late frame followed by a
  catch-up.
  Whether the stall at 33 is the host or the fix was not decided: no more pairs were run.

### What remains

- Stalls at slots 74, 98, 120 and 142 of the baseline are gone in the fix runs (one stall, at slot 33, in 24 runs
  of the three passes).
  They were not examined one by one; in the timeline of one baseline run the stall at 74 follows a tile applied 1 ms
  after a wheel event, so not every stall of the baseline is an extra frame.
  The fix removes them together with slot 50 in these runs, which is a count, not a cause.
- An input slower than 50 Hz (a step later than `STEP_WAIT`) takes the old behavior: the poll swaps the tile in
  between two steps.
- A tile that finishes within `STEP_WAIT` after the last step of a scroll waits up to one more poll period (20 ms);
  this latency was not measured, and the second test covers only that the poll takes the tile.
- The drag scenario, display scales other than 1, a real compositor and the wrap indicator's own redraw
  (`submit_sign`, once per display scale, before the input) were not tried.
- The pair budget of ten per question was exceeded for the fix (three passes, 8 pairs each: the first pass with the
  switch, the final binary before and after the order change), because the order change was a code change.

### Gates

Run once each on tip `2fba9c567c` (documentation commits follow it):
`lint` 0 findings (a first run found rustfmt diffs in the module order and four semantic line break findings, fixed);
`test:native` 279 passed, 5 skipped (the earlier run on the previous tip failed the edit test above);
`test` 797 passed, 1 skipped; `test:bin` 60 passed; `build` finished;
`inspect:no-software-renderer` passes (not linked; the two features reach it);
`inspect:source-guards` for the three new guards (3 of 153): baseline passes, removed fails, restored passes, for all
(`tile-taken-by-the-step` shares the baseline of `tile-left-for-next-step`).
The other 150 guards were not run.
The counts above come from `~/temp/agent/tile-ab-1.jsonl`, `tile-ab-2.jsonl`, `tile-ab-3.jsonl` and `tile-ab-4.jsonl`.

### Idle latency of the 20 ms wait and rare stalls elsewhere

Session of 2026-10-22 on branch `worktree-agent-a0d7b8bed3990e6c8`, base `b6727b7b86` (the merged fix).
It takes the two items of "What remains" that were open: the added latency of the wait, and the stalls away from
slot 50.
No product code changed (the temporary switches of commit `0eb036e425` were reverted in `52d043318a`), so no gate ran.

#### Method of the session

One release binary carried the temporary switch `IDE_X_STEP_WAIT_MS`: unset is the merged 20 ms wait,
`0` turns the wait off and also the poll at the end of `on_viewport_changed`
(the code before the fix; it stalls at slot 50 in 16 of 16 runs below, which is its positive control),
`150` is a wait that must move the result by about 130 ms.
The binary also logged "source tile worker took a job" and "finished a build" at debug level.
Every number comes from one app run at a time in the nested compositor (1100x660, release, `big.rs`), each run a
capped unit (`CPUQuota=600%`, `MemoryMax=40G`), arms alternating per pair, artifact directories deleted after each run.
Logs were at debug level for the frame, tile, tile build and wheel targets only, in every arm.
The host load average stayed between 7 and 10 from other sessions; the counts below are over runs, not single runs.
The driver and the analysis are `~/temp/agent/lat-run.mjs`, `lat-stats.mjs`, `lat-extra.mjs` and `lat-stall-stats.mjs`;
the rows are in `~/temp/agent/lat-q1-s16.jsonl`, `lat-q1-sweep.jsonl`, `lat-explore2.jsonl`, `lat-q2a.jsonl` and
`lat-q2b.jsonl`.

#### Idle latency of the wait

The scenario is a scroll of 2 wheel steps with 1500 px each (`inspect:cadence scroll ... 2` with
`IDE_CADENCE_SCROLL=3000`), then nothing.
The view leaves the tile at once, so the picture shows no text until the new tile is drawn; the time asked for is the
last wheel event (compositor log) to the end of the first frame the toolkit finishes after the tile is applied
(app log).
A gentle scroll that stays inside the old tile's band changes no visible pixel at a hand-over, so this latency is only
visible when the view has outrun the tile.
A scroll of a single wheel step cannot be made with the compositor's command: 20 of 20 pairs with `steps=1` built no
tile at all, so that case is not measured.
Slower scrolls that end at a band exit produced chains of tiles (a discarded tile, then a re-center 33 ms later, then
the settle of the row measurement about 350 ms after the last step; 8 pairs in `~/temp/agent/lat-explore.jsonl`),
and the 20 ms question did not separate from them;
the 2-step scenario has one tile (`appliedAll` 1) in every run.

- The positive control, wait 150 ms (4 runs, all in `lat-explore2.jsonl`): last wheel to frame 165.1, 165.8, 165.9 and
  166.8 ms, against about 30 ms with the wait off; the measure sees a 136 ms move.
- The spread of unchanged input, wait off (47 runs, step 16 ms in 20 and 8 to 24 ms in 27): last wheel to frame median
  29.7 ms, quartiles 28.8 and 30.3, range 25.8 to 33.4.
  A difference of more than about 3 ms is not noise.
- The merged binary (47 runs, same inputs): median 30.2 ms, quartiles 29.5 and 49.3, range 28.3 to 51.0.
  The distribution has two modes: 28 runs at 28.3 to 32.9 ms, and 19 runs at 38.8 to 51.0 ms.
  In 18 of the 19 the poll logged "leaving a finished tile for the next scroll step" after the last wheel event;
  in none of the 47 runs with the wait off.
  Paired by order, the merged binary minus the wait off has a median of +2.2 ms with step 16 ms (20 pairs, quartiles
  -0.2 and +19.5) and +1.4 ms in the sweep of step lengths (27 pairs, quartiles -0.1 and +19.2); the slow runs add
  about 20 ms (22.3 at most).
- The recorder agrees in the 20 runs with step 16 ms: the first frame that differs from the one before it, counted
  from the last input slot, is slot 1 in 11 merged runs and slot 3 in 9; with the wait off it is slot 1 in 18 and
  slot 2 in 2 (whole-frame hash, which the minimap's picture also changes, and a slot is 16.7 ms).

The median is not above one display frame (17 ms): the added latency is about 1 ms at the median, so it is not a cost
by that measure and no fix was made.
It is a cost in a minority: in about 4 of 10 hand-overs of this kind the tile waits one more poll period (+20 ms, a
little more than one frame).
The mechanism is a reading from the timeline of one run, not an intervention: the two last wheel events arrive in the
same instant, the first requests the tile and starts the poll timer, the second is handled a few milliseconds later,
so the poll 20 ms after the timer start finds the last step less than 20 ms old and leaves the tile, and the next
poll is a full period later.
A poll that leaves a tile could ask for one more look when the wait ends (a single-shot timer for the rest of
`STEP_WAIT`), which would cut the tail to about 20 ms after the last step in every case; this was not built, because
the median criterion of this question was not met, and a one-shot timer would be a second timer path next to the
poll.

#### Stalls away from slot 50

Scroll scenario, 120 steps, frame-shift probe (`mm-stall.mjs`), alternating order, debug log kept per run.

- Fix switched off (16 runs): 32 stalls in total, per run 2,2,2,2,1,2,2,3,2,2,2,2,2,2,2,2;
  slot 50 in 16 of 16 runs (positive control), slot 74 in 11, slot 98 in 3, slots 120 and 142 in one each;
  one run shows a row shift of 50 px in a tick (slot 131).
- Merged binary (16 runs in the alternating pairs, then 40 more merged runs, 56 in all): no stall in any run, and no
  row shift other than one step.
- A detector at the application level, from the debug logs: redraw requests that no wheel event started, inside the
  window of the input.
  With the fix off, all 16 runs have one (the tile taken by the timer, about 320 ms after the first wheel event,
  which is slot 50); three runs have more, one of them 10 in all, six in a row spaced
  16.7 ms apart (1069 to 1152 ms after the first wheel event) that follow no tile hand-over;
  bursts like that look like late delivery of input, which was not examined further.
  With the merged binary, 0 in 56 runs, and all 560 tiles applied in the window were applied inside a scroll step
  (within 2 ms after a wheel event); the poll left a tile 280 times and the next step took it.
  The positive control of this detector is the same 16 fix-off runs.
- The earlier stalls at slots 33 and 72 (one run each of 16 merged runs, as reported to this session, and slot 33 in
  one of 24 runs in the subsection "Counts") did not occur in these 56 runs,
  so no timeline of a stalled run of the merged binary exists, and the question
  "the host or the fix" is not decided by an intervention.
  What the 56 runs show is that the mechanism of the fix, a tile taken between two steps, did not occur once, which
  does not support the fix as the cause; with no stall to read, the host is not shown either.
  This session's 0 in 56 puts the upper bound of the per-run rate near 5% (rule of three), below the 2 of 16 seen
  in the other session, so the rate itself is not steady between sessions, which fits the host but does not show it.
  Synthetic host load, which could raise the rate of a host stall on purpose, is forbidden in this repository, so it
  was not tried.

#### Not run

- Neither the drag scenario, a display scale other than 1, a real compositor, nor a slower input than 50 Hz.
- No stalled run of the merged binary was read, so no fix for a stall away from slot 50 was made or tested.
- The code before the fix was reproduced by the switch (wait and step poll off), not by a build of `b4e9063c3a`;
  the stall at slot 50 in 16 of 16 runs is the check that the two agree.
- Gates (`lint`, `test:native`, `test`, `test:bin`, `build`, `inspect:no-software-renderer`) were not run: no product
  code and no guard changed.
