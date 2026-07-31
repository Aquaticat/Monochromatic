# Source audit: turnkey single-app compositors (cage, weston, sway, gamescope)

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Desk audit of the existing compositors that could host one Slint/winit/femtovg dmabuf GPU client.
Findings are from reading cloned source (ephemeral clones under `/tmp/agent/`) plus package and GitHub/GitLab
API metadata.
 No compositor was launched for this audit.

Fit ranking for this fixture:
 cage > weston > sway > gamescope.
All four are rejected for the fixture itself because none is `mise`-installable (see the decision doc);
 this
audit records why cage is the technical best-fit and why gamescope is a risky fit,
 for the rejected-alternatives
record.

## cage (cage-kiosk/cage, wlroots 0.20)

`Hjdskes/cage` now redirects to `cage-kiosk/cage`.

- Single-app,
   fullscreen,
   exit-on-child,
   native and best-fit.
  `spawn_primary_client` forks and execs the primary client and watches a pipe;
   `sigchld_handler` calls
  `server_terminate` then `wl_display_terminate` on hangup (`cage.c:95-112`,
   `:153-194`,
   `:650`),
   and the
  child exit code becomes cage's exit code (`cage.c:196-213`,
   `:683-686`).
  It detects the first output and ignores the rest (`cage.c:429-433`),
   and maximizes the primary view to the
  full output (`view.c:99-104`,
   `xdg_shell.c:172-178`).
- Screenshot:
   no native mechanism;
   advertises `wlr_screencopy_manager_v1` (`cage.c:517-521`),
   so needs grim.
- Input injection:
   no built-in CLI;
   advertises `wlr_virtual_keyboard_manager_v1` (`cage.c:562-569`) and
  `wlr_virtual_pointer_manager_v1` (`cage.c:571-578`),
   so needs wtype plus a virtual-pointer client.
- Output resize:
   runtime via `wlr-output-management` (`cage.c:535-544`,
   `output.c:336-426`),
   driven by an
  external wlr-randr client.
- Control surface:
   none;
   only Wayland protocols,
   no IPC.
- dmabuf:
   proper `zwp_linux_dmabuf_v1` via the wlroots renderer,
   validated end to end with this app
  (see the spike results).
- Native deps:
   direct meson deps are wlroots-0.20,
   wayland-server,
   xkbcommon,
   m;
   wlroots transitively links
  libinput,
   libseat,
   udev,
   libgbm,
   libdrm,
   libEGL.
- Maintenance:
   active and expert.
   v0.3.1 (2026-06-30);
   recent commits by Simon Ser and Kenny Levinsen
  (wlroots and wayland core maintainers);
   issues closed within days.
   Small maintainer set.
- Auditability:
   about 3,396 lines of C across 14 files,
   by far the smallest and easiest to trust.
- License:
   MIT.

## weston (freedesktop wayland/weston, headless plus kiosk-shell)

- Single-app,
   fullscreen,
   exit-on-child:
   native but config-driven.
  kiosk-shell fullscreens each toplevel (`kiosk-shell/kiosk-shell.c:304-317`),
   and `[autolaunch]` with
  `watch=true` terminates weston when the watched process dies (`frontend/main.c:5077-5090`).
  Driven by weston.ini rather than a clean `weston -- app` CLI.
- Screenshot:
   native.
   weston-screenshooter writes PNG via cairo (`clients/screenshot.c:413-460`),
   but into
  `$XDG_PICTURES_DIR` with a dated name,
   so it needs a small rename to hit an arbitrary path.
- Input injection:
   the most complete protocol (`weston-test.xml` has move_pointer,
   send_button,
   send_key,
  send_touch),
   but it is a tests-only module built `install: false`,
   so it needs a build-with-tests plus a
  custom `weston_test` client.
- Output resize:
   startup only (`--width`/`--height`),
   no runtime IPC.
- Control surface:
   none machine-readable.
- Native deps:
   the cleanest headless path.
   The headless backend links only EGL,
   libweston,
   cairo,
   and drm
  headers;
   a grep of `headless.c` finds no libinput,
   udev,
   libseat,
   or launcher.
  This is the only candidate whose headless path does not drag libinput/libseat/udev.
- dmabuf:
   proper `zwp_linux_dmabuf_v1` with feedback (`libweston/linux-dmabuf.c`),
   imported by the GL renderer
  (`libweston/renderer-gl/gl-renderer.c:4290`).
   Protocol-correct for the app,
   not empirically run.
- Maintenance:
   active and professional.
   Stable 15.0.1 (2026-04-24),
   pre-releases mid-2026,
   Collabora-maintained
  reference compositor,
   roughly six-month cadence.
- Auditability:
   about 120,950 lines of C (libweston plus frontend plus shells),
   large but modular and canonical.
- License:
   MIT.

## sway (swaywm/sway, headless backend plus swaymsg IPC)

- Single-app,
   fullscreen,
   exit-on-child:
   not built-in,
   the worst fit for the core mandate.
  sway is a general tiling session compositor and does not exit when a child dies (`sway/main.c:152-162`).
  Single-app fullscreen needs config,
   and exit-on-child needs an `exec sh -c 'app; swaymsg exit'` wrapper.
- Screenshot:
   no native;
   advertises `wlr_screencopy_manager_v1` (`sway/server.c:119`),
   needs grim.
- Input injection:
   built-in pointer over IPC (`seat cursor set/press/release`,
  `sway/commands/seat/cursor.c`),
   which gives click-at-coordinates;
   keyboard and text go through wtype via the
  advertised virtual-keyboard protocol.
- Output resize:
   runtime,
   the best of the four (`output mode WxH`,
   `sway/commands/output/mode.c:18`;
   headless
  outputs can be added and removed at runtime).
- Control surface:
   the gold standard.
   sway IPC returns JSON (`swaymsg -t get_tree/get_outputs/get_seats`,
  event subscriptions,
   command results).
- dmabuf:
   proper `zwp_linux_dmabuf_v1` (`sway/server.c:290`),
   the same wlroots path as cage.
- Native deps:
   wlroots-0.21,
   json-c,
   libpcre2,
   plus the cairo/pango/gdk-pixbuf stack for bars and backgrounds;
  libinput and libudev are conditional on the wlroots libinput backend.
   Heavier than cage.
- Maintenance:
   mature and very active.
   1.12 (2026-05-25),
   commits through mid-2026,
   large but triaged backlog.
- Auditability:
   about 46,025 lines of C for the core,
   larger than cage but widely deployed.
- License:
   MIT.

## gamescope (ValveSoftware/gamescope, Vulkan single-app nested compositor)

Host has 3.16.19;
 upstream latest tag 3.16.24.

- Single-app,
   fullscreen,
   exit-on-child:
   native.
  `LaunchNestedChildren` spawns the primary child and shuts down on its death by default
  (`src/steamcompmgr.cpp:8183`,
   `:8204-8280`);
   `--force-windows-fullscreen` forces nested-display size.
- Screenshot:
   native with an arbitrary path,
   the best screenshot of the four.
  `gamescope_control.take_screenshot(path, type, flags)` writes via `stbi_write_png`
  (`src/steamcompmgr.cpp:1153-1168`,
   `:3092`).
- Input injection:
   complete but needs a custom client or a build option (a private `gamescope_input_method`
  protocol,
   or a libeis server on `GAMESCOPE_EIS_SOCKET` gated on `HAVE_LIBEIS`);
   `gamescopectl` itself does
  not inject input.
- Output resize:
   startup only (`-W`/`-H`).
- Control surface:
   present but not JSON (`gamescope_control` plus `gamescope_private` convars,
   driven by
  `gamescopectl`).
- dmabuf:
   the one hard requirement is a risk.
  Verified in source:
   gamescope's wlserver advertises legacy `wl_drm` (`src/wlserver.cpp:2071`) and its private
  `gamescope_swapchain_factory_v2` (`:1039-1074`),
   but no `zwp_linux_dmabuf_v1`;
   every `zwp_linux_dmabuf_v1`
  reference is in the nested-client backend,
   not the server.
  The app presents through `zwp_linux_dmabuf_v1`,
   so under gamescope that protocol is absent,
   and whether Mesa
  falls back to `wl_drm` or needs the Gamescope WSI layer is unvalidated.
- Native deps:
   the heaviest.
   Vulkan plus glslang,
   static wlroots-0.19 with libinput and session enabled,
  required libinput,
   libudev,
   and luajit,
   SDL2,
   libavif,
   pixman,
   libdecor,
   libdisplay-info,
   libcap,
   and a large
  X11 client stack (steamcompmgr is an X11 window manager),
   plus optional libeis.
- Maintenance:
   active and corporate but game-focused,
   with no GitHub releases (tags only) and a large backlog.
- Auditability:
   about 54,176 lines of C++ plus Vulkan compute shaders,
   bundled ReShade,
   LuaJIT scripting,
   and
  an embedded X11 window manager,
   the largest trust surface of the four.
- License:
   BSD-2-Clause.

## Ranking rationale

- cage over weston:
   cage is validated end to end with this exact app,
   is far smaller and more auditable,
   and
  natively nails the hardest-to-glue mandate (exactly one app,
   fullscreen,
   exit-on-child with exit-code
  propagation).
   weston only edges it on native screenshot and cleaner headless deps.
- weston over sway:
   both need external tooling,
   but weston satisfies the core host mandate natively and has the
  cleanest headless footprint;
   sway is architecturally multi-window and must be bent into single-app.
  If the JSON IPC,
   built-in pointer injection,
   and runtime resize matter more than the host lifecycle,
   sway
  overtakes weston.
- sway over gamescope:
   sway advertises the proper `zwp_linux_dmabuf_v1` the app uses,
   is far smaller and more
  auditable,
   and has the best control surface;
   gamescope's missing `zwp_linux_dmabuf_v1` makes the one hard
  requirement risky and unvalidated,
   and its audit burden is the heaviest.
