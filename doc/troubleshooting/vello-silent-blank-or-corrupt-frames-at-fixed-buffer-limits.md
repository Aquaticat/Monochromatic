# Vello 0.11 draws a blank or a corrupt frame, and reports success, when a scene passes its fixed buffer limits

Tool under test:
Vello 0.11.0 (`vello`,
`vello_encoding`,
`vello_shaders`) on wgpu 30 with the Vulkan backend (RADV on an AMD RX 7600),
used by `package/desktop-app/ide` to draw the code view into a texture.

## Symptom

Two separate failures share one cause:
Vello 0.11 sizes its working buffers with fixed numbers,
not from the scene,
and does not report a scene that does not fit.

- **Blank frame.**
  When a scene needs more lines,
segments,
tiles or command-list space than a buffer holds,
  a later stage returns early and the fine stage writes no pixel.
  The texture reads back as all `0,0,0,0`,
and `Renderer::render_to_texture` still returns `Ok(())`.
  The IDE selecting 58 or more rows of its tile hit this in a probe that copies the tile's clip structure
  (56 rows rendered,
58 did not).
- **Corrupt frame with `failed = 0`.**
  Every 16 by 16 pixel tile owns 64 `u32` in the command-list buffer (`ptcl`) before any dynamic allocation.
  That initial region is not checked against the buffer size.
  A 1113 by 16384 texture needs 4,587,520 elements;
  with `ptcl` set to 4,194,304 the render reported `failed = 0` and 290,992 bytes differed from the reference
  by up to 184 levels.
  At the default `ptcl` of 8,388,608 elements the limit is 131,072 tiles,
which is 128 MiB of RGBA8 texture.

## Cause

The seven bump buffers are literals in `vello_encoding-0.11.0/src/config.rs` (lines 398 to 408):
lines,
segments,
tiles and segment counts 1 << 21 elements,
`ptcl` 1 << 23,
blend spill 1 << 20,
bin data 1 << 18.
A comment there says they should be derived from the scene.
No public option changes them (`RendererOptions` in `lib.rs` has `use_cpu`,
`antialiasing_support`,
`num_init_threads` and `pipeline_cache`).

Each stage that bump-allocates tests its counter and sets a bit in `bump.failed`;
`path_tiling_setup.wgsl` then writes `ptcl[0] = ~0u` and `fine.wgsl` returns before writing a pixel.
`render_to_texture` reads the counters back only when `robust` is true,
which is `cfg!(feature = "debug_layers")`
(`lib.rs:732`);
a `TODO` at `lib.rs:764` names the missing rerun.

For the corrupt frame,
`alloc_cmd` in `vello_shaders-0.11.0/shader/coarse.wgsl` compares
`ptcl_dyn_start + atomicAdd(&bump.ptcl, ...)` with `config.ptcl_size` only when a tile needs more than its initial
`PTCL_INITIAL_ALLOC` (64) elements (`shared/ptcl.wgsl:6`).
A scene whose tiles all fit in their initial region never reaches that check,
so the initial region written past `ptcl_size` is not detected.
I read this shader myself;
the pixel counts above come from the probe described under evidence.

## Workaround

Keep each scene inside the buffers,
because nothing reports an overflow:

- Clip each rectangle to its own row's height,
never to the whole texture.
  A full-height clip costs about 36,700 tiles per selected row on a 1113 by 8160 texture;
  with row-height clips a select-all needs about 66,000 tiles instead of 12.5 million.
- Keep a texture at 128 MiB or less with the default `ptcl`,
or compute `ptcl` from the target size
  (at least 64 elements per tile plus the dynamic part).
  The IDE keeps its tile at 64 MiB or less.
- Keep a minimap slice under about 1,600 rows at one sixth scale (the default fails at 4,096 rows).
- Do not shrink the buffers by patching `vello_encoding` without the clip fix,
a computed `ptcl`
  and a way to detect failure.

The full study,
with the measurements,
the options and their ranking,
is `doc/planning/ide-vello-buffer-sizes.md`.

## Evidence and limits

- Source read:
the files and lines named above,
in `~/.cargo/registry/src/*/vello_encoding-0.11.0` and
  `vello_shaders-0.11.0`.
- Pixel measurements come from a headless probe,
`~/temp/agent/vello-buffers/probe` on the machine that found it
  (a scratch directory,
not in the repository),
written by a subagent;
  I did not rerun them.
- The blank frame was not yet reproduced in the IDE itself when this was written;
  an agent is reproducing it there (see `doc/handover/slint-ide-0x.md`).
- Only Vello 0.11.0,
only Vulkan on RADV.
- Upstream:
linebender/vello issues 366 and 541 and pull requests 606,
708 and 1861 concern buffer sizing
  and are open.
  Pull request 1861 adds configurable sizes without a retry and conflicts with the repository's current layout.
  No upstream issue was found for the unchecked initial `ptcl` region,
and none was filed.
