# Source audit: building blocks (Smithay), blit-compositor, and companion tools

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Desk audit of the build-our-own path and the small tools a compose-existing solution would need.
Findings are from reading cloned source (ephemeral clones under `/tmp/agent/`) plus package and GitHub API
metadata. No binary was built or run for this audit.

## Smithay building-block path

Smithay HEAD read at commit dated 2026-07-02.

### The dmabuf path lives in anvil, not smallvil

- smallvil is SHM-only: `smallvil/src/state.rs:16-20` wires compositor, xdg-shell, shm, output, data-device,
  and seat, with no `DmabufState`.
- anvil's winit backend is the complete dmabuf-v4 reference in one file of about 460 lines
  (`anvil/src/winit.rs`):
  - Renderer is `WinitGraphicsBackend<GlesRenderer>` via `winit::init::<GlesRenderer>()` (`winit.rs:55,100`).
  - dmabuf import: `DmabufState`, `DmabufGlobal`, `DmabufFeedback`, `DmabufHandler`, `ImportNotifier`
    (`winit.rs:41-46,57`); the handler calls `renderer().import_dmabuf(&dmabuf, None)` (`winit.rs:63-81`).
  - v4 feedback with a v3 fallback: it queries the render node via `EGLDevice::device_for_display(...)`,
    builds `DmabufFeedbackBuilder::new(node.dev_id(), formats)`, and calls
    `create_global_with_default_feedback(...)`, falling back to `create_global(...)` for v3
    (`winit.rs:146-182`). A comment at `winit.rs:168` notes "egl on Mesa requires either v4 or wl_drm".
  - The `ImportDma` trait is `src/backend/renderer/mod.rs:630-657`.

### Screenshot readback exists as a primitive

`ExportMem::copy_framebuffer(target, region, format)` returns a `TextureMapping`
(`src/backend/renderer/mod.rs:734-752`), with `map_texture` for the bytes (`:788`).
The GLES implementation uses a PBO plus `glReadPixels` (`src/backend/renderer/gles/mod.rs:1308+`).
anvil already depends on the `image` crate with the `png` feature, so PNG encode is a few dozen lines.
A protocol alternative (`ext-image-copy-capture-v1`) exists but is unnecessary for a fixture.

### Input injection is direct through the seat

anvil synthesizes events itself via `PointerHandle` and `KeyboardHandle`: `keyboard.input(...)`
(`input_handler.rs:156,175,684`), `pointer.motion`/`relative_motion` (`:669,920,960,1016`),
`pointer.button` (`:230`).
The seat is created in `state.rs:712-716`.
So the control socket maps directly: click is pointer motion plus press plus release; key is
`keyboard.input(keycode, state)`; text is char-to-keysym then per-char input.
This is in-process, scoped, with no kernel or global-input involvement.

### Keep versus drop for a minimal fixture

Keep: the winit-GLES-dmabuf block (`winit.rs`), the `DmabufHandler` (about 15 lines), the compositor,
xdg-shell, shm, output, and seat handlers (smallvil's smaller versions), `ExportMem` readback, and direct seat
injection.
Drop for a single-fullscreen-app fixture: the udev/DRM backend (`udev.rs`, 1,675 lines), the x11 backend
(`x11.rs`, 494), libei, all window-management grabs, multi-window focus, xwayland, and tiling.

### Runtime dependencies (all present on Bazzite)

`backend_winit` pulls winit, backend_egl, wayland-client, wayland-cursor, wayland-egl, renderer_gl
(`Cargo.toml:92,98`).
Runtime libraries: libwayland-client (dlopened), libwayland-egl, libEGL and libGLESv2 (dlopened via
libloading), libxkbcommon, libdrm.
The winit path pulls neither backend_gbm nor backend_drm.
The deferred headless variant would use `EGLSurfacelessDisplay` (`src/backend/egl/native.rs:263-272`) plus
`Offscreen<GlesRenderbuffer>` (`src/backend/renderer/gles/mod.rs:1539,1579`), needing only libEGL, libGLESv2,
libdrm.

### Version and churn (the main maintenance risk)

`Cargo.toml:3` declares 0.7.0, but anvil and smallvil use `path = ".."`, i.e. git, not crates.io.
crates.io history: 0.4.0 (2025-01-23), 0.5.0, 0.6.0, 0.7.0 (2025-06-24, latest), after a 3.5-year gap before
0.4.0.
The `## Unreleased` changelog section lists many breaking changes since 0.7.0.
Pin crates.io 0.7.0 and write against the stable API rather than copying anvil's git HEAD verbatim.

### Auditability

Smithay's own source is about 105,312 lines (shared, upstream-reviewed).
The fixture's own new code floor: smallvil is 1,370 lines and already covers the scaffolding; subtract its
move/resize grabs, add anvil's dmabuf-winit-GLES block (about 200 lines), a `DmabufHandler` (about 15), readback
plus PNG (about 40), synthetic injection (about 50), and a control socket (about 150 to 300).
Realistically about 1,000 to 1,500 lines of fixture-owned, auditable code.

### Effort characterization

Not a compositor-from-zero effort and not an open-ended slog, because the hard parts already exist and are
individually tiny in anvil.
Grafting anvil's winit dmabuf block onto smallvil's scaffolding plus a control socket and PNG encode is on the
order of days of contained work on the happy path.
Risk concentrates in, in order: headless-surfaceless rendering (deferred to issue #273), Smithay churn
(mitigated by pinning 0.7.0), and dmabuf-v4 negotiation (anvil already handles it, so smoke-test first).

## blit-compositor (indent-com/blit)

HEAD dated 2026-06-25; v0.35.2 (2026-07-01); MIT; 6 stars; active.

- Implements every fixture verb over a Unix-socket control protocol (`crates/cli/src/agent.rs`, transport
  `tokio::net::UnixStream`): `cmd_capture` (PNG or AVIF, with pre-capture resize), `cmd_click`, `cmd_key`,
  `cmd_type` (char-to-keycode with shift). Functionally a superset of the fixture.
- Does dmabuf on Vulkan, not SHM-only: `crates/compositor/` (13,856 lines) is a hand-rolled compositor on
  wayland-server plus ash, implementing `zwp_linux_dmabuf_v1` with feedback (`imp.rs:33-37`).
- Bloat: the workspace is 13 crates and 56,277 lines: Vulkan Video H.264/AV1 encode (2,525 lines), a WebRTC
  forwarder (3,986), PipeWire/Pulse audio, an embedded patched-alacritty terminal, an embedded browser, and
  more. There are 871 `unsafe` sites (412 in the compositor's Vulkan FFI alone).
- Builds to one binary that statically embeds all crates; runtime needs libvulkan and libwayland-server.
- Verdict: functionally usable but too heavy and too young for a minimal auditable fixture; it carries more
  unsafe Vulkan FFI than the entire from-scratch fixture would, plus features never exercised, on a low-scrutiny
  single-vendor project.

## Companion tools (for a cage or gamescope compose solution)

### cage is the linchpin host

cage 0.3.0 matches the session spec exactly (fork/exec, waitpid, exit-code propagation, terminate on exit) and
advertises screencopy, virtual-pointer, and virtual-keyboard.
gamescope is a poor host here: its protocol dir ships none of screencopy, virtual-pointer, or virtual-keyboard,
so grim and wtype do not work against it.

### grim (screenshot to PNG)

MIT; deps libpng, pixman, wayland-client; protocol wlr-screencopy.
The GitHub `emersion/grim` is archived at 1.4.0; the canonical repo moved to gitlab.freedesktop.org with 1.5.0
(the gitlab tags page was blocked by an anti-bot, so the 1.5.0 date is from secondary sources, unconfirmed).
In Fedora repos; otherwise a small C binary buildable in a container.

### wtype (text and key injection via virtual-keyboard-v1, scoped)

MIT; deps wayland-client, wayland-cursor, xkbcommon; a single `main.c`.
Dormant: last release v0.4 (2022-01-27), last push 2024-04-27, not archived. Tiny and stable but effectively
unmaintained.
Per-compositor scoped: under cage its events reach only the nested session. In Fedora repos.

### wlroots virtual-pointer plus virtual-keyboard (the clean scoped input path)

Both are wlroots types that cage advertises; events reach only that compositor instance, which is right for a
nested fixture.
Gap: wtype covers the keyboard half, but there is no equally standard standalone CLI for the pointer half, so a
small (about 100-line) virtual-pointer client is the recommended closer.

### ydotool (global uinput input)

AGPL-3.0 (copyleft, relevant if distributed); a client writes `input_event` structs to a socket and `ydotoold`
injects into `/dev/uinput`.
Because uinput is the kernel input layer, events reach whichever session has focus, not the nested cage, so on a
live host injected input can leak to the host session.
Present on Bazzite; active repo but last tagged release v1.0.4 (2023-01-30).

### wf-recorder and wl-screenrec (recording, only if frame sequences are needed)

wf-recorder: MIT, v0.6.0, active, C++, needs ffmpeg, uses wlr-screencopy, in Fedora repos.
wl-screenrec: Apache-2.0, v0.2.0, active, Rust, needs ffmpeg-next plus optional Vulkan, cargo/COPR only.
For PNG frame sequences, looping grim per frame is simpler and lighter than either.

## Companion shortlist (for the rejected compose-existing path)

cage as host, grim for screenshots, wtype plus a small custom virtual-pointer client for scoped input, with
ydotool as a global-scope escape hatch.
All MIT or permissive except ydotool (AGPL).
This path was not chosen because none of these tools is `mise`-installable.
