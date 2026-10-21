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
