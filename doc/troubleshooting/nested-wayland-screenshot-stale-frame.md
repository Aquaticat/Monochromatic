# nested-wayland-session 0.1.1: `screenshot` kept returning the hosted client's first frame (host session found locked)

## Symptom

On 2026-10-05,
during native verification of the Slint IDE's in-file find,
every `screenshot PATH` control command answered `ok` and wrote a valid PNG,
but each PNG showed the hosted application's first frame.
Seat input sent through the same control socket (`key`,
 `type`,
 `click`) reached the application:
its accessible tree and Slint's own `take_screenshot` showed an open find bar,
a different file,
and highlighted matches.
Three compositor screenshots taken around further input were byte-identical:

```text
fbd3c8209657f149  debug-compositor.png
fbd3c8209657f149  debug-compositor-2.png
fbd3c8209657f149  debug-compositor-3.png
```

The host desktop session was locked when it was checked after the stalled session had ended:
`loginctl show-session` reported `LockedHint=yes`.
The lock state was not sampled during the stall itself.
No error or warning was printed by the compositor.

## Root cause

The compositor composites on demand,
but nothing asks the hosted client for a new buffer unless the parent compositor requests a redraw.

`screenshot` re-renders the scene from the client's last committed buffer and reads it back.
It does not send frame callbacks:

```rust
// package/cli/nested-wayland-session/src/screenshot.rs:174
pub fn capture(state: &mut Compositor, path: &Path) -> Result<()> {
    let mut pixels = Vec::new();

    let (width, height) = read_frame(state, &mut pixels)?;

    encoder::write_flipped(&pixels, width, height, path, encoder::Format::Png)
        .with_context(|| format!("writing screenshot to {}", path.display()))?;

    return Ok(())
}
```

Frame callbacks are sent from the live redraw path,
after presenting to the parent compositor,
and that path re-arms itself through the parent window:

```rust
// package/cli/nested-wayland-session/src/render.rs:139
    state.backend.submit(Some(&[damage])).unwrap();

    send_frame_callbacks(state);

    let _ = state.display_handle.flush_clients();

    state.backend.window().request_redraw();
```

That path runs only when the parent delivers a redraw event:

```rust
// package/cli/nested-wayland-session/src/app.rs:224
        WinitEvent::Redraw => {
            redraw(state);
        }
```

The recorder is the one path that sends frame callbacks on its own timer,
independent of the parent's presentation:

```rust
// package/cli/nested-wayland-session/src/recorder.rs:297
        render::send_frame_callbacks(state);
```

Its module comment states the intent:
"It never calls `submit`,
 so the parent compositor's vsync cannot throttle the capture cadence"
(`package/cli/nested-wayland-session/src/recorder.rs:5`).

So when the parent stops delivering redraw events,
the hosted client receives no frame callbacks,
commits no new buffer,
and `screenshot` keeps compositing the old one.

Two links of this chain are inferred,
 not traced in source:

- that a locked KDE session stops delivering redraw events to the nested window
  (supported only by `LockedHint=yes` read after the stalled session ended);
- that the Slint winit client waits for a frame callback before committing its next buffer
  (consistent with the observation,
   not read in winit or Slint source).

## Verification

Version under test:
`package/cli/nested-wayland-session` 0.1.1 from this repository,
release binary built on 2026-10-04,
hosting `monochromatic-ide` through `mise run //package/desktop-app/ide:inspect:native dark scroll`.

Harness,
run against the control socket printed as `IDE_NATIVE_SOCKET`:

```sh
# Stale: three screenshots around seat input have one checksum.
printf 'screenshot /tmp/a.png\n' | nc -U "$SOCKET"
printf 'key escape\n' | nc -U "$SOCKET"
printf 'screenshot /tmp/b.png\n' | nc -U "$SOCKET"
sha256sum /tmp/a.png /tmp/b.png

# Current: the last frame of a short recording shows the present state.
printf 'record /tmp/frames 10 png\n' | nc -U "$SOCKET"
sleep 1
printf 'record stop\n' | nc -U "$SOCKET"
```

Measured in the session at `/tmp/monochromatic-ide-native-3r2Gu7`:

- Fails:
  `screenshot` before and after `key escape`,
   300 ms apart,
   three times:
  identical checksums,
  all showing the first frame.
- Works:
  `record DIR 10 png`,
   900 ms,
   `record stop` answered
  `ok captured=9 dropped=0 failures=0 seconds=0.953 fps=9.4`;
  the last frame (`frame-00000008.png`,
   checksum `bf8486a02125cbcc`) showed the current state.
- Works:
  the IDE probe then used a 500 ms recording at 20 frames per second for each of 24 evidence images
  across a dark and a light session;
  every image showed the state the accessible tree reported.

Not measured:
the same commands with the host session unlocked and the nested window visible.
Earlier sessions recorded in `doc/handover/slint-ide-0x.md` used Slint's `take_screenshot`,
so they do not show whether `screenshot` was current there.

## Verified workarounds

Take evidence images from a short recording instead of `screenshot`:

```js
// probe helper; `control` writes one line to the control socket and returns the reply
await control('record ' + frames + ' 20 png');
await wait(500);
await control('record stop');
const last = readdirSync(frames).sort().at(-1);
```

Tradeoffs:
it writes about ten PNG files per image and takes half a second;
the first frames of a recording can still show the old buffer,
so only the last frame is evidence;
`redraw` returns early while a recorder exists (`render.rs:79`),
so nothing is presented to the parent window during the recording.

## What does not work

- Repeating `screenshot`,
  or sending input first:
  the client still receives no frame callback.
- Slint's MCP `take_screenshot` as a substitute for a compositor frame:
  it renders the window through Slint's own snapshot path and showed the current state,
  but it does not show what the client committed to the compositor.

## Upstream filing decision

The tool is owned by this repository,
so there is no external tracker and no duplicate search applies.
`.out-of-scope/` has no entry for the nested compositor.

1. Upstream's fault:
   the behavior is in this repository's compositor,
   not in Smithay or winit.
2. Fixable:
   yes;
   `capture` could send frame callbacks and wait for the next commit,
    bounded by a timeout,
   before reading the frame.
3. Supported use case:
   yes;
   the README promises that `screenshot` "renders the current frame".
4. Contribution welcome:
   not applicable to a repository-owned package.
5. Likely to be fixed:
   not applicable.
6. Prototype:
   not written.
   The session that found this was assigned the IDE package only;
   the change belongs to `package/cli/nested-wayland-session`,
   needs a reproduction with a locked or hidden parent window,
   and should confirm the two inferred links under "Root cause" first.

No issue draft is kept:
the next action is a change in this repository,
recorded in the IDE handover as an open item.
