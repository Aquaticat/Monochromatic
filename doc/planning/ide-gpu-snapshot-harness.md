# GPU snapshot harness for the IDE native tests

Stage 0 of the GPU migration in `doc/planning/ide-vello-text.md`.
The owner decided on 2026-10-19 that nothing in the IDE paints on the CPU,
tests included,
so the native tests must stop reading pixels from Slint's software renderer.
This document records what was measured,
what was built,
and what is still open.
Every number below comes from a command that was run on 2026-10-19 on the owner's host
(AMD Radeon RX 7600 as `renderD128`,
the Raphael integrated GPU as `renderD129`);
what was not run is listed under "Not proven".

## Result in one paragraph

A custom Slint platform whose windows use `FemtoVGWGPURenderer` renders a window headless
on a hardware Vulkan device and `Window::take_snapshot` reads the pixels back,
with no display server.
The container sees the GPU when it is started with `--device /dev/dri` and the image holds `vulkan-loader`
and `mesa-vulkan-drivers`;
wgpu then lists both RADV devices,
and the harness refuses the CPU adapter.
The harness is 163 lines of code (420 with its comments).
Two renders of one window were byte-identical (in one process,
across two processes,
and against the same component
drawn by `winit-femtovg-wgpu` on the host's newer Mesa),
and a screenshot of that component from the nested compositor differed from the harness in none of 60,000 pixels.
Run unchanged on the GPU platform,
209 of the 214 native tests passed;
a missing in-memory clipboard explained 2 of the
5 failures (fixed in the harness) and three tests needed real adaptation or diagnosis.
Stage 0b (section "Stage 0b") then moved every test that creates a window onto the platform,
diagnosed those three as differences between the software renderer's pixels and the GPU's
(edge rows of a fractional rectangle,
and the one-level deviation of the clip edge rows),
corrected the tests with a measured reason each,
and removed the software renderer from the application and test builds.
All 214 native tests passed on the GPU platform in two consecutive runs on the final head,
though a few load-dependent failures appeared in other parallel runs (section "Failures that came and went").

## How Slint renders without a window system

Read in the installed 1.18.1 sources,
and then confirmed by running the code below.

- `slint::platform::femtovg_renderer::FemtoVGWGPURenderer` (feature `unstable-wgpu-30` on `slint`,
  which needs
  `renderer-femtovg-wgpu`) takes a `wgpu::Instance`,
  `Device` and `Queue`
  (`i-slint-renderer-femtovg-1.18.1/wgpu.rs`,
  `FemtoVGWGPURenderer::new`).
  It owns no surface.
- Its `RendererSealed::take_snapshot` goes to `wgpu_take_snapshot_pixels` in the same file:
  it creates an `Rgba8Unorm` texture of the window size,
  points the renderer at it,
  renders,
  copies the texture into a
  mapped buffer,
  and returns a `SharedPixelBuffer<Rgba8Pixel>`.
  So `window.window().take_snapshot()` already does the readback;
  the harness needs no copy code of its own.
- A `slint::platform::Platform` whose `create_window_adapter` returns a `WindowAdapter` holding a `Window`,
  that renderer,
  and a size is all the integration there is.
  `slint::platform::set_platform` installs it for the calling thread (`i-slint-core-1.18.1/platform.rs`,
  `set_platform`,
  which fills the thread-local `GLOBAL_CONTEXT`).

Rejected,
with the evidence:

- The testing backend with a GPU renderer.
  `TestingBackendOptions::renderer_name` accepts `software` and `skia` only
  (`i-slint-backend-testing-1.18.1/testing_backend.rs`,
  `create_headless_renderer`,
  and the doc comment on the field),
  `TestingWindow::renderer` is private,
  and the Slint selector's `headless` name builds exactly that backend
  (`i-slint-backend-selector-1.18.1/lib.rs`,
  `create_headless_backend`).
- Slint's winit backend in a nested compositor as the test path.
  It works for one picture (see the comparison below) but needs a compositor process per test and has no pixel readback
  other than `take_snapshot` on the same renderer.
- Skia.
  It is not enabled in the IDE and was not built;
  no claim is made about it.
- The GL variant of FemtoVG on an EGL surfaceless context.
  Not built or measured.
  It would still be FemtoVG,
  and wgpu's GL backend is the one Slint itself keeps away from the renderer
  (`i-slint-core-1.18.1/graphics/wgpu_30.rs`,
  `default_backends_to_avoid`).

## The container and the GPU

`mise.toml` runs every cargo job in `localhost/monochromatic/ide` with `--network=none` and mounts only the package
directory and the `ide-cargo` volume.
The image was `FROM localhost/monochromatic/terminal` plus Helix's C++ driver,
ripgrep,
rustfmt and `cargo-about`.

Commands that were run,
in order:

1.
  `vulkaninfo --summary` on the host:
  three devices,
  RADV on the RX 7600 (discrete),
  RADV on the Raphael GPU
   (integrated),
   and `llvmpipe` (CPU),
   Mesa 26.2.4.
2.
  `podman run --rm --device /dev/dri localhost/monochromatic/ide sh -c '...'` in the unchanged image:
   there was no `libvulkan` and no ICD directory (`/usr/share/vulkan/icd.d` does not exist),
   only `mesa-dri-drivers` (OpenGL).
   So wgpu's Vulkan backend would find nothing there.
3.
  The same command with `dnf install --assumeyes vulkan-loader mesa-vulkan-drivers vulkan-tools` first,
  then
   `vulkaninfo --summary`:
   `AMD Radeon RX 7600 (RADV NAVI33)` (discrete),
   `AMD Radeon Graphics (RADV RAPHAEL_MENDOCINO)`
   (integrated) and `llvmpipe (LLVM 19.1.7)` (CPU),
   Mesa 25.0.7.
   `/dev/dri/renderD128` and `renderD129` are mode 0666 on this host,
   so the rootless container could use them
   without extra groups.
4.
  wgpu inside the container,
  through the harness:
  `GPU snapshot adapter: AMD Radeon RX 7600 (RADV NAVI33)`.

So the hardware path needs three changes,
all made in `package/desktop-app/ide`:

- `Containerfile`:
  `dnf install vulkan-loader mesa-vulkan-drivers`.
  The image has to be rebuilt once (`mise run //package/desktop-app/ide:image`);
  the new layer sits before the
  `cargo-about` install,
  which was rerun (49 s of compiling) and rebuilt the shared tag.
- `mise.toml`:
  `runBounded` takes a `gpu` option that adds `--device /dev/dri` and
  `VK_DRIVER_FILES=/usr/share/vulkan/icd.d/radeon_icd.x86_64.json`;
  only `test:native` passes it.
  `VK_DRIVER_FILES` names RADV only,
  so `llvmpipe` (installed by the same package) is not even listed:
  `vulkaninfo --summary` in the image with `--device /dev/dri` and that variable listed exactly two devices,
  the RX 7600 and the Raphael GPU.
- `Cargo.toml`:
  `slint` as a dev-dependency with `renderer-femtovg-wgpu` and `unstable-wgpu-30`.

Effects to know about:

- The container is no longer fully isolated from the host for `test:native`:
  it can use the host's render nodes.
  The mise.toml header says so.
  The podman memory and CPU bound does not cap GPU memory.
- A host without `/dev/dri` makes `podman run --device /dev/dri` fail before any test starts,
  for all of `test:native`.
- Other tasks and `bin/inspect-*-guards.mjs` scripts that run `cargo nextest ... --bin monochromatic-ide` start their
  own containers without `/dev/dri`.
  None of them selects the migrated test
  (checked with `rg` for `source_typography` and `source_font_tests` in `bin/`,
  `mise.toml`,
  and the README;
  `test:annotations-native` filters on `annotation`).
  A test that moves onto the harness and is also selected by one of those scripts needs the device passed there too.
- `file-enforcer` does not manage the dev-dependency section:
  `node file-enforcer.config.ts` rewrote only the root `mise.toml`
  (unrelated,
  reverted)
  and left
  `package/desktop-app/ide/Cargo.toml` as edited.
- The application build is unchanged.
  `mise run //package/desktop-app/ide:linked-crates` (`cargo tree` with `--edges normal,no-proc-macro`) lists 371 crates
  and no `wgpu` entry;
  only the GL `femtovg` 0.27.0 and `i-slint-renderer-femtovg` it already had.
  `Cargo.lock` gained eight packages (`android-build`,
  `drm`,
  `glow`,
  `i-slint-backend-android-activity`,
  `khronos-egl`,
  `termcolor`,
  `wgpu-core-deps-emscripten`,
  `wgpu-core-deps-wasm`),
  produced by the `fetch` task.

## The CPU adapter question

`mesa-vulkan-drivers` ships lavapipe,
a CPU rasterizer,
in the same package as RADV.
It is not adopted.
Three channels keep it out:

- `VK_DRIVER_FILES` in the test task lists RADV only.
- The harness enumerates Vulkan adapters and keeps `DiscreteGpu` and `IntegratedGpu` only
  (`hardware_rank` in `src/native/gpu_snapshot.rs`).
- A machine with no hardware adapter fails with a message that names every adapter it saw.
  Run in a container without `--device`,
  it read:
  no hardware Vulkan adapter for the GPU snapshot harness,
  adapters seen are llvmpipe (Cpu,
  driver llvmpipe).

For the record,
with the CPU guard removed (an edit of `hardware_rank` to accept `Cpu`,
restored afterwards) and no
`/dev/dri`,
the migrated test passed on `llvmpipe` in 1.11 s against 0.36 s on the RX 7600.
That is CPU rasterization,
so it is a measurement and not an option;
whether it may ever serve as a fallback is an owner
question below.

## Measurements

All runs are debug builds in the IDE image on the RX 7600 unless said otherwise.
The scratch crate `~/temp/agent/ide-gpu-snapshot/probe` includes the repository's `gpu_snapshot.rs` by path and draws
the `FontProbe` component of `font_tests.rs` (600 by 100,
Inter Variable text and two rectangles).

Approach A,
the custom platform with `FemtoVGWGPURenderer` (built):

- Test-support code:
  420 lines in `src/native/gpu_snapshot.rs`,
  of which 163 are code and the rest the repository's
  comment style;
  no code outside test builds.
- Opening the device (enumerate,
  choose,
  request):
  579 ms once per process.
- The first snapshot:
  120.6 ms and 115.6 ms in two processes (pipeline creation);
  the next 20:
  median 1.90 ms,
  minimum 1.80,
  maximum 2.62.
- Determinism:
  all 21 renders in one process hashed equal;
  the two processes wrote byte-identical files
  (`cmp` reported no difference);
  changing the weight to 537 changed the hash,
  and returning to 400 restored the first hash.
- The migrated `source_typography_repaints_without_changing_selection` (production `AppWindow`,
  3 captures plus a repeat)
  ran in 0.387 s alone;
  inside the full run on 21 threads it took 1.94 s.

The software renderer (the current test path,
`SLINT_BACKEND=headless`,
same probe):
first snapshot 6.74 ms,
next 20
median 3.71 ms,
all 21 equal.
So the GPU snapshot is faster once warm and about 18 times slower for the first one.

The software renderer and the GPU do not draw the same pixels:
2,065 of 60,000 pixels differ in the probe (968 by more than 32 levels,
the maximum 192),
and the non-white count is 9,881 on the GPU against 9,947 in software (text edges and the rounded rectangle).
Tests that compare pixels against a reference of the other renderer,
or against exact edge columns,
can move.

Against the nested compositor:

- `monochromatic-nested-wayland-session --headless --size 600x100` hosted the same probe with
  `SLINT_BACKEND=winit-femtovg-wgpu` and `WGPU_POWER_PREF=high`.
  The client's own `take_snapshot` on that path hashed the same as the harness (`d68567f224526787`),
  although it ran on
  the host's Mesa 26.2.4 and the harness on the image's Mesa 25.0.7.
- The compositor's `screenshot` command wrote a 600 by 100 PNG;
  decoded and compared with the harness image
  over all three colour channels:
  0 differing pixels of 60,000,
  maximum channel delta 0.
  (The compositor composited the client's frame on the integrated GPU,
  `renderD129`;
  the client's own adapter was not logged.
  Only this one component was compared.)

## What was built

`package/desktop-app/ide/src/native/gpu_snapshot.rs`,
compiled only for tests,
exposes:

- `install_gpu_platform() -> String`:
  opens the device,
  installs the platform on the calling thread (idempotent per
  thread),
  and returns the adapter name for the test to print.
  It panics when no hardware adapter exists or another platform was installed first.
- `snapshot(&Window) -> SharedPixelBuffer<Rgba8Pixel>`:
  `take_snapshot` with a failure message.
  Plain `window.window().take_snapshot()` returns the same pixels once the platform is installed.

The platform keeps the default clipboard in memory (as the testing backend does),
sizes windows as the testing backend
does (800 by 600 until the component states a preferred size),
and leaks the wgpu handles on purpose.
Without the leak the process aborts at the end of the test:
Slint drops the platform during thread-local destruction and
wgpu's queue then reads its own destroyed thread-local.
The panic message is "cannot access a Thread Local Storage value during or after destruction",
with a backtrace through `wgpu_core::snatch::trace::LockTrace::enter`.
The leak lasts as long as the test process.

One existing test file moved:
`src/native/source_font_tests.rs` (four changed lines of test code).
The harness uses `tokio`,
already a dependency,
to wait for wgpu's two futures;
no crate was added.
Slint prints `MCP server failed to start: NoEventLoopProvider` once per process because the `slint/mcp` feature starts
its server on `set_platform` and this platform has no event loop proxy;
the tests do not use that server.

## Guard evidence

The test was committed first,
then each guard was removed,
the task rebuilt,
and the result recorded.

- The thing the test guards is that a requested font weight and italic reach the displayed ink.
  The removal was in the test's `capture` helper (the request `SourceTypography { weight, italic, .. }` replaced by
  the defaults `weight: 400.0, italic: false`).
  Result:
  `FAIL`,
  panic at `src/native/source_font_tests.rs:91` `source weight must change displayed ink`.
  Restored;
  `git diff` empty.
- A removal in production code failed the test too.
  The tool permission layer refused an edit of `src/shaped_text/layout.rs` in the worktree,
  so the removal ran in the scratch copy of the package (`~/temp/agent/ide-gpu-snapshot/exp`,
  same sources and the current harness):
  the three lines that push `StyleProperty::FontWeight` to the Parley builder in `build_line` were deleted.
  Result:
  `FAIL`,
  panic at `src/native/source_font_tests.rs:91`,
  `source weight must change displayed ink`.
  The scratch copy is not part of the branch,
  so nothing needed restoring in the repository.
- The CPU refusal in the harness:
  with `hardware_rank` accepting `Cpu` and no `/dev/dri` the test passed on `llvmpipe`;
  with the guard restored,
  the same container fails with the adapter list above.

## Gates

From the worktree,
with the repository tasks:

- `mise run //package/desktop-app/ide:lint:clippy`:
  passes.
  Its first run caught the lint `implicit_return` in the harness closure;
  fixed.
- `mise run //package/desktop-app/ide:lint:rustfmt`:
  passes after `format:rust` (it reformatted only the harness).
- `mise run //package/desktop-app/ide:lint:slint`:
  passes.
- `mise run //package/desktop-app/ide:lint` stops at `monochromatic-lint` with errors in `src/native/pass_tests.rs`
  (two) and
  `src/native/tile_pass.rs` (one),
  files this branch does not touch;
  the harness has none.
  The handover already records that this run exits 1 on `semantic-line-breaks` errors that were there before.
- `mise run //package/desktop-app/ide:test:native`:
  214 tests run,
  214 passed,
  5 skipped,
  159.0 s on the branch before the clipboard change,
  and again 214 passed,
  5 skipped,
  142.8 s on the final head.
  An earlier run stopped on `minimap_tests::fifty_thousand_lines_give_a_bounded_picture_without_blocking_the_window`
  (`173 lines were rendered for 4 bands`),
  a test that does not use the harness;
  it passed alone (0.44 s)
  and in the next
  full run,
  so it is a load-dependent flake that this branch did not cause (not investigated further).

## Stage 0b: the other test files, the three failures, and the software renderer

Done on 2026-10-20 on the branch of this document,
by repository tasks in the IDE image on the same host as stage 0.
It answers the section that used to stand here ("What blocks the other files"),
whose experiment is kept in the numbers it quoted:
209 of 214 tests passed unchanged,
and three failed for reasons left open.
Those reasons are below.

### Where the platform is installed

Slint keeps one platform per thread and creates it at the first window,
timer or animation call of the thread.
The old task set `SLINT_BACKEND=headless`,
so that first call built the testing backend with the software renderer.
The tests share no single entry:
18 places in 15 files call `AppWindow::new()` (one calls the `FontProbe` component of `font_tests.rs`),
most of them inside a fixture that other test files reuse.
The smallest correct mechanism is one `install_gpu_platform();` statement before each of those constructors,
with one import per file.
The call is idempotent per thread,
so a fixture that builds several windows needs it once.
The files and the number of constructors that now follow an install:

- `font_tests.rs` (1),
  `tests.rs` (1),
  `tree_scroll_tests.rs` (1),
  `tree_pointer_tests.rs` (1)
- `find_tests.rs` (1,
  the `reader` fixture),
  `search_tests.rs` (1,
  its `reader` fixture),
  `search_pointer_tests.rs` (1),
  `sidebar_tests.rs` (1,
  the `fixture`),
  `sidebar_keyboard_tests.rs` (1),
  `overscan_tile_tests.rs` (1,
  the `open` helper)
- `watch_tests.rs` (1,
  `open`),
  `refresh_latency_tests.rs` (1)
- `navigation_tests.rs` (2),
  `navigation_reveal_tests.rs` (3)
- `language/test_support.rs` (1)

`annotation_paint_tests`,
`minimap_tests`,
`sidebar_paint_tests`,
`theme_tests` and `wrap_resize_tests`
have no constructor of their own;
they reach a window through the fixtures above and so through an install.
`source_font_tests.rs` was migrated in stage 0 and is unchanged.
Each test keeps its assertions;
the only edits in these 15 files are the import and the call.

The task `test:native` no longer sets `SLINT_BACKEND` or `SLINT_MCP_PORT` and no longer builds with `slint/mcp`.
A window created without the install now asks Slint's selector for its winit backend,
which in a container without a display stops with an error and never draws on the CPU.
Positive control (2026-10-20):
with the install in `tree_scroll_tests.rs` replaced by an unused reference,
the test failed with `Could not initialize backend`,
from the winit backend,
`neither WAYLAND_DISPLAY nor WAYLAND_SOCKET nor DISPLAY is set`.
Tests that only use timers (no window) pass without an install.
The likely reason is that Slint's winit backend is created without a display until a window needs one
(not checked in its source),
and nothing is painted by such a test.

The container arguments for the render nodes moved to `bin/gpu-arguments.ts`,
read by `mise.toml` and by the eleven guard inspection scripts
(`bin/inspect-*-guards.mjs`,
`inspect-watch-scope.mjs`,
`inspect-refresh-latency.mjs`)
that start their own containers around native tests.
Those scripts lost `SLINT_BACKEND=headless`,
`SLINT_MCP_PORT=0` and `--features slint/mcp`,
as `test:native` did.
`test:annotations-native` takes the device too.
Of these scripts,
none was run (each runs a test twice with a guard removed,
for minutes per guard);
the change in them is the argument list only.

### The three failures

Each was reproduced alone on the GPU platform with a temporary dump of pixels
(removed before the commit).

#### The selection ink tests

`query_input_tests::find_box_selection_uses_the_ink_chosen_from_the_fill` and
`query_input_paint_tests::search_box_selection_uses_the_ink_chosen_from_the_fill_in_both_schemes`
measured `darkest 0.165, lightest 1` in the dark scheme against `darkest > 0.3`.
The per-row dump of the sampled region (30 by 20 pixels in the search box,
38 by 20 in the find box) shows why.
The selection rectangle is about 14.5 pixels tall at a fractional offset.
Its first and last pixel rows are blends of the box background and the fill:
`102f46` or `102f47` against the background `151515` and the fill `0078d4`,
which is about a quarter of the fill,
lightness 0.165.
The full rows between them are exactly `0078d4` (lightness 0.397),
and the glyph pixels reach 1.000.
The software renderer snaps a rectangle to whole pixels,
so no blend row existed;
the test's rows `top + 14` to `top + 34` happened to include the two edge rows,
and a blend of fill and background is not ink.
The application is not at fault:
the geometry is the toolkit's selection rectangle,
only its edge rasterization differs.

The correction narrows the rows to `top + 17` through `top + 31` (exclusive),
the rows wholly inside the rectangle,
which still hold every glyph pixel (glyph rows 19 to 29 of the box in the find test,
19 to 27 in the search test).
Guard run (GFP) with the tests committed:
`selection-foreground-color` in `ui/query-input.slint` replaced by `#000000` made both tests fail with
`darkest 0, lightest 0.39658982`,
and restoring it made them pass.

#### The rigid scroll test

`annotation_stability_tests::scrolling_across_annotated_lines_is_rigid` failed at offset 115,
window row 658.
That is not a tile seam:
the first offset is 115 because the range starts at 114,
and in 223 of the 1256 offsets the tile was no longer the first one,
without any seam failing.
A temporary per-row tally of all offsets (rows 32 to 658,
1256 scrolls) found:

- Rows 33 to 657 matched the previous frame shifted by one row exactly in every scroll,
  across the annotated blocks and the tile re-centers.
- Row 658,
  the comparison with the previous frame's last window row,
  differed in 123 scrolls,
  334 pixels in all,
  by one level in one channel value at most
  (226 against 227,
  29 against 30,
  30 against 31).
- Row 32,
  the first row of the viewport (not compared by the test),
  differed in 5 scrolls,
  6 pixels,
  by one level.

So the deviation sits at the two clip edges of the scroll view and nowhere else.
The likely cause is the clip:
FemtoVG's fragment shader multiplies a clipped pixel by a float scissor mask
(`scissorMask` in `femtovg-0.27.0`,
both the GL and the wgpu shader),
and the software renderer clips on whole pixels.
That mechanism was read,
not isolated.
The application is not at fault.

The correction compares the last window row within one level per channel
and every other row exactly (`within_one_level` in the test file).
Guard run (GFP):
`set_image_y(origin)` in `src/native/render/present.rs` replaced by `origin + 1.0` for a newly set tile
made the test fail at offset 622 (the first re-center),
window row 33,
with `365 rows differ exactly, the first Some(33) and the last Some(657)`.
That failure is in the exact rows;
the relaxed row is covered only indirectly,
because any real one-row error also breaks the rows above it.

#### Failures that came and went

The default invocation of `test:native` runs 21 test processes at once on one GPU.
The invocation with a filter adds `--no-capture`,
which makes nextest run one test at a time
(the 20 filtered full runs below took 410.3 s to 427.3 s,
and their per-test durations sum to the wall time,
411.2 s in the one summed).
No test failed in those 20 serial runs,
so what follows needs the parallel run.
The parallel full runs after the corrections gave this:

- The rigid scroll test failed once,
  in the first run on `bbdfbc5402`
  (its code there differs from the final head only in the failure message and in comments):
  `the frame at offset 115 is not the previous one shifted by one row (window row 255)`,
  after 1.9 s,
  as the third test to finish.
  Row 255 is an interior row at the first offset of the loop,
  so this is not the clip-edge difference.
  It did not return in the 19 parallel runs on the final head,
  in three runs of the test alone,
  or in 20 serial full runs.
  In 13 of the serial full runs a temporary print before the loop showed the tile job and the pending scroll absent
  (`tile_job false`,
  `scroll_wanted false`,
  `worker_tiles 0`),
  so a late tile is not the usual state;
  a 400 ms pause between the annotation injection and the loop,
  and a 300 ms stall inside the first iteration (between the scroll and the timers),
  did not fail the test either,
  which makes a quiet-period of the row rules (200 ms of stillness) an unlikely cause.
  The cause is not found.
  Two guesses,
  neither proven:
  a late asynchronous change of the page between the first two frames,
  or a stale readback of the GPU texture under the contention of 21 processes starting at once.
  The failure message now names how many rows differ and the first and last of them (`unshifted_rows`),
  so the next failure says whether it is a lone row or content that changed from some row on.
- `write_wait_tests::native_source_does_not_show_a_deleted_file_before_its_rewrite_finishes` failed once
  in the 19 parallel runs on the final head (`a rewrite in progress was shown`,
  the text list was
  `["I am a big cat\n", "", "I was a big cat, but now I am a human!\n"]`).
- `watch_tests::native_source_follows_atomic_replace_and_delete_then_recreate` and
  `watch_tests::native_tree_follows_changes_in_one_of_several_expanded_folders` failed together once in the same 19
  (`the reset text did not appear within 400ms`,
  `a file moved out of the folder did not appear within 400ms`).

The last two tests wait on wall-clock budgets (a write wait,
a 400 ms bound) while 21 processes share the machine,
and the host also ran other sessions' test runs at times,
so a load-dependent timing flake is the likely reading;
no run of the software path under the same load was made to compare,
and stage 0 recorded one such flake (`minimap_tests`) on the earlier path.
The 17 other parallel runs on the final head passed.

### Removing the software renderer

Removing `renderer-software` from the `slint` feature list changed nothing,
and `cargo tree --invert i-slint-renderer-software` showed why:
Slint's `default` feature set contains `renderer-software`,
and the dependency used default features.
The inverted tree then listed `i-slint-backend-winit` and `slint` as the paths.
Both `slint` entries (dependency and dev-dependency) now set `default-features = false`,
and the first lists the rest of the default set:
`std`,
`backend-default`,
`accessibility`,
`compat-1-2` and `system-tray`,
with the previous `backend-winit` and `renderer-femtovg`.
`Cargo.lock` lost eight dependency lines
(`bytemuck`,
`imgref`,
`rgb` and the software renderer from the winit and linuxkms backends,
`i-slint-backend-testing` from the selector),
written by the `fetch` task.
The `launcher.rs` comments no longer name `winit-software`;
the code never spelled it,
it forwards whatever follows `winit-`.

Evidence (task `inspect:software-renderer`,
which runs
`cargo tree --frozen --edges normal,dev,no-proc-macro --target x86_64-unknown-linux-gnu`
with `--invert i-slint-renderer-software`
in the container and fails when it prints anything):

- Application and test builds:
  nothing prints (`warning: nothing to print`),
  the task passes.
- With `--features slint/mcp` added (positive control;
  the task failed with
  `Slint software renderer is linked:` and the tree):
  `i-slint-renderer-software` is reached through `i-slint-backend-testing` (selector feature `mcp`) and through
  `i-slint-backend-winit`.
- `mise run //package/desktop-app/ide:linked-crates`:
  367 crates (371 before).
- `i-slint-backend-testing` stays as a dev-dependency for the element handles of the accessible tests,
  with no features:
  no software renderer and no Skia,
  and its `headless` backend is not selectable
  (the selector feature `backend-testing` is off).
- `cargo check --frozen --features slint/mcp --bin monochromatic-ide` still compiles.

What remains linked,
and why:

- The opt-in inspection builds that pass `--features slint/mcp` (`mcp`,
  `inspect:native`,
  `bin/inspect-idle-cost.mjs`,
  `bin/inspect-log-stall.mjs`) link the software renderer again,
  because Slint's MCP server takes its screenshots with it and the selector feature `mcp` turns it on.
  `mise run mcp` also defaults to `SLINT_BACKEND=headless`,
  which draws the application on the CPU in that run.
  These are developer inspection runs of the debug binary,
  not tests,
  and not the release binary.
  They were left as they are;
  whether to keep them is an owner question below.

### Gates of stage 0b

Run on the final head of the branch:

- `mise run //package/desktop-app/ide:lint:clippy` (`cargo clippy --all-targets -- --deny warnings`):
  passes (`Finished dev profile ... in 4.40s`).
- `mise run //package/desktop-app/ide:lint:rustfmt`:
  passes,
  no output.
- `mise run //package/desktop-app/ide:lint:slint`:
  passes.
- `mise run //package/desktop-app/ide:lint` exits 1 at `monochromatic-lint` with three `markdown/semantic-line-breaks`
  errors,
  all in files this branch does not touch:
  `src/native/tile_build/pass_tests.rs` (lines 11 and 29) and `src/native/tile_pass.rs` (line 87).
  (The stage 0 text calls the first file `src/native/pass_tests.rs`.)
  The branch's own finding,
  in a doc comment of `annotation_stability_tests.rs`,
  was fixed in `bbdfbc5402`.
  The task stops at that command,
  so its last command,
  `lint:slint`,
  was run alone (above).
- `mise run //package/desktop-app/ide:inspect:software-renderer`:
  `Slint software renderer is not linked into the application or the test builds`.
- `mise run //package/desktop-app/ide:test:native`,
  twice in a row on `361756fd92`:
  `Summary [ 162.073s] 214 tests run: 214 passed (1 slow), 5 skipped` and
  `Summary [ 142.410s] 214 tests run: 214 passed (1 slow), 5 skipped`.
  Later runs of the same head that failed are under "Failures that came and went".
- `mise run //package/desktop-app/ide:build` (release binary):
  `Finished release profile [optimized] target(s) in 49.00s`;
  the binary `target/release/monochromatic-ide` (82,956,968 bytes) contains no `i-slint-renderer-software` path
  string,
  and contains `i-slint-renderer-femtovg` six times.

### Run time

The full native suite,
default invocation (21 test processes),
took 141.1 s (nextest summary,
one run)
with the headless backend on 2026-10-20 before the change.
On the GPU platform the 17 passing parallel runs on the final head took 141.4 s to 162.1 s
(median 142.4 s);
the two gate runs took 162.1 s and 142.4 s.
The sum of the 214 per-test durations is 655.3 s on the GPU platform (one gate run)
and 704.2 s with the headless backend,
so the suite did not get slower.
The longest test,
`tall_window_tests::no_window_size_or_scale_makes_a_raster_past_the_limit`,
sets the wall time in both (about 125 s to 132 s).
The invocation with a filter runs one test at a time and took 410.3 s to 427.3 s (20 runs),
560.1 s once
while the host was busy with other sessions;
that is not comparable to the default invocation.
An earlier reading of the filtered runs as a threefold slowdown from 21 devices opened at once was wrong:
those runs were serial.

## Stage 2: the application on FemtoVG over wgpu

Stage 2 of the migration in `doc/planning/ide-vello-text.md` (design C).
Done on 2026-10-20 on the owner's host (AMD Radeon RX 7600 as the discrete GPU,
the Raphael integrated GPU,
llvmpipe in the Vulkan loader's list,
Mesa 26.2.4) with repository tasks,
in the branch `worktree-agent-a1b70500a2a370d0d`
(commits `80267c11b4`,
`8e473701eb`,
`45c612440b`,
`f322b7f0bb`,
`c5515deb56`).
The application now draws with Slint's FemtoVG renderer over wgpu 30 on the Vulkan backend,
on a device the launcher opens itself.
The OpenGL renderer is gone from the application.

### What changed

- `Cargo.toml`:
  the `slint` dependency lists `renderer-femtovg-wgpu`,
  `unstable-wgpu-30` and `unstable-winit-030`,
  and no longer lists `renderer-femtovg` (the OpenGL variant).
  The dev-dependency entry that held `renderer-femtovg-wgpu` and `unstable-wgpu-30` for the harness is removed,
  so each feature is declared once,
  in the dependency the application uses.
  `unstable-winit-030` is new:
  it is the `BackendSelector::with_winit_window_attributes_hook` that stamps the Wayland app id
  while the selector also carries the wgpu device (the selector is Slint's public way to pass `WGPUConfiguration`;
  `RequestedGraphicsAPI`,
  the type the winit backend's own builder takes,
  is documented as an internal enum).
  It adds no package.
  `Cargo.lock` only lost entries:
  `gbm`,
  `gbm-sys`,
  and edges from the DRM backend to `glutin` and `raw-window-handle`,
  plus one edge from `slint` to `i-slint-backend-winit`.
  Linked crates (`linked-crates` task):
  367 before,
  385 after (22 added:
  wgpu 30 with `wgpu-core`,
  `wgpu-hal`,
  `naga`,
  `ash`,
  `glow`,
  `khronos-egl`,
  `gpu-allocator`,
  `spirv`,
  and their helpers;
  four removed:
  `glutin`,
  `glutin_egl_sys`,
  `glutin_glx_sys`,
  `glutin-winit`).
  `glow` and `khronos-egl` are there because wgpu's GL backend is compiled in;
  the launcher's instance lists Vulkan adapters only.
- `src/gpu_device.rs` (new,
  with `src/gpu_device_tests.rs`):
  `open_hardware_device` lists the Vulkan adapters,
  keeps `DiscreteGpu` and `IntegratedGpu` (discrete first,
  listing order breaks ties),
  refuses every other kind,
  requests a device with `wgpu::Limits::default().using_resolution(adapter.limits())`,
  tries the next hardware adapter when one refuses,
  and returns an error that names the adapters seen and every remedy when none works.
  It is the harness's code,
  moved,
  with the choice made testable from adapter descriptions.
- `src/launcher.rs`:
  opens that device,
  logs the adapter and two limits at info level,
  and installs the winit backend through `BackendSelector` with `backend_name("winit")`,
  `renderer_name("femtovg-wgpu")`,
  `require_wgpu_30(WGPUConfiguration::Manual { instance, adapter, device, queue })` and the app id hook.
  The early return for `SLINT_MCP_PORT` is gone:
  with it the inspection builds (`inspect:native`) bypassed the launcher,
  and a run of `inspect:native` showed that the inspection server also starts when the launcher installs the platform
  (`slint::platform::set_platform` calls `init_testing_backends`,
  `slint-1.18.1/lib.rs:443`;
  the log of `inspect:native` has `Slint MCP server listening on http://127.0.0.1:9318/mcp`
  and the launcher's adapter line).
- `src/native/gpu_snapshot.rs`:
  opens its device through `gpu_device` (`hardware_rank` and `open_hardware_device` were removed there).
- `README.md`:
  new section "Renderer and GPU",
  and the launcher-entry paragraph about `SLINT_MCP_PORT` corrected.

### Why the launcher opens the device

Read in the installed sources,
then run:

- Slint's automatic path does not refuse CPU adapters.
  `async_init_instance_adapter_device_queue_surface` (`i-slint-core-1.18.1/graphics/wgpu_30.rs`) requests the adapter,
  in both of its
  branches,
  with a power preference that comes from `WGPU_POWER_PREF` (default `None`) and `force_fallback_adapter: false`.
  In `wgpu-core-30.0.1/src/instance.rs` the CPU filter exists only for `force_fallback_adapter: true`
  (lines 511 to 525),
  and `PowerPreference::None` does not sort (lines 571 to 579),
  so the first adapter the Vulkan loader lists wins.
  This host lists RADV,
  RADV,
  llvmpipe,
  so it would pick the RX 7600 today,
  but nothing guarantees the order.
  Slint's own check `any_wgpu30_adapters_with_gpu` (same file,
  lines 180 to 241) only asks that some adapter is not of the CPU kind,
  and `SLINT_WGPU_CPU` switches it off.
- Slint's default limits depend on the path:
  `WGPUSettings::default()` requests `Limits::downlevel_webgl2_defaults()` (line 66),
  which the study found crashes Vello (no storage buffers),
  while the path with no configuration requests `adapter.limits()` (line 277).
  The launcher states its limits itself,
  as the harness does.
- Two refusals were run on the release binary with `VK_DRIVER_FILES`:
  the lavapipe driver file gave `Adapters seen: llvmpipe (LLVM 22.1.8, 256 bits) (Cpu, llvmpipe)` and the full message,
  exit status 1;
  a missing file gave `Adapters seen: none (the Vulkan loader found no driver at all)`,
  exit status 1;
  with `SLINT_WGPU_CPU=1` added to the lavapipe run the message was the same.
- Guard run (GFP):
  the seven `gpu_device` tests and the three launcher tests were committed first,
  then each guard was removed in the working tree and restored from the commit afterwards.
  Accepting `DeviceType::Cpu` in `hardware_rank` made three of the seven `gpu_device` tests fail,
  and accepting any winit renderer in `choose_backend` made one of the three launcher tests fail
  (4 of 10 failed,
  6 passed);
  restoring gave 10 of 10.
  The same removal in a debug binary,
  run in the nested compositor with the lavapipe driver file:
  with `SLINT_WGPU_CPU` unset,
  Slint's own check then refused (`Cannot install the window backend:
  WGPU 30.x rendering was required
  but no GPU-backed WGPU adapter is available`);
  with `SLINT_WGPU_CPU=1` the application started and logged `adapter=llvmpipe (LLVM 22.1.8, 256 bits) (Cpu, llvmpipe)`.
  So the guard in `gpu_device` is the only thing between the application and a CPU adapter when `SLINT_WGPU_CPU` is set.

### Can `renderer-femtovg` (OpenGL) go

Yes,
and it was dropped.
Reading:
with both features enabled the winit backend never picks the OpenGL renderer by itself.
`default_renderer_factory` prefers `renderer-femtovg-wgpu` (`i-slint-backend-winit-1.18.1/lib.rs:139`),
and the fallback list that `create_window_adapter` uses when the chosen renderer fails builds the OpenGL entry only when
`renderer-femtovg-wgpu` is off (line 179).
So the OpenGL feature could not serve as an automatic fallback in this Slint version;
it would only add an explicit opt-in (`SLINT_BACKEND=winit-femtovg`) that draws through OpenGL and EGL.
Measured:
the application builds and runs without it,
`lint`,
`test:native` and the nested-compositor runs of this section pass,
the linked set lost four crates (the `glutin` family) and the lock two (`gbm`,
`gbm-sys`),
and the cold builds took 5.6 s (release) and 4 s (debug) longer in single runs (numbers in the verification section).
The baseline screenshot (OpenGL,
`Slint: ... FemtoVG renderer with OpenGL backend`) and the new one (`FemtoVG renderer with WGPU backend`)
of the same state differ in 28 of 726,000 pixels,
by one channel level at most.
What it costs:
a host that has an OpenGL driver for its GPU but no Vulkan driver (older GPUs,
some virtual machines)
can no longer start the IDE.
Nothing in the repository needs that path (the IDE is Linux only through its inotify watcher,
and every check runs on this host's GPU).
This is the owner's rule applied,
not a decision to keep a CPU-capable path,
so it is recorded here and not asked;
the owner can overrule by adding `renderer-femtovg` back,
which would not change the default.

### `SLINT_BACKEND`

The launcher reads the value as Slint does (lowercase,
split at the first dash,
with Slint's single-word shorthands).
Unset,
`winit`,
`gl` and `winit-femtovg-wgpu` start the application as described in this section.
Another backend (`qt`,
`linuxkms`,
`headless`) stays with Slint's selector,
with no app id and no adapter policy,
as before.
A winit renderer this build lacks (`femtovg` and `winit-femtovg` are the OpenGL one,
and `skia`,
`software`,
`vello`)
is an error naming the accepted spellings.
Without that,
Slint prints `unrecognized renderer ..., falling back to FemtoVG` (`i-slint-backend-winit-1.18.1/lib.rs:1311`)
and draws with its default renderer on a device it chose itself.
`inspect:native` and `inspect:cadence` set `SLINT_BACKEND=winit`,
which is accepted.
`WGPU_ADAPTER_NAME` and `WGPU_POWER_PREF` no longer have an effect on the application (the launcher does not read them).

### An abort at exit in debug builds, found and fixed

The first debug runs of the new launcher ended with
`cannot access a Thread Local Storage value during or after destruction: AccessError` and
`fatal runtime error: thread local panicked on drop, aborting` after the window closed
(two of two debug runs without the fix:
`inspect:native` on the RX 7600 and a debug run on llvmpipe;
no release run showed it).
The cause is the one the harness already documents:
wgpu-core's snatch lock records a thread-local trace in debug builds
(`wgpu-core-30.0.1/src/snatch.rs:106` to `128`,
`cfg(all(debug_assertions, feature = "std"))`),
and the dependencies of a dev build
keep `debug-assertions` on,
while Slint drops its platform,
and the last wgpu handles with it,
during thread-local destruction.
The launcher now leaks one extra handle of the instance,
adapter,
device and queue (`Box::leak`),
as the harness leaks its device.
After the fix,
nine debug runs closed cleanly (one session run,
four cadence runs,
four startup runs).

### Verification by running

All in the repository's nested compositor (`monochromatic-nested-wayland-session` 0.6.1,
scale 1),
project `/tmp/drag-project`,
file `src/client.unit.test.ts` (489 lines),
1100 by 660 unless a size is named.
The adapter in every run of the new code was `AMD Radeon RX 7600 (RADV NAVI33) (DiscreteGpu, radv)` with
`max_storage_buffers_per_shader_stage=8` and `max_texture_dimension_2d=16384`
(the downlevel default would give 0 storage buffers,
so the limits took effect).
The baseline runs say `FemtoVG renderer with OpenGL backend` (Mesa radeonsi on the same card,
from the compositor's parent session).
The baseline is `origin/main` (`d282b33948`) built in a scratch worktree,
whose IDE package equals this branch's parent.
Every claim of a difference in this section is held against the spread of two runs,
as the README's cadence section demands.

Screenshots viewed (`~/temp/agent/ide-stage2/shots/`,
the paths are under the scratch root):

- `native-dark-1-start.png` and `native-dark-2-tree-click.png`:
  dark scheme,
  the file tree (a folder expanded by a click,
  the selected file in the accent colour,
  the focus ring on the clicked row),
  the source with syntax colours,
  the language server's
  error rows and underlines,
  line numbers,
  and the minimap with its viewport box.
- `native-dark-3-hover.png`:
  the hover popup (`No hover information at this position.` for the TypeScript server at that caret).
- `native-dark-4-find.png`:
  the find bar with `fetch` typed,
  the match selected,
  `1/87`,
  and the match marks in the minimap.
- `native-dark-5-scrolled.png` and `native-dark-6-minimap-drag.png`:
  after a scroll of 1500 pixels and a drag of the viewport box;
  the text moved to line 309 and the box followed.
- `native-light-1.png`,
  `native-light-2-find.png`,
  `native-light-3-hover.png`:
  the same after `color-scheme light`
  switched the private appearance while the client ran:
  light tree,
  light find bar with a match counter `13/66`,
  inlay hints between rows,
  and the hover popup.
- `adapter-base/before.png` and `adapter-new/before.png` (under the scratch root):
  baseline and new after the same start,
  28 pixels of 726,000 differ.

Cadence (`inspect:cadence`,
120 steps of 16 ms,
`RUST_LOG=info`,
interleaved baseline and new,
two runs each,
load average 1 to 3).
Each cell is changed frames of frames compared,
then the longest run of identical frames,
then the slots of the identical runs.

- Release,
  scroll:
  baseline 118 of 119 (1,
  at 58) and 116 of 119 (1,
  at 58,
  123 and 145);
  new 117 of 119 (1,
  at 58 and 80) and 117 of 119 (same).
- Release,
  drag:
  baseline 117 of 119 (1,
  at 41 and 68) and 117 of 118 (1,
  at 41);
  new 117 of 118 (1,
  at 41) and 117 of 119 (1,
  at 41 and 137).
- Debug,
  scroll:
  baseline 116 of 117 (1) and 114 of 119 (1,
  five single frames);
  new 116 of 119 (1,
  three) and 117 of 119 (1,
  at 58 and 80).
- Debug,
  drag:
  baseline 106 of 120 (1,
  fourteen single frames) and 107 of 119 (1,
  twelve);
  new 103 of 118 (2,
  at 39,
  then thirteen singles) and 106 of 119 (2,
  at 39,
  then eleven singles).
- Release at 1147 by 2000,
  the owner's drag size:
  scroll baseline 118 of 119 (1) twice;
  new 118 of 118 and 118 of 119 (1);
  drag baseline 120 of 121 (1,
  at 105) twice;
  new 120 of 121 (1,
  at 105) twice.

The spread between the two runs of one build is up to 2 changed frames in the release scroll (baseline 118 and 116),
0 in the release drag,
up to 2 in the debug scroll (baseline 116 and 114),
and in the debug drag 1 for the baseline (106 and 107) and 3 for the new code (103 and 106).
In every cell the ranges of the baseline and of the new code overlap.
The new code's debug drag is lower by about 2 to 3 changed frames at the median (104.5 against 106.5),
which is as large as its own run-to-run difference,
so no difference between baseline and new is claimed.
The longest identical run is 2 in both debug drag runs of the new code and 1 in all other cells,
a single sample in each.
The probe can move:
debug against release (drag:
12 to 15 identical frames of about 120 in debug against 1 to 2 in release,
for both builds) is the positive control of the cadence task,
and it moved here too.
No debug run of the new code had the frozen stretch of 5 to 9 frames that the unoptimized stage 1 debug build had.

Startup and memory (`session.mjs` in the scratch root,
release builds,
fifteen runs each,
interleaved,
a fresh private cache and
config directory per run,
warm file cache):

- Method:
  the compositor logs the moment it spawns the client and the application logs its frames at the debug level
  (`monochromatic_ide::native::frame`);
  first frame is the first `the toolkit finished drawing a frame` minus the spawn stamp.
  Resident memory is `VmRSS` and `VmHWM` of the client's pid from `/proc` eight seconds after the spawn
  (idle) and 1.5 s after three scrolls of 3000 pixels (60 steps each).
- First finished frame:
  baseline median 328.1 ms (321.8 to 356.9),
  new median 350.4 ms (344.7 to 371.4),
  about 22 ms later (7 percent).
  The ranges overlap by 12 ms,
  so the claim is a median shift of about 20 ms,
  not more.
  The window's first size event is the same (314.3 against 311.0 ms medians).
  The launcher's adapter line comes 54.2 to 61.0 ms after the spawn in every one of the fifteen new runs
  (Vulkan loader start,
  driver load and the two device requests).
- Idle resident memory:
  baseline median 155.1 MiB (154.5 to 162.5),
  new median 135.6 MiB (134.3 to 142.8),
  20 MiB less.
  After the scrolls:
  baseline 170.7 MiB (161.5 to 177.6),
  new 144.3 MiB (135.8 to 156.6).
  Peak (`VmHWM`) after the scrolls:
  baseline 181.0 MiB (174.6 to 188.7),
  new 156.6 MiB (150.4 to 159.5).
  Threads:
  28 or 29 for the baseline,
  26 for the new code.
- GPU memory (`mem_info_vram_used` of the RX 7600,
  system wide,
  includes the desktop and the compositor):
  6821.6 MiB with the baseline
  and 6998.8 MiB with the new code in every run,
  so the wgpu path holds about 177 MiB more than the OpenGL path
  (identical in all fifteen runs of each,
  but the counter is shared and was never trusted to better than 50 MiB in the study).
- Debug builds,
  four runs each:
  first frame baseline 365.1 to 401.5 ms,
  new 386.2 to 419.5 ms;
  idle RSS baseline 161.1 to 161.8 MiB,
  new 143.7 to 144.7 MiB;
  after the scrolls baseline 176.6 to 186.9 MiB,
  new 150.6 to 166.7 MiB;
  peak baseline 187.4 to 192.0 MiB,
  new 166.7 to 168.0 MiB.
- A single cold start (first run after a build,
  driver libraries not yet in the page cache) took 2.4 s to the first frame with the new code;
  every warm run took 0.35 s.
  The baseline's cold start was not measured,
  so no claim is made about the cost of a cold start against it.

Builds (`build` and `build:debug` tasks in a scratch worktree with the runtime copied in,
one run each,
cold target directory):

- Release:
  baseline 49.2 s,
  new 54.8 s (the first `build` task of the branch took 53.8 s).
- Debug (the dev profile builds dependencies at `opt-level = 2`):
  baseline 65 s,
  new 69 s.
  Incremental after touching `src/launcher.rs`:
  baseline 2.8 s,
  new 3 to 5 s (2.7,
  3.1,
  3.5,
  3.7 and 4.9 s in five runs).
  These are single runs with no measured spread,
  so they show that the wgpu stack does not make the debug build slow
  (a cold debug build of the whole stack is about 4 s longer,
  and the incremental one a few seconds),
  not a precise difference.
- Binaries:
  release 82,957,008 to 90,123,280 bytes (plus 7.2 MB),
  debug 102,398,656 to 111,224,824 bytes.

### Gates

All as repository tasks on the final head of the code (`c5515deb56` for the sources),
with the tails in the scratch root (`gate-*.log`):

- `lint`:
  exit 0 (`clippy`,
  `rustfmt`,
  `monochromatic-lint`,
  `slint`).
  Its first runs found,
  and the commits fixed,
  a rustfmt import order,
  rustdoc missing on the two test sidecars,
  two avoidable closures (`sort_by` and `map_err` now take named functions),
  and line breaks in the README section.
- `test:native`:
  224 tests (214 plus the ten new ones),
  two consecutive passes at the head:
  `Summary [  24.681s] 224 tests run: 224 passed, 5 skipped`
  and `Summary [  24.877s] 224 tests run: 224 passed, 5 skipped`.
  Six more interleaved pairs of full runs,
  baseline against new,
  all passed (baseline 23.8 to 24.1 s,
  new 24.1 to 24.3 s).
  The first full run of the head failed once:
  `native::minimap_tests::an_external_edit_of_fifty_thousand_lines_renders_only_the_band_it_touches`
  (`the edit rendered 4 of 4 bands`);
  it passed alone three times in a row and in the eight full runs after it.
  It is a minimap picture test that does not use the GPU,
  of the family of load dependent failures the stage 0 and 0b sections list.
  One failure in nine full runs of the new code against none in seven of the baseline is not a measurable difference.
- `test:bin`:
  54 tests passed.
- `build` (release):
  `Finished release profile [optimized] target(s) in 17.05s` after the doc commits (53.8 s the first time).
- `inspect:software-renderer`:
  `Slint software renderer is not linked into the application or the test builds`.
  Positive control:
  the same `cargo tree` with `--features slint/mcp` in a scratch copy printed the tree through `i-slint-backend-testing`
  and the task failed,
  so the check can fail.
- `inspect:native` and `inspect:cadence` ran as the tasks are written (see the verification by running).

### Open owner questions of stage 2

- Is the loss of hosts with OpenGL but no Vulkan driver for a hardware GPU accepted?
  Nothing in the repository needs it,
  and the OpenGL renderer could not have been an automatic fallback anyway (see the section on the OpenGL renderer).
- `unstable-winit-030` was added for the `BackendSelector` hook.
  The alternative is a direct dependency on the internal crate `i-slint-core`,
  to call the winit builder with `RequestedGraphicsAPI`.
  Both are semver-exempt,
  neither adds a package,
  and the feature is the documented one.
- Virtual GPUs (`DeviceType::VirtualGpu`,
  for example Venus in a virtual machine) are refused with the CPU and unknown kinds,
  as the harness has always done.
  They are accelerated on the host,
  so they are not CPU painting,
  but they cannot be told from a software device by type.
  Should they be accepted at the lowest rank?
- The discrete GPU is preferred over the integrated one,
  and the choice is not checked against the window's surface
  (Slint's `get_default_config(..).unwrap()` in `i-slint-renderer-femtovg-1.18.1/wgpu.rs:408`
  would panic if the chosen adapter could not present).
  That worked on this host in every run;
  on a laptop with a discrete GPU that cannot present to the compositor's screen it may not.
  `WGPU_POWER_PREF` and `WGPU_ADAPTER_NAME` are not read,
  so a user cannot steer the choice today.
- The inspection builds that pass `--features slint/mcp` (`inspect:native`,
  `mcp`) still link the software renderer
  (the open question of stage 0b is unchanged).
  The software renderer is linked there for the inspection server's screenshots,
  and no run here requested one.

### Not proven

- Only this host and its two AMD GPUs were used:
  no Intel or NVIDIA,
  no laptop with a hybrid GPU,
  no machine where the discrete GPU is not the one driving the screen,
  and the integrated GPU was never chosen.
- The cold start cost against the baseline,
  and the first-frame difference on a host with a cold shader cache
  (each of my runs used a fresh private `XDG_CACHE_HOME`,
  so Mesa's shader cache was cold in each,
  and the first frame still took 0.35 s).
- Accessibility,
  input methods,
  resize and multi-monitor behaviour under the wgpu renderer were not exercised beyond
  the existing native tests (which run the GPU harness,
  not the application's window) and the screenshots of the verification section.
- Scale factors other than 1,
  and 50,000 line files,
  were not run in the application.
- A soak of the wgpu renderer (surface loss,
  suspend and resume,
  a GPU reset) was not done.
- The `lsfg-vk` Vulkan layer is installed on this host
  and printed `lsfg-vk: Placing default configuration file` in every new run;
  its influence on the numbers was not isolated.

## Open owner questions

- Is lavapipe ever acceptable as a fallback when no GPU is present (for example a CI runner)?
  Measured here:
  it works,
  3 times slower on one test,
  but it is CPU rasterization;
  the default answer built in is no.
- `test:native` now needs `/dev/dri` and a hardware GPU on whatever machine runs it.
  Is that acceptable for CI,
  or should the GPU tests be a separate task (for example `test:gpu`) with its own filter?
- Is the widened container isolation (render nodes passed through,
  GPU memory uncapped) acceptable?
- The two harness choices that were not asked:
  the device is requested with `wgpu::Limits::default()` (full limits,
  as accepted for the application) and the discrete GPU is preferred over the integrated one.
  Hashes were compared across two Mesa versions on the discrete GPU and a compositor image drawn on the integrated one,
  for one simple component;
  pixel equality across GPU vendors is not known.
- The debug inspection builds that pass `--features slint/mcp` (`mcp`,
  `inspect:native`,
  idle cost and log stall
  scripts) link the software renderer again,
  because Slint's MCP server screenshots through it,
  and `mise run mcp` draws the application on the CPU by default (`SLINT_BACKEND=headless`).
  Under the rule that nothing in the IDE paints on the CPU,
  should those tasks go,
  change to a renderer-free inspection,
  or stay as developer-only tools?
- The eleven guard inspection scripts now need `/dev/dri` too,
  like `test:native`.
  They were edited but not run.

## Not proven

- Only one component was compared with the nested compositor;
  the full IDE window was not.
- Run-to-run spread of one component was measured on one device (21 renders,
  two processes);
  for the suite,
  only wall times (19 parallel runs) and pass or fail were recorded,
  not pixel hashes.
- The cause of the one interior-row failure of the rigid scroll test is not found,
  and the flake rate of the parallel run was not compared with the software path under the same load
  (see "Failures that came and went").
- The clip-edge mechanism behind the one-level difference was read in FemtoVG's shader,
  not isolated,
  and the relaxed last row is covered by the guard run only indirectly.
- The eleven guard inspection scripts were edited and not run.
- In the guard run of the selection ink tests the loop stopped at the dark scheme,
  so a failure of the light scheme under dark ink was not observed.
- The integrated GPU was not used as the harness device.
- Nothing about Skia,
  or about other GPU vendors or drivers,
  is claimed.
