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
209 of the 214 native tests pass;
a missing in-memory clipboard explained 2 of the
5 failures (fixed in the harness) and three tests need real adaptation or diagnosis (listed under "What blocks the other
files").

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
  so `llvmpipe` (installed by the same package) is not even listed.
- `Cargo.toml`:
  `slint` as a dev-dependency with `renderer-femtovg-wgpu` and `unstable-wgpu-30`.

Effects to know about:

- The container is no longer fully isolated from the host for `test:native`:
  it can use the host's render nodes.
  The mise.toml header says so.
  The podman memory and CPU bound does not cap GPU memory.
- A host without `/dev/dri` makes `podman run --device /dev/dri` fail before any test starts,
  for all of `test:native`.
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
  (The compositor composited on the integrated GPU,
  `renderD129`,
  so two different GPUs agree on this component.
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
- A removal in production code was not run:
  the tool permission layer refused an edit of
  `src/shaped_text/layout.rs` (the `FontWeight` default pushed to the Parley builder),
  because this task allows no change of
  production source.
  The coordinator can run that mutation;
  it should fail the same assertion.
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
  159.0 s.
  An earlier run stopped on `minimap_tests::fifty_thousand_lines_give_a_bounded_picture_without_blocking_the_window`
  (`173 lines were rendered for 4 bands`),
  a test that does not use the harness;
  it passed alone (0.44 s)
  and in the next
  full run,
  so it is a load-dependent flake that this branch did not cause (not investigated further).

## What blocks the other files

Experiment,
not committed:
a scratch copy of the package where every `#[test]` under `src/native` (216 tests in 57 files)
calls `install_gpu_platform()` first,
run as `cargo nextest run --features slint/mcp --bin monochromatic-ide --no-fail-fast`
with `--device /dev/dri` (12 test threads,
174.5 s;
the software baseline above used 21 threads).

- 209 of 214 passed with no other change.
- 5 failed.
  Two of them (`find_box_keeps_the_toolkit_editing_keys`,
  `find_box_context_menu_runs_each_entry`) failed because the
  platform had no clipboard (`"ca"` against `"caca"`);
  the harness now keeps one and both pass.
- 3 still fail and need adaptation or a look:
  - `query_input_tests::find_box_selection_uses_the_ink_chosen_from_the_fill` and
    `query_input_paint_tests::search_box_selection_uses_the_ink_chosen_from_the_fill_in_both_schemes`:
    the dark scheme's selected text range reports `darkest 0.165, lightest 1`,
    and the tests assert `darkest > 0.3`.
    Likely the glyph edges or the selection rectangle edge differ from the software renderer's;
    not diagnosed.
  - `annotation_stability_tests::scrolling_across_annotated_lines_is_rigid`:
    the frame at offset 115 is not the previous
    frame shifted by one row (window row 658),
    at the point where the overscan tile is re-centered.
    Either the tile image is sampled differently at the seam or the test's exact-shift premise does not hold on the GPU;
    this one deserves a diagnosis before the tile path is replaced,
    because the same premise guards the new row scene.

Which files hold the 13 other `take_snapshot` readers (counted by `grep`):
`annotation_paint_tests` (3 tests),
`find_tests` (3),
`font_tests` (1),
`minimap_tests` (16),
`search_pointer_tests` (1),
`search_tests` (3),
`sidebar_paint_tests` (2),
`sidebar_tests` (3),
`theme_tests` (2),
`tree_pointer_tests` (1),
`tree_scroll_tests` (1),
`wrap_resize_tests` (13) and `language/test_support.rs` (a fixture).
Most only call `take_snapshot` to force a layout and never read the pixels
(`search_pointer_tests`,
`tree_scroll_tests`,
`tree_pointer_tests`,
`find_tests`,
`search_tests`,
`sidebar_tests`,
`language/test_support.rs`);
the pixel readers are `annotation_paint_tests`,
`sidebar_paint_tests`,
`theme_tests`,
`minimap_tests` and `wrap_resize_tests`.

Estimate by reading,
not measured:
because plain `take_snapshot` works once the platform is installed,
a migration is an
import plus one `install_gpu_platform()` call in the fixture or the test,
two to six changed lines per file;
files with several tests and no shared fixture (`minimap_tests`,
`wrap_resize_tests`) take one call per test unless a
fixture is introduced.
Pixel readers may add a few lines of tolerance where the GPU differs from the software renderer by a pixel at an edge.
Dropping `renderer-software` entirely also needs the 46 test files under `src/native` that do not take snapshots to
stop using the
headless testing backend,
and `slint/mcp` (which pulls the software renderer through `i-slint-backend-testing`) to go
or to be accepted as test scaffolding;
the experiment shows the whole suite already runs on the GPU platform,
so that
step is mechanical.

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

## Not proven

- Only one component was compared with the nested compositor;
  the full IDE window was not.
- Run-to-run spread was measured for one component on one device (21 renders,
  two processes),
  not for the suite.
- The full-suite experiment ran once;
  test flakiness under the GPU platform was not assessed.
- The three remaining failures are not diagnosed.
- A production-code removal for the guard test was not run (see "Guard evidence").
- The integrated GPU was not used as the harness device.
- Nothing about Skia,
  or about other GPU vendors or drivers,
  is claimed.
