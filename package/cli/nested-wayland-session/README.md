# nested-wayland-session

A minimal single-app nested Wayland compositor for GUI testing.
It hosts exactly one Wayland client fullscreen on the real GPU (dmabuf) path,
photographs the framebuffer as a PNG,
 injects synthetic pointer and keyboard input,
and takes all of this over a small Unix-socket control API.

It is built on [Smithay][] and installs through `cargo`,
 so an automated test can give a
GUI app a private,
 deterministic screen on any machine,
 with no distro package manager
and no system-wide changes.

The full rationale,
 the on-hardware measurements,
 and the source review of every
alternative considered are recorded in
[`doc/decision/nested-wayland-session.md`](../../../doc/decisions/nested-wayland-session.md)
(issue #272).
 A plain-language overview is in
[`doc/planning/nested-wayland-session.md`](../../../doc/planning/nested-wayland-session.md).

## What it does

- Gives exactly one app a private nested screen and keeps it fullscreen.
- Runs the real GPU render path:
   it imports the client's `zwp_linux_dmabuf_v1` buffers
  (v4 modifier feedback,
   v3 fallback) into a GLES renderer,
   the same path a real user
  gets,
   so the app is checked the way it actually draws.
- Shuts down cleanly when the hosted app exits,
   propagating the app's exit code.
- Saves a screenshot of the current frame as a PNG when asked.
- Records a frame sequence at a steady 60fps that holds even when the hosted app is laggy
  or resource-hungry (with optional systemd CPU isolation of the app).
- Clicks at a point,
   presses keys,
   and types text into the app.
- Provides an isolated clipboard through wlr-data-control and ext-data-control,
  sharing the nested seat's regular clipboard with `wl_data_device` clients.
- Changes the nested screen size.
- Sets an integer or fractional output scale at startup and switches it while the app runs,
  so the app is seen re-rendering for another display scale.
- Serves a private dark or light appearance preference and switches it while the app runs,
  without touching the host desktop theme.
- Keeps the hosted app drawing when its own window is hidden or the host session is locked,
  so screenshots show the app's current frame.
- Answers every control command with a plain machine-readable `ok`/`err` line.

## Requirements

At build time (supplied by the Fedora build container,
 see [Building](#building-and-testing)):
`wayland-devel`,
 `libxkbcommon-devel`,
 `libdrm-devel`,
 plus a Rust toolchain.

At run time (present on virtually every Linux desktop):
 `libwayland-client`,
`libwayland-egl`,
 `libxkbcommon`,
 `libEGL`,
 `libGLESv2`,
 `libdrm`,
 `dbus-daemon` when `--color-scheme` is used,
 and a running parent
Wayland session (this version is a nested winit client of an existing compositor).

## Install

Through `mise` with the `cargo` backend:

```sh
mise use "cargo:monochromatic-nested-wayland-session"
```

A source build compiles the crate.
 To fetch a prebuilt binary instead of building from
source,
 use [`cargo-binstall`][]:

```sh
cargo binstall monochromatic-nested-wayland-session
```

## Usage

`--help` or `-h` prints generated help and exits successfully without opening Wayland.
`--version` reports the binary version without starting the compositor.
Clap handles parent options only until the child command begins:
`app --help` and `-- app --help` both forward `--help` to the child.
Unknown options before the child remain usage errors.
Clap uses exit 2 for usage errors instead of the former generic exit 1;
help/version use exit 0.
Joined values such as `--size=800x600` are also accepted.

```txt
monochromatic-nested-wayland-session [--socket PATH] [--size WIDTHxHEIGHT]
    [--scale SCALE] [--color-scheme dark|light] [--isolate]
    [--app-cpu-quota PCT] [--app-cpu-weight N] [--] COMMAND [ARG...]
```

- `--socket PATH` enables the control API on a Unix socket at `PATH`.
   Omitted,
   the tool
  just hosts the app with no control channel.
- `--size WIDTHxHEIGHT` sets the initial nested-screen size in logical pixels (default `1280x720`).
  At the default scale 1 a logical pixel is a physical pixel.
- `--scale SCALE` sets the initial output scale (default `1`),
  from `0.5` to `3` in steps of 1/120, such as `1.25`, `1.5`, or `2`.
  The `scale` control command switches it while the client runs;
  see [Change the output scale](#change-the-output-scale).
- `--color-scheme dark|light` gives the hosted client a private XDG Settings portal
  with deterministic appearance.
  It does not change the host desktop theme.
  The `color-scheme` control command switches it while the client runs.
- `--isolate` launches the hosted app inside a resource-controlled systemd scope so a
  greedy app cannot starve the capture pipeline (see [60fps recording](#60fps-recording)).
  It degrades to a direct launch,
   with a warning,
   when systemd is unavailable.
- `--app-cpu-quota PCT` overrides the app's CPU cap under `--isolate`,
   in percent of one
  core (`800` means eight cores' worth).
   Default:
   leave roughly a quarter of the machine
  free for the compositor.
- `--app-cpu-weight N` overrides the app's systemd `CPUWeight` (1 to 10000) under
  `--isolate`.
   Default:
   a low weight,
   so the app yields to the compositor under contention.
- `COMMAND [ARG...]` is the single client to host.
   Everything after `--` (or the first
  non-flag token) is the command,
   run with `WAYLAND_DISPLAY` pointed at the nested socket.

Host an app and drive it from a script:

```sh
# Terminal 1: start the compositor with a control socket.
monochromatic-nested-wayland-session --socket /tmp/nws.sock --size 800x600 -- my-app

# Terminal 2: drive it (any tool that speaks a Unix socket works; nc shown here).
printf 'screenshot /tmp/before.png\n' | nc -U /tmp/nws.sock   # => ok
printf 'type hello\nkey enter\n'      | nc -U /tmp/nws.sock   # => ok\nok
printf 'resize 500 400\n'             | nc -U /tmp/nws.sock   # => ok
printf 'screenshot /tmp/after.png\n'  | nc -U /tmp/nws.sock   # => ok
printf 'quit\n'                       | nc -U /tmp/nws.sock   # => ok
```

### Isolated clipboard

Hosted clients receive the nested `WAYLAND_DISPLAY` without inherited `WAYLAND_SOCKET`,
`DISPLAY`,
or `XAUTHORITY`.
This prevents clipboard libraries from falling back to the host X11 clipboard.
No host clipboard synchronization is provided.
Clients connected to the nested socket can exchange text and other MIME payloads.
Primary selection is not advertised,
and clipboard data is not persisted after its owner exits.

Use `mise run //package/cli/nested-wayland-session:inspect:clipboard` to verify the built release binary.
The task requires `wl-copy` and `wl-paste`,
launches a separate nested session,
checks text and binary round-trips,
clears each selection,
and checks clean producer shutdown.
It asserts child display isolation before touching any clipboard.

### Isolate dark and light appearance

Use explicit color schemes for GUI snapshots:

```sh
monochromatic-nested-wayland-session --color-scheme dark -- my-app
monochromatic-nested-wayland-session --color-scheme light -- my-app
```

The fixture starts a private session bus and minimal `org.freedesktop.portal.Settings` service,
then sets `DBUS_SESSION_BUS_ADDRESS` only for the hosted client.
The parent compositor and desktop environment remain untouched.
The private bus intentionally does not expose unrelated host session services,
such as notifications or file-chooser portals.
It also cannot start any:
its configuration has no service directories and no includes,
so a client's request to start a service fails at once with `org.freedesktop.DBus.Error.ServiceUnknown`,
and no program named in a host `.service` file runs.
Slint asks for the accessibility bus `org.a11y.Bus` this way and continues without it.
Use this option for deterministic appearance tests whose client does not need those services.
Without `--color-scheme`,
the hosted client inherits its usual session bus.

Normal shutdown removes the private socket directory.
A forced `SIGKILL` bypasses process cleanup and can leave its PID-named temporary directory behind.

#### Switch appearance while the client runs

Start with a control socket and either explicit value,
then send `color-scheme` on the socket:

```sh
monochromatic-nested-wayland-session --socket /tmp/nws.sock --color-scheme dark -- my-app

printf 'color-scheme light\n' | nc -U /tmp/nws.sock   # => ok changed
printf 'color-scheme light\n' | nc -U /tmp/nws.sock   # => ok unchanged
```

A change replaces the value the private portal serves through `ReadOne`,
`Read`,
and `ReadAll`,
then emits `org.freedesktop.portal.Settings.SettingChanged` on the private bus
with the arguments `org.freedesktop.appearance`,
`color-scheme`,
and the new value as a variant holding an unsigned integer
(`1` for dark,
`2` for light).
Requesting the value already served answers `ok unchanged` and emits nothing,
because the portal defines that signal as emitted when a setting changes.

The command only ever uses the private bus started by `--color-scheme`.
A session started without that option has no private bus,
so the command answers `err` and names the option to add;
it never falls back to the session bus the compositor itself inherited.

Use `mise run //package/cli/nested-wayland-session:inspect:color-scheme` to verify the built release binary.
The task requires `gdbus`,
`dbus-daemon`,
`dbus-monitor`,
`dbus-send`,
and `slint-viewer`.
It hosts a Slint scene that reports every `Palette.color-scheme` value the toolkit applies,
watches the private bus,
switches in both directions,
and checks screenshots and recorded frames.
The compositor's own session-bus environment points at a disposable decoy bus for the run,
and the task requires that the decoy saw no connection and no portal signal.
It prints the directory holding its evidence.

Never change the host desktop theme to produce fixture screenshots.
Use this option for isolated dark and light scenes.
See [`doc/troubleshooting/slint-nested-color-scheme-portal.md`](
../../../doc/troubleshooting/slint-nested-color-scheme-portal.md)
for Slint's D-Bus lookup and the isolation design.

### Change the output scale

Start at a scale,
or switch it while the client runs:

```sh
monochromatic-nested-wayland-session --socket /tmp/nws.sock --size 1100x660 --scale 1.25 -- my-app

printf 'scale 2\n' | nc -U /tmp/nws.sock   # => ok changed
printf 'scale 2\n' | nc -U /tmp/nws.sock   # => ok unchanged
```

Sizes map the way they do on a desktop with a scaled output:

- `--size` and `resize` set the logical size,
  which the hosted window is configured with.
- The physical framebuffer,
  which `screenshot` and `record` capture,
  is the logical size times the scale,
  rounded half away from zero as `wp_fractional_scale_v1` prescribes for toplevel surfaces.
  `--size 1100x660` captures 1100x660 at scale 1,
  2200x1320 at scale 2,
  and 1375x825 at scale 1.25.
- `click`,
  `wheel`,
  and `drop-file` take logical coordinates at every scale,
  so one command hits the same element whatever the scale.
  Screenshot pixel (x, y) is the logical point (x / scale, y / scale).
- `scale` keeps the logical size,
  so the client sees a scale change without a resize,
  the way a window keeps its size when it moves to an output with another scale.
  `resize` keeps the scale.

Scales run from 0.5 to 3 in steps of 1/120,
which covers the 50 % to 300 % in 5 % steps that KDE's display settings offer.
A value between two steps is refused with the two nearest steps named,
because `wp_fractional_scale_v1` sends a scale as a whole number of 120ths.

Hosted clients learn the scale three ways:

- `wp_fractional_scale_v1.preferred_scale` on every surface,
  in 120ths,
  as soon as the client asks for a surface's fractional-scale object and again on every change.
- `wp_viewporter`,
  through which a fractional-scale client states its logical size.
  winit binds it only when the fractional-scale manager exists,
  and from then on ignores integer scales,
  so both are advertised.
- `wl_output.scale`,
  the scale rounded up to a whole number,
  and the `xdg_output` logical size,
  for clients without fractional scaling.

Slint's winit backend applies the fractional value as a scale-factor change,
unless `SLINT_SCALE_FACTOR` in the client's environment overrides it.

`scale` answers as soon as the surfaces have been told;
the client redraws afterwards.
Until its next commit,
a capture shows the client's previous buffer drawn at the new scale,
uniformly soft after a switch to a larger scale,
exactly as a desktop compositor shows a window that has just moved to another output.
Take evidence after the client has settled,
for example once two consecutive screenshots are identical.

The nested window on the host is the framebuffer.
A new size or scale asks the parent compositor for a window that covers the physical size,
counted in the parent's own logical pixels and rounded up,
then applies the size the window has.
winit resizes a normal window by itself,
without waiting for the parent
(winit 0.30.13 `src/platform_impl/linux/wayland/window/state.rs`,
`request_inner_size`),
so this takes effect before the command answers.
By that source it does not need the parent to send anything,
which a locked host session does not;
that case was not exercised,
because the host was unlocked for every measurement.
A parent at a scale above 1 can only make windows whose sides are multiples of its scale,
so a capture can be wider or taller than the computed size
by fewer pixels than the parent's scale rounded up;
the extra strip shows the background color and no client content is cut off.
When the parent keeps the window at a size of its own,
for example maximized or tiled there,
`resize` and `scale` answer `err` with the size the window has.
The host output's own scale never becomes the nested scale,
so captures do not depend on which host output shows the window.

Use `mise run //package/cli/nested-wayland-session:inspect:scale` to verify the built release binary.
The task needs `slint-viewer`.
It hosts a Slint scene that reports the scale Slint applies,
its logical size,
and each click position.
It switches through 1,
2,
1.25,
1.5,
1,
and 2,
then resizes,
and starts a second session with `--scale 1.5`.
At each step it checks the client's report,
the `preferred_scale` and `wl_output.scale` events in the client's own protocol log,
the screenshot size,
where the client's drawing ends in a recorded frame,
and that a click at a logical point reaches that point.
It also requires that no scale switch resized the client,
and that a frame recorded after a switch made during a recording has the new size and the client's drawing.
It prints the directory holding its evidence.

## Control protocol

Requests are newline-delimited text,
 one command per line.
 Each request yields exactly
one response line:
 `ok`,
 `ok <data>`,
 or `err <message>`.

- `ping` answers `ok` (liveness check).
- `screenshot PATH` composites the hosted app's latest committed frame and writes it to `PATH` as a PNG.
  The app needs time to draw after input;
  see [Frame pacing](#frame-pacing) for what keeps that frame current.
- `click X Y [left|right|middle]` moves the pointer to the logical point and clicks
  (button defaults to `left`).
- `wheel X Y HORIZONTAL VERTICAL` moves the pointer to the logical point
  and delivers real wheel notches there.
  Positive counts scroll right and down.
- `key NAME [press|release|tap]` presses a named key (`enter`,
   `escape`,
   `tab`,
   `space`,
  `backspace`,
   `up`,
   `down`,
   `left`,
   `right`,
   `home`,
   `end`,
   `pageup`,
   `pagedown`,
   `ctrl`,
   `shift`,
   `alt`,
   `meta`,
   and single characters).
   Action defaults to
  `tap`.
  For a shortcut,
  press its modifier,
  tap the target key,
  then release the modifier through this same isolated seat.
  Release held keys in the caller's cleanup path.
- `type TEXT` types the rest of the line as individual key taps (US layout;
   characters
  off that layout are skipped).
- `resize WIDTH HEIGHT` sets the logical nested-screen size,
  keeping the output scale,
  and applies it before answering `ok`.
  It answers `err` when the parent compositor keeps the nested window at a size of its own.
- `scale SCALE` sets the output scale,
  keeping the logical size.
  It answers `ok changed` once the window and the output have the new scale
  and every surface has been told it;
  the client redraws on its own schedule afterwards.
  It answers `ok unchanged` when that scale was already set,
  and `err <message>` for a value outside 0.5 to 3 or between steps of 1/120.
  See [Change the output scale](#change-the-output-scale).
- `drop-file PATH [X Y]` originates a compositor-side drag carrying `PATH` as a
  `text/uri-list` and drops it onto the hosted app (defaulting to the window centre),
  exercising the app's own inbound file-drop path.
   The compositor is the drag source,
   so
  no second app (file manager) is needed.
   The drop completes asynchronously:
   the command
  returns `ok` once the drag is under way,
   the button releases after a short dwell (so the
  app can `accept` and choose an action,
   the round-trips a real drag needs),
   and the app
  then reads the `file://PATH` payload.
   Use a `screenshot` afterwards to observe the result.
- `record DIR [FPS] [FORMAT]` starts recording a frame sequence into `DIR` at `FPS` frames
  per second (default `60`) in `FORMAT` (`png` default,
   or `bmp`).
   See
  [60fps recording](#60fps-recording).
- `record stop` stops recording and answers with the measured statistics,
   for example
  `ok captured=180 dropped=0 failures=0 seconds=3.004 fps=59.9`.
- `color-scheme dark|light` switches the private appearance preference started by `--color-scheme`.
  It answers `ok changed` after notifying subscribed clients,
  `ok unchanged` when that value was already served,
  and `err <message>` when the session has no private appearance portal.
  See [Switch appearance while the client runs](#switch-appearance-while-the-client-runs).
- `quit` stops the compositor.

Payloads are passed through verbatim:
 `type` text and the `screenshot` path keep their
spaces and are never interpreted by a shell,
 so no quoting rules apply beyond the single
newline that terminates each command.

## How it works

The tool is itself a winit client of the parent Wayland session,
 so it inherits the
parent's GPU device and renders with a GLES2/EGL renderer,
 following Smithay's `anvil`
winit path.
 Because the fixture owns the compositor,
 three testing needs become built-in,
in-process features rather than external tools:

- Screenshots are a readback (`ExportMem::copy_framebuffer` plus `map_texture`)
  of an offscreen texture the size of the output mode,
  encoded with the [`image`][] crate.
  Rendering off screen gives every capture the screen's current size at once;
  the window's own back buffer takes a new size only after its next swap.
- Input is synthesised directly through the compositor's own seat,
   so events reach only
  the hosted client,
   never the host session,
   and there is no `/dev/uinput` involvement.
- The control API is a Unix socket whose blocking-IO thread forwards parsed commands to
  the render thread over a channel and returns each result.

## Frame pacing

A Wayland client draws its next frame after the compositor tells it the previous one was shown.
The live path sends that notice after presenting to the parent compositor,
and the parent in turn paces this tool the same way.
A parent that stops presenting the nested window,
for example because the host session is locked or the window is hidden,
would therefore leave the hosted app waiting to draw,
and `screenshot` showing an old frame.

To keep capture independent of host visibility,
a timer at the nested output's 60 Hz refresh sends those notices itself
whenever the parent has presented nothing for 50 ms and no recording is running.
The log records when this fallback starts and when the parent presents again.
While a recording runs,
the recorder's own timer sets the pace instead.

Use `mise run //package/cli/nested-wayland-session:inspect:stalled-parent` to verify the built release binary.
The task hosts one session inside another and starts a very slow recording in the outer one,
which withholds frame notices from the inner one exactly as a hidden window would.
It then requires that inner screenshots follow three appearance switches.
It needs `slint-viewer`.
The withheld notices come from the outer session's recording,
not from the host's lock or window state.

## 60fps recording

The `record` command captures a frame sequence at a steady rate (60fps by default) that
holds even when the hosted app is laggy or greedy.
 Three design choices make that possible:

- The capture is decoupled from the app.
   A drift-free timer (scheduled on absolute
  deadlines) composites whatever the app LAST committed and reads it back,
   whether or not
  the app produced a new frame.
   A slow app simply yields repeated frames;
   the cadence never
  stalls.
   Frame callbacks still go out at the capture rate,
   so an animating app keeps
  drawing.
   The recorder never calls `submit`,
   so the parent compositor's vsync cannot
  throttle the capture (the visible window is intentionally frozen while recording).
- The render thread's per-tick work is tiny:
   render,
   read back,
   and copy into a pooled
  buffer.
   PNG encoding,
   the expensive part,
   runs on a pool of worker threads sized to the
  machine,
   so it keeps up in parallel.
   If the encoders ever fall behind,
   frames are dropped
  (and counted) rather than blocking the timer,
   so the cadence is preserved and the shortfall
  is reported.
- A greedy app is contained with systemd.
   Under `--isolate` the app runs in a transient
  systemd scope with a `CPUQuota` (hard cap) and a low `CPUWeight`,
   reserving CPU for the
  capture pipeline.
   When systemd is unavailable this degrades to a direct launch with a
  warning;
   isolation is a robustness enhancement,
   never a hard requirement.

Formats:
 `png` (compressed,
 the default) and `bmp` (uncompressed,
 near-zero encode cost)
are supported.
 BMP is the reliable path for sustained high frame rates when PNG's deflate
cannot keep up,
 at the cost of large files.
 AVIF is deliberately not offered:
 its AV1 intra
encode is far too CPU-heavy for real-time capture,
 the opposite of what this mode needs.

Measured on a 16-core / AMD Radeon RX 7600 host at 1280x720:
 PNG and BMP both sustain 59.9
captured fps with zero dropped or failed frames over a three-second capture,
 and the rate
holds while hosting a client that saturates every core.

## Building and testing

The host usually lacks the development headers Smithay links against,
 so cargo work runs
in a Fedora build container (see `Containerfile`);
 the resulting binary runs on the host.
Tasks fall back to the host automatically when the development libraries are present.

- `mise run //package/cli/nested-wayland-session:build` builds the release binary.
- `mise run //package/cli/nested-wayland-session:test` runs the unit tests.
- `mise run //package/cli/nested-wayland-session:test:all` runs them without stopping at the first failure.
- `mise run //package/cli/nested-wayland-session:lint:clippy` runs clippy with warnings
  denied.
- `mise run //package/cli/nested-wayland-session:lint:rust` runs the repo's Rust linter
  (max-lines plus require-rustdoc).
- `mise run //package/cli/nested-wayland-session:verify:container` is the reference build
  that builds,
   clippys,
   and tests inside the container.

## Scope

This version supports the nested-winit path only:
 it needs a running parent Wayland
session at run time.
 The headless-surfaceless variant,
 for a bare machine with no screen
at all (such as a CI server),
 is the concentrated risk and is deferred to issue #273.

## License

LGPL-3.0-or-later.
 See [`LICENSES/`](./LICENSES).

[Smithay]: https://github.com/Smithay/smithay
[`cargo-binstall`]: https://github.com/cargo-bins/cargo-binstall
[`image`]: https://github.com/image-rs/image
