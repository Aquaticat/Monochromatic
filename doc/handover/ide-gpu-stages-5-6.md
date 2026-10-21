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
