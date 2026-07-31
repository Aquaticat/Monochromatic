# Nested Wayland session: empirical spike results

On-host measurements taken to settle the difficulty and technology questions for issue #272,
 on the owner's
Bazzite host (KDE Plasma,
 AMD Radeon RX 7600 / radeonsi,
 Mesa 26.1,
 Wayland session `wayland-0`).
These are the evidence layer the desk audits cannot produce:
 what the real app and a real compositor actually
do on the hardware,
 not what the source implies.

## The app presents through dmabuf, not SHM (decisive)

Ran the prebuilt `package/music-player/desktop-app/target/release/music-player` against the fixtures folder in
the host's real GPU session with `WAYLAND_DEBUG=1` and `SLINT_BACKEND=` (winit + femtovg),
 isolating XDG dirs,
loaded paused.
 Counting the protocol dump:

- Buffer-provider globals the client bound:
   `wl_shm` and `zwp_linux_dmabuf_v1`.
- `zwp_linux_buffer_params` (dmabuf) buffer events:
   many.
- `wl_shm_pool.create_buffer` (SHM) events:
   zero.
- `zwp_linux_dmabuf_feedback` modifier-negotiation events:
   present (v4 feedback).

Conclusion:
 the GPU/winit render path presents through `zwp_linux_dmabuf_v1` with v4 modifier feedback and
never uses SHM.
 A fixture that exercises the real GPU path must import dmabuf and run a GLES renderer.
An SHM-only compositor cannot host this app's GPU path.

## cage hosts the GPU app end to end (turnkey validation)

Ran `cage -- music-player fixtures` nested in KDE for several seconds,
 paused.
cage's wlroots brought up its GLES2 renderer on the real GPU and hosted the app to completion:

- `render/egl.c`:
   EGL 1.5,
   Mesa `radeonsi`,
   display extensions include `EGL_EXT_image_dma_buf_import` and
  `EGL_EXT_image_dma_buf_import_modifiers`.
- `render/gles2/renderer.c`:
   OpenGL ES 3.2,
   GL renderer "AMD Radeon RX 7600 (radeonsi,
   navi33)".
- The music-player logged normal startup (measure sweep,
   font scaling) and ran until the timeout's SIGTERM.
  The only errors were the `Broken pipe` at teardown,
   which is the SIGTERM tearing down the socket,
   not a
  functional failure.

Conclusion:
 cage does the hard dmabuf-GPU-compositor part with zero new code.
It is not selected only because it is not `mise`-installable (see the decision doc).

## smallvil is SHM-only and needs dev packages to build here

Built Smithay's `smallvil` example (authorized).
It compiled but failed at the final link with `rust-lld: error: unable to find library -lxkbcommon`:
a source build on this host needs `libxkbcommon-devel` (and the wayland and EGL headers),
 the same class of
dev-package friction the niri troubleshooting doc records,
 though far smaller than niri's set.
This is moot given the project builds Rust binaries in containers.

Reading `smallvil/src/state.rs` confirmed it wires only compositor,
 xdg-shell,
 shm,
 output,
 data-device,
 and
seat state,
 with no `DmabufState`.
So smallvil is SHM-only and could not host the app's GPU dmabuf path even if it linked.
A Smithay fixture must add the dmabuf import and GLES renderer that `anvil` already demonstrates.

## Host tooling inventory (relevant to the compose-existing option)

Present:
 cage 0.3.0,
 gamescope 3.16.19 with gamescopectl,
 kwin_wayland,
 ydotool,
 wlr-randr,
 spectacle,
eglinfo,
 wayland-info,
 glxinfo,
 vulkaninfo,
 podman,
 rpm-ostree,
 flatpak,
 distrobox.
Absent:
 sway,
 weston,
 grim,
 slurp,
 wtype,
 wf-recorder,
 wl-screenrec.
GPU render node `/dev/dri/renderD128` present;
 runtime libs libEGL,
 libGLESv2,
 libgbm,
 libwayland-client,
libwayland-server,
 libxkbcommon all present.

## mise-installability check

`mise backends ls` includes `aqua`,
 `cargo`,
 `ubi`,
 `github`,
 `http`,
 and the distro bootstrap.
`mise registry` contains no entry for cage,
 gamescope,
 sway,
 weston,
 grim,
 wtype,
 ydotool,
 wf-recorder,
 or
wl-screenrec.
`gh release list` shows cage and sway ship only source tarballs and signatures,
 and gamescope publishes no
releases.
So no turnkey compositor or companion tool is `mise`-installable without the distro package manager.
