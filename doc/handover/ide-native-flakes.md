# Native suite flakes: state at the stop

The work was stopped on request before it finished.
No test runs under retries, and `.config/nextest.toml` of the package is unchanged.
The branch is `worktree-agent-af624c22739073177`, package `package/desktop-app/ide`.

## The stress tool

Run it with `mise run //package/desktop-app/ide:test:native:stress --filter '<nextest expression>' --count 40 --copies 4 --threads 2`.
The tool builds once in a container with the normal build bound.
It then runs the filtered tests inside a second GPU container limited to 2 CPUs and 2 GiB, and prints failures per test.
The tests contend with each other inside that cap; the tool starts no host load.
An earlier version started `stress-ng` on the host; that was removed in the commit that limits the container, and every measurement below that mentions a load of 10 or 12 CPUs was made with that earlier version.
Its logs are under `~/temp/agent/stress-*`.
The positive control (a scratch test failing about one run in five) showed 7 of 40 failures without retries and `TRY 1 FAIL` then `TRY 2 PASS` with `--retries 3`.
The tool and its report parser are committed; `test:bin` covers the parser.
The tool was not yet re-verified after the move to the 2-CPU container beyond one run of 160 menu tests (0 failed, 85 s).

## Fixed, with evidence

### Refused worker tile test

The old assertion `tile_job.is_none()` was made after the failure was reported.
A later render, caused by the late highlighting reply (`reload.rs` `apply` then `apply_syntax` then `render`), legitimately re-requests the wanted tile.
Fix: a direct test of the error path of `apply` in `tile.rs`, an integration test that waits for the end state, and a wait for the highlighting reply in the `reader()` fixture of `src/native/find_tests.rs`.
Old test body, 360 runs: 10 failures without the wait, 0 with it.
Guard proof: removing `current.tile_job = None;` from the error path of `apply` fails both new tests.

### Late highlighting reply in the reader fixture

After `settle_tile`, the reply was still missing in 28 of 160 probe runs, and 0 of 160 with the wait.
The committed test `a_reader_is_opened_with_its_highlighting_applied` failed 160 of 160 with the wait removed and 0 of 160 with it.
The wrap clip test failed 3 of 240 without the wait (one extra render) and 0 of 240 with it.

## Open, not reproduced or not understood

### Find box context menu (`query_input_tests::find_box_context_menu_runs_each_entry`)

Reproduced at 2 of 240 and 5 of 480 in heavy runs on the earlier host-load version of the tool; 0 of 600 in isolation and 0 of 160 on the 2-CPU tool.
The fixture wait does not cure it.
The latest diagnostic message shows the cause: the popup count is 1 after the right press and 0 after the right release, so the menu closes during the release dispatch, and the keys then go to the find box (Return steps the find match, status "2/2").
Nothing runs between the press and the release in the test, so the close is synchronous in Slint 1.18.1 `i-slint-core` `window.rs`.
Candidates read but not yet separated: `popup_to_close` in the mouse dispatch (`had_popup_on_press`), and the close of popups whose parent item no longer upgrades in `item_tree.rs`.
The test now fails with the counts before the press, after the press, after the release and after settling.

### Annotation stability tests (rigid, rows arriving, rows above the view)

Each failed once in the 480-run heavy hunt on the earlier tool: `rows_arriving_in_view_move_only_lines_beneath_them` (104 levels, row 8, the facts show 2 tiles rendered) and `scrolling_across_annotated_lines_is_rigid` (31 rows differ from row 101 to 511, largest channel difference 198, not contiguous).
A failed comparison now keeps both frames as PPM files under the package `target/flake-frames/` and names the columns and rows that differ.
The next failure gives the frames to inspect; no cause is known.
The nine-level pixel difference of `rows_above_the_view_wait_until_scrolling_has_stopped` was never reproduced.

### Not reproduced

`write_wait_tests`, the two `watch_tests` (400 ms budgets) and `wrap_tests::rows_above_the_view_changing_height_move_no_visible_pixel` (a `settled` that returned early) never failed in any run; no instrumentation was added for them.
Two failures in the heavy hunt were environmental: a full disk (`No space left on device`) in `opening_fifty_thousand_lines_never_blocks_the_window_thread`, and a wgpu `vello.scene` buffer validation error in `the_extent_settles_as_chunks_arrive`.
Neither is understood further.

### Minimap test (not mine)

`minimap_tests::an_external_edit_of_fifty_thousand_lines_renders_only_the_band_it_touches` failed 13 of 120 (10.8 percent) on the baseline tree under host load of 12 CPUs, and 1 of 120 with the reader wait.
The late reply is the likely cause and is unproven.
Another agent is deleting the CPU minimap.

## Same exposure, not changed

Fixtures that bind `reload` without the highlighting wait: `watch_tests::open`, `refresh_latency_tests`, `navigation_tests` (two), `language/test_support.rs`.

## Next steps

1. Run `mise run //package/desktop-app/ide:test:native:stress --filter 'test(query_input_tests) or test(wrap_tests) or test(annotation_stability_tests) or test(wrap_clip_tests) or test(refused_tile_tests) or test(watch_tests)' --count 40 --copies 3 --threads 3` and read the popup counts of a menu failure.
2. If the release closes the popup, probe the two candidate paths in a disposable copy by dispatching a render, a selection change or a model change between the press and the release.
3. Fix at the cause, then run at least 200 iterations of the same shape and record before and after counts with the detectable rate.
4. Keep the frames of the next annotation stability failure and inspect them before choosing a fix.
5. Write the flaky test ledger section of `doc/planning/ide-gpu-snapshot-harness.md` (before the open owner questions of stages 3 and 4): it should state zero tests under retries.
6. Run `lint`, `test:native` once on the final snapshot, `test:bin`, `build` and `inspect:software-renderer`; none of these was run on the final snapshot.
