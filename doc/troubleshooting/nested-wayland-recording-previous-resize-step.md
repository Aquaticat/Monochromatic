# nested-wayland-session 0.4.0: recorded frames of a resize drag show the previous step's content

## Symptom

On 2026-10-13, the 60 fps recorder of the nested compositor ran over a continuous resize drag of the read-only Slint IDE
(`resize W 660` every 16 ms, 1100 to 600 to 1100 pixels, two sweeps).
Of about 100 recorded frames, 74 to 77 did not fit:
when shrinking, text wrapped for the previous, wider step ran into the right edge and was cut;
when growing, a strip of another shade stood at the right edge beside text wrapped for the previous, narrower step.
In the headless test backend the first frame after a size event is already wrapped for the new width
(`a_frame_drawn_right_after_a_resize_event_is_wrapped_to_the_new_width`), so the question was where the one-step delay
of the real compositor comes from.

## Root cause

The delay is in the compositor's capture model and the toolkit's redraw gate, not in the application.
Four facts decide it (paths under `package/cli/nested-wayland-session/` are identical in the working tree and in the tag
`monochromatic-nested-wayland-session-v0.4.0`):

- `src/screen.rs:209`: the `resize` command calls `set_mode`, so the output mode, which is the size of every recorded
  frame, changes when the command arrives, before the hosted client has seen the new size.
  The hosted window still holds its previous buffer until the client commits a new one.
- `src/recorder.rs:373` to `389`: every recorder tick captures the frame first (`capture_into`) and only then sends
  the frame callbacks and flushes (`render::send_frame_callbacks`, `flush_clients`).
- `src/render.rs:114` and `src/frame_pacing.rs:135`: while a recording runs, the live redraw returns early and the
  fallback pacing timer is never due, so the recorder tick is the only sender of frame callbacks.
- winit 0.30.13, `src/platform_impl/linux/wayland/event_loop/mod.rs:486`: a `RedrawRequested` event is withheld while
  the window's frame callback state is `Requested`, which Slint's renderer sets before every swap through
  `pre_present_notify` (`i-slint-backend-winit` 1.18.1, `renderer/femtovg/glcontext.rs:33`).

So a size that reaches the application between two ticks is drawn right after the next tick's capture
(a median of 0.4 ms after the callbacks), committed a few milliseconds later, and first captured one tick later.
The capture at that tick already has the output mode of the newest command, one step further.
The frame is the old buffer on a canvas of the new size: the canvas outside the buffer is the compositor's clear color
(`src/render.rs:80`, 0.1 gray, pixel value 25) where the application paints 28, which is the strip.
A buffer wider than the canvas is cut by it, which is the cut text.

## Verification

An instrumented copy of the compositor source (probe lines for the control command, the configure, each commit with
the committed buffer size, each capture with the held buffer size and the output mode, and each batch of frame
callbacks) hosted the IDE built from commit `d7df483fc0` of the branch `feat/ide-resize-frame`, which adds debug
lines at the target `monochromatic_ide::native::frame` (winit size event, redraw request, view report, start and end of
each draw).
Timestamps are the log's own wall clock, so compositor and application lines share one axis.
Every run recorded 143 frames or more with no dropped frame, at a one-minute load of 8 to 18 when it started.
The recording of the instrumented copy had 77 frames that did not fit; the installed 0.4.0 binary had 76 in the same
drag, so the probes do not change the picture.

Three runs of the 16 ms drag, 81 to 82 captures in the drag:

- The held buffer width differed from the output mode width in 76, 77, and 77 captures (93.8 to 95.1 percent).
  In 73 to 74 of them the held buffer was exactly one step behind.
- Each recorded frame was joined to the capture line of its index.
  Of the 84 frames in the drag window, every one of the 77 (first run) that did not fit had a held buffer different
  from the output mode, and all 7 frames with a held buffer equal to the mode fit; the other runs had 8 and 7 such
  frames, all fitting.
  The 100 ms drag had 459 frames with held buffer equal to the mode over two runs, none of them failing to fit.
  So no frame had a committed buffer of the right size and wrongly wrapped content.
- Medians in milliseconds after the command: the re-wrap finished at 4.1 to 4.3, winit's redraw request came at 9.6
  to 9.9 (after the next callbacks, not after the size event, which the application saw at 0.2), the draw ended at 13.1,
  and the commit reached the compositor at 13.0 to 13.5.
  The tick period was 16.7 ms.
  A latency of about 13 ms against a 16.7 ms period leaves almost every capture one step behind.

Positive controls, to show the probe sees a delay that is introduced on purpose:

- The application was stopped with `SIGSTOP` for 40 and 80 ms after one command of a 100 ms drag.
  The probe logged winit's size event at 41.6 and 81.4 ms after the command (0.2 ms in the run without a stop),
  and 3 and 6 consecutive captures held the old buffer (at most one without a stop).
- Counterfactual on the compositor copy: with `NWS_PROBE_CALLBACKS_AT_RESIZE` set, `screen::resize` sends the frame
  callbacks right after the configure, which opens the gate at the command.
  Over three runs of the 16 ms drag the redraw request moved from 9.6 to 9.9 ms to 0.2 ms, the commit from 13.0 to 13.5
  ms to 7.5 to 7.9 ms, and the stale captures fell from 93.8 to 95.1 percent to 55.6 to 60.5 percent.
  The rest is the application's own work (re-wrap about 4 ms, draw about 3.5 ms) against a 16.7 ms period.

## What the application contributes

The width reaches the Rust code at once.
`ui/app.slint:408` (`changed width`) reports the layout width of the source `Flickable`, which Slint updates when it
handles the size event, so `bind_viewport` and `place_scrolled` have it a median 0.4 ms after the command.
At every one of 715 draws in five sessions (three 16 ms and two 100 ms), the width the view had last reported was the
toolkit's window width minus 333 px, and the buffer committed after the draw had that window width.
The wrap width of a draw was therefore never one step behind its own size event.

The re-wrap (or the tile build that takes its place in some steps) usually ends about 5 ms before the gated draw can
begin, so it adds nothing to the latency then.
It does add some: in 9 to 12 of the 79 to 80 draws of each 16 ms session the draw began more than 1.5 ms after the
callbacks (up to 8 ms), and 13 to 18 of the 84 callbacks arrived while such a step was still running.
Three captures per session were two steps behind rather than one.
With the gate open the step is about half of a latency that still leaves more than half of the captures behind.
Nothing the application can set removes the delay: the gate is inside winit, and the mismatch between canvas and buffer
is created by the compositor's `set_mode` at command time.

## Reading recorded resize frames

- A frame whose held buffer differs from the output mode is not evidence about the application's wrapping.
  The instrumented build above is the way to tell: join each frame to its capture line.
- A drag slower than the tick period leaves at most one such frame per step, and a 100 ms drag had 15, 19, and 28 of
  243 captures in three runs without a stop.
  That number moves with the phase of the commands against the ticks.
- A recorder that sends the callbacks before the capture and captures a few milliseconds later, or an output mode that
  follows the committed buffer instead of the command, would remove the mismatch.
  Neither was built; this document does not ask for either.

## What was not measured

The live path of the compositor (no recording, parent redraw events) was not measured.
A host with a load above 20 was not measured.
