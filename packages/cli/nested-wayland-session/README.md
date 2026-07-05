# nested-wayland-session

A minimal single-app nested Wayland compositor for GUI testing.
It hosts exactly one Wayland client fullscreen on the real GPU (dmabuf) path,
photographs the framebuffer as a PNG, injects synthetic pointer and keyboard input,
and takes all of this over a small Unix-socket control API.

It is built on [Smithay] and installs through `cargo`, so an automated test can give a
GUI app a private, deterministic screen on any machine, with no distro package manager
and no system-wide changes.

The full rationale, the on-hardware measurements, and the source review of every
alternative considered are recorded in
[`docs/decisions/nested-wayland-session.md`](../../../docs/decisions/nested-wayland-session.md)
(issue #272). A plain-language overview is in
[`docs/planning/nested-wayland-session.md`](../../../docs/planning/nested-wayland-session.md).

## What it does

- Gives exactly one app a private nested screen and keeps it fullscreen.
- Runs the real GPU render path: it imports the client's `zwp_linux_dmabuf_v1` buffers
  (v4 modifier feedback, v3 fallback) into a GLES renderer, the same path a real user
  gets, so the app is checked the way it actually draws.
- Shuts down cleanly when the hosted app exits, propagating the app's exit code.
- Saves a screenshot of the current frame as a PNG when asked.
- Clicks at a point, presses keys, and types text into the app.
- Changes the nested screen size.
- Answers every control command with a plain machine-readable `ok`/`err` line.

## Requirements

At build time (supplied by the Fedora build container, see [Building](#building-and-testing)):
`wayland-devel`, `libxkbcommon-devel`, `libdrm-devel`, plus a Rust toolchain.

At run time (present on virtually every Linux desktop): `libwayland-client`,
`libwayland-egl`, `libxkbcommon`, `libEGL`, `libGLESv2`, `libdrm`, and a running parent
Wayland session (this version is a nested winit client of an existing compositor).

## Install

Through `mise` with the `cargo` backend:

```sh
mise use "cargo:monochromatic-nested-wayland-session"
```

A source build compiles the crate. To fetch a prebuilt binary instead of building from
source, use [`cargo-binstall`]:

```sh
cargo binstall monochromatic-nested-wayland-session
```

## Usage

```txt
monochromatic-nested-wayland-session [--socket PATH] [--size WIDTHxHEIGHT] [--] COMMAND [ARG...]
```

- `--socket PATH` enables the control API on a Unix socket at `PATH`. Omitted, the tool
  just hosts the app with no control channel.
- `--size WIDTHxHEIGHT` sets the initial nested-screen size in pixels (default `1280x720`).
- `COMMAND [ARG...]` is the single client to host. Everything after `--` (or the first
  non-flag token) is the command, run with `WAYLAND_DISPLAY` pointed at the nested socket.

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

## Control protocol

Requests are newline-delimited text, one command per line. Each request yields exactly
one response line: `ok`, `ok <data>`, or `err <message>`.

- `ping` answers `ok` (liveness check).
- `screenshot PATH` renders the current frame and writes it to `PATH` as a PNG.
- `click X Y [left|right|middle]` moves the pointer to the logical point and clicks
  (button defaults to `left`).
- `key NAME [press|release|tap]` presses a named key (`enter`, `escape`, `tab`, `space`,
  `backspace`, `up`, `down`, `left`, `right`, and single characters). Action defaults to
  `tap`.
- `type TEXT` types the rest of the line as individual key taps (US layout; characters
  off that layout are skipped).
- `resize WIDTH HEIGHT` requests a new nested-screen size.
- `quit` stops the compositor.

Payloads are passed through verbatim: `type` text and the `screenshot` path keep their
spaces and are never interpreted by a shell, so no quoting rules apply beyond the single
newline that terminates each command.

## How it works

The tool is itself a winit client of the parent Wayland session, so it inherits the
parent's GPU device and renders with a GLES2/EGL renderer, following Smithay's `anvil`
winit path. Because the fixture owns the compositor, three testing needs become built-in,
in-process features rather than external tools:

- Screenshots are a framebuffer readback (`ExportMem::copy_framebuffer` plus `map_texture`)
  encoded with the [`image`] crate.
- Input is synthesised directly through the compositor's own seat, so events reach only
  the hosted client, never the host session, and there is no `/dev/uinput` involvement.
- The control API is a Unix socket whose blocking-IO thread forwards parsed commands to
  the render thread over a channel and returns each result.

## Building and testing

The host usually lacks the development headers Smithay links against, so cargo work runs
in a Fedora build container (see `Containerfile`); the resulting binary runs on the host.
Tasks fall back to the host automatically when the development libraries are present.

- `mise run //packages/cli/nested-wayland-session:build` builds the release binary.
- `mise run //packages/cli/nested-wayland-session:test` runs the unit tests.
- `mise run //packages/cli/nested-wayland-session:lint:clippy` runs clippy with warnings
  denied.
- `mise run //packages/cli/nested-wayland-session:lint:rust` runs the repo's Rust linter
  (max-lines plus require-rustdoc).
- `mise run //packages/cli/nested-wayland-session:verify:container` is the reference build
  that builds, clippys, and tests inside the container.

## Scope

This version supports the nested-winit path only: it needs a running parent Wayland
session at run time. The headless-surfaceless variant, for a bare machine with no screen
at all (such as a CI server), is the concentrated risk and is deferred to issue #273.

## License

LGPL-3.0-or-later. See [`LICENSES/`](./LICENSES).

[Smithay]: https://github.com/Smithay/smithay
[`cargo-binstall`]: https://github.com/cargo-bins/cargo-binstall
[`image`]: https://github.com/image-rs/image
