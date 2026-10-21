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
