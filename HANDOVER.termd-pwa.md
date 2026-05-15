# Handover: PWA smooth-scrolling terminal emulator

## Mission for the next agent

Two-tier validation before any production-stack terminal work. Both tiers verify
that the smooth-scroll architecture feels acceptable under realistic conditions.

- Tier 1: rendering-primitive rig. Cheap (4 to 8 hours). Rules out cheap failures.
- Tier 2: integrated-experience validation by modifying an existing terminal library
  to use the proposed renderer and animator, then using the result against real apps
  over several days. (10 to 20 hours.)

If Tier 1 fails, stop. If Tier 1 passes but Tier 2 fails, stop. Only if both pass
proceed to the full editord-stack build (51 to 85 hours).

The point: validate against real terminal output cadence (which Tier 1 cannot do
with synthetic input) without committing to building YOUR terminal in YOUR stack.
Tier 2 modifies a stranger's terminal just enough to test the one new thing.

## Why this project exists

Smooth scrolling in existing editors and terminals on Linux is worse than Neovide.
See `packages/desktop-daemon/editord/README.md` for the comparison editord makes:
WebStorm GC-jank, VSCode `preventDefault` on wheel, Electron lacking the Chrome
compositor flag, Neovide owning its render loop in Skia.

Editord proved the PWA pattern works for an editor: real Chrome, native CSS overflow
scroll, one `<div>` per line, no virtualization, no JS scroll reimplementation.
The Chrome compositor owns scroll entirely on the main buffer.

This project applies the same pattern to a terminal emulator. The goal is pixel-smooth
scrolling everywhere, on the scrollback buffer and inside alt-screen apps (vim, less,
htop, tmux). Neovide is the reference quality bar.

## Why this might fail

The PWA approach has a known architectural asymmetry:

- Main-buffer scroll is free via Chrome's compositor.
- Alt-screen apps render to a fixed grid that does not natively scroll. Smooth scroll
  in alt-screen has to be inferred from VT scroll-region escape sequences and animated
  manually via Web Animations API translateY transforms.

These are two different mechanisms wearing the same skin. The two-tier validation
verifies that both feel acceptable in isolation (Tier 1) and that the combination
feels coherent under real-app input cadence (Tier 2).

If they feel janky, the PWA architecture pays the DOM cost without delivering the
smooth-scroll value, and the better path is contributing Neovide-class smooth scroll
upstream to Ghostty (Zig, libghostty, 50 to 100 hours of focused engineering).

## Tier 1: rendering-primitive rig

### What Tier 1 includes

A minimal HTML page with no PTY, no VT parser, no terminal logic, no editord patterns.
Just enough to answer: do the rendering primitives hold up under synthetic stress?

Four tests:

1. **Main-buffer compositor scroll baseline.** A scrollable container with 10,000
   synthetic line-divs (mixed colors, varied widths). Scroll via wheel, trackpad,
   keyboard (PageDown, arrows). Measure framerate via DevTools Performance, dropped
   frames, perceived smoothness.

2. **Hidden-sibling wheel-listener deopt test.** Same scrollable container, plus a
   sibling `<div hidden style="display: none">` with a non-passive wheel listener
   attached. Repeat the scroll measurements. Framerate must be indistinguishable from
   test 1. If it is not, the split-container design for alt-buffer is unsafe; document
   the failure mode and propose a fallback (listener add/remove on visibility toggle,
   iframe isolation, or drop alt-screen wheel handling).

3. **Alt-buffer translateY composability.** A fixed 24-row grid. A trigger (button or
   auto-emit) fires "scroll by one line" events. Each event animates the row-group's
   translateY via Web Animations API with `composite: 'add'` or a custom interpolator.
   Drive sequences of 5 events in 80 ms, 10 events in 160 ms, 30 events in 500 ms
   (simulating fast trackpad cadence). Measure final-position correctness, perceived
   smoothness, frame budget per event.

4. **Mixed full-redraw and scroll-region interleave.** Simulate htop-style 1 Hz full
   grid clear plus redraw, interleaved with vim-style scroll-region events. Verify the
   renderer handles both without animation glitch on the full-redraw path.

### What Tier 1 must NOT include

- Any VT escape parsing
- Any PTY backend or shell integration
- Any wterm or xterm.js dependency
- Any editord-pattern shell, web components, shadow DOM, h-css, themes
- Any keyboard or mouse handling beyond what the four tests need
- Any production-quality code; throwaway is correct

### Tier 1 pass criteria

- Main-buffer scroll holds 60 fps with negligible dropped frames across wheel,
  trackpad, and keyboard inputs.
- Hidden-sibling wheel listener produces no measurable impact on main-buffer scroll
  performance.
- Alt-buffer translateY animations compose smoothly under fast synthetic input.
- Mixed full-redraw plus scroll-region interleave renders cleanly.

### Tier 1 fail criteria

- Any of the four tests degrades framerate or shows visible jank.
- Composability issues that cannot be fixed by switching animator design within Web
  Animations API.
- Hidden-sibling deopt that forces iframe isolation. Mark as fail, not warning: the
  iframe path inflates build complexity significantly and changes the architectural
  calculus.

### Tier 1 deliverables

- Short `README.md` in the rig directory describing each test and how to run it.
- DevTools Performance recording or `.har` for each test.
- One- or two-paragraph subjective write-up per test.
- Clear go / no-go for Tier 2.

## Tier 2: integrated experience via modified existing terminal

Tier 1 cannot validate the wheel-to-arrow-to-app-to-scroll-region-to-animation
pipeline because there is no real app on the other end of the wheel. Tier 2 closes
that gap by modifying a stranger's terminal just enough to test the one new thing
under real conditions.

### What Tier 2 includes

Pick one existing browser-based terminal library that connects to a real PTY, modify
its renderer to apply the proposed smooth-scroll animator, then use the result for
several days against real apps.

Candidate base: **wterm's `examples/local`** (Next.js + node-pty + WebSocket
reference, MIT). `@wterm/core` exposes `TerminalCore`, `CellData`, `CursorState`, and
`WebSocketTransport` headlessly, so a custom renderer can consume cell state and
react to scroll-region events without using `@wterm/dom`'s built-in renderer.

Alternative candidate: **xterm.js** with a custom backend. xterm.js's
`EscapeSequenceParser` is pure TS, MIT-licensed, and well-isolated; the InputHandler
emits scroll-region operations that a custom renderer can intercept. Heavier modification
than wterm but no WASM dependency.

Plan agent picks the candidate. wterm is the faster path if its API cooperates;
xterm.js is more predictable if wterm's API requires fighting.

Workflow:

1. Clone the chosen base.
2. Write a custom renderer that consumes the library's cell-state and scroll-region
   events.
3. Implement the split-container DOM structure: `<main-buffer overflow-y: auto>` for
   the main scrollback buffer, `<alt-buffer hidden overflow: hidden>` for the alt
   screen. Wheel listener on the alt-buffer container only.
4. Implement the smooth-scroll animator: Web Animations API translateY composed across
   in-flight animations, triggered by scroll-region events.
5. Wire up to the existing PTY backend in the example.
6. Run for several days. Use it for real work: vim editing, htop monitoring, less
   paging, ssh sessions, fast `cat` of large files, tmux navigation, mc browsing.

### What Tier 2 must NOT include

- editord patterns (web components, shadow DOM, h-css, themes, JetBrains parity,
  keybindings, FAB, fullscreen keyboard lock, recent-files, session persistence,
  context menu)
- Production-grade plumbing (auth, theme switching, OSC handling beyond what the
  base library already does, accessibility wiring, polished error handling)
- Anything that would make Tier 2 usable as a daily driver beyond the evaluation
  period

Resist polishing Tier 2 into a product. It is throwaway by design.

### Tier 2 pass criteria

- Subjective smoothness in vim: `Ctrl+E` and `Ctrl+Y` scrolling, `j`/`k` navigation
  across long files, viewport repaints on file switch all feel smooth, not janky.
- Subjective smoothness in less: PgDown / PgUp through long files feels smooth.
- htop's 1 Hz refresh renders cleanly (no animation glitch on full-redraw cadence).
- tmux pane switching and within-pane scrolling does not break the animation state.
- Fast output (`yes`, `cat huge.log`) does not stall the renderer or compound into
  visible lag.
- Trackpad inertial scroll in the main buffer feels natural (validated indirectly
  through Tier 1 but worth re-confirming under integrated load).

### Tier 2 fail criteria

- Jank under any of the above that cannot be tuned away within the animator design.
- Integration issues not visible in Tier 1: cursor desync during animation, selection
  artifacts, scroll position drift, mode-switch glitches.
- API friction from the chosen base library that exceeds 20 hours to work around.
  Document and escalate; do not silently push past the time budget.

### Tier 2 deliverables

- Short write-up of the workflow: which base library, what was modified, where the
  smooth-scroll animator was wired in.
- Several video captures of real-app use: vim scrolling, htop, less, fast output.
- Subjective evaluation paragraph per scenario.
- Clear go / no-go for the full editord-stack build.

## If both tiers pass

Proceed to the full PWA build in the editord stack. Two parser paths exist; the
plan agent designing the full build picks based on the project's priorities then.

Path A: lift xterm.js's `EscapeSequenceParser` into TypeScript. Pure TS, no WASM,
mature, MIT, full architectural control. Estimate 35 to 55 hours base plus 16 to 30
hours smooth-scroll-everywhere, total 51 to 85 hours.

Path B: build on `@wterm/core`. v0.3.0, brand new (created 2026-04-14),
MIT/Apache-2.0. Zig WASM parser at about 12 KB, bring-your-own renderer. Estimate 15
to 25 hours base, 10 to 15 hours alt-screen plumbing, 16 to 30 hours smooth-scroll,
total 41 to 70 hours. WASM tax in build, debugging across language boundary,
dependency on a v0.3.0 corporate-sponsored library.

The PWA-path conversation recommended Path A for stack-native ownership and no WASM
tax. Path B is the speed-first option. Tier 2's choice of base library does not bind
the production parser path.

## If either tier fails

Escalate to native via Ghostty. Either contribute Neovide-class smooth scroll
upstream or fork. Estimate 50 to 100 hours. The Tier 1 and Tier 2 work is not
wasted: the animator design and scroll-event detection logic transfer to a native
implementation, and the failure data documents the architectural reasons concretely.

## Architectural decisions the validation tests

- Real Chrome PWA, not Electron. Compositor smooth-scroll relies on
  `chrome://flags/#smooth-scrolling`, which Electron does not expose.
- Bun + h3 + WebSocket backend, web components frontend, mirroring editord.
- PTY backend via `node-pty` under Bun, or Bun's PTY stdio if it works.
- One `<div>` per line, span coalescing by attribute run, no virtualization.
- Scrollback ring buffer capped at e.g. 10,000 lines.
- Split-container design for alt-screen: `<main-buffer>` with `overflow-y: auto` and
  no wheel listener, sibling `<alt-buffer hidden style="overflow: hidden">` with the
  wheel listener that fires only when alt-buffer is visible. The non-passive listener
  lives on the hidden sibling so it does not deopt main-buffer's compositor scroll.
  This is the architectural assumption Tier 1 test 2 validates.
- Wheel listener on alt-buffer needs DECCKM-aware arrow-key conversion, mouse
  reporting passthrough (`?1000h` / `?1002h` / `?1003h` plus `?1006` SGR encoding),
  and alt-scroll opt-out via `?1007l`.
- `navigator.keyboard.lock(['KeyW'])` and similar for Ctrl+W, Ctrl+T, Ctrl+N,
  Ctrl+Tab capture. Terminals legitimately bind these keys (vim window commands,
  tmux, readline word-erase).
- Smooth scroll inside alt-screen comes from intercepting VT scroll-region escapes
  (`\eM`, `\eD`, `\e[<n>S`, `\e[<n>T`, `\e[L`, `\e[M`) and animating row-div
  transforms via Web Animations API. App-driven, not user-driven: wheel input emits
  arrow keys, the app responds with scroll-region operations, the animation runs on
  those.

## What's been verified by reading source or docs

- wterm uses native CSS overflow scroll and has no wheel listener anywhere in
  `packages/@wterm/dom/`: verified by grep across the dom package. It writes
  `scrollTop` to anchor on new output but does not intercept wheel events.
- wterm's WASM does not use `SharedArrayBuffer`: verified by grep. No COOP/COEP
  cross-origin-isolation headers needed.
- `@wterm/core` is the headless package, exporting `TerminalCore`, `CellData`,
  `CursorState`, `WasmBridge`, `WebSocketTransport`. Package.json describes it as
  "Headless terminal emulator core for the web, WASM bridge and WebSocket transport."
- Vercel's `examples/local` is a Next.js + node-pty + WebSocket reference proving
  the PTY-over-WebSocket personal-shell architecture end-to-end.
- xterm.js's DOM renderer wraps a `SmoothScrollableElement` that intercepts wheel
  events and reimplements scrolling in JS via `scheduleAtNextAnimationFrame`. Its
  `smoothScrollDuration` is a JS animation, not compositor-driven. Lifting only the
  `EscapeSequenceParser` avoids the trap.

## What's reasoned but unverified

- Hidden-sibling wheel listener does not deopt visible-sibling compositor scroll,
  on the basis of Chrome's documented wheel-event-regions optimization and
  `display: none` removing layout boxes from the hit-test region map. **Tier 1 test
  2 exists to validate this empirically.**
- Composing Web Animations API translateY transforms at terminal-input cadence is
  smooth enough to qualify as Neovide-class. No existing generic terminal does this,
  so the work is original engineering against this point. **Tier 1 test 3 and Tier 2
  cover this empirically: Tier 1 with synthetic load, Tier 2 with real load.**
- wterm's API exposes scroll-region events cleanly enough to drive an external
  smooth-scroll animator. Suggested by the headless export of `TerminalCore` and
  `CellData`, but the exact subscription mechanism is not verified beyond reading
  the package descriptions. **Tier 2 exposes this risk first; if it slips beyond 20
  hours, switch to xterm.js base.**

## References

- Editord: `packages/desktop-daemon/editord/README.md`
- wterm GitHub: <https://github.com/vercel-labs/wterm>
- wterm local-shell example: <https://github.com/vercel-labs/wterm/tree/main/examples/local>
- xterm.js viewport / scrolling: <https://deepwiki.com/xtermjs/xterm.js/4.5-viewport-and-scrolling>
- Neovide: <https://github.com/neovide/neovide>
- Ghostty: <https://github.com/ghostty-org/ghostty>
- Chrome wheel-event-regions / passive-listener optimization: see
  <https://developer.chrome.com/blog/scrolling-intervention> and
  <https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener#passive>

## Open questions for the plan agent

1. Where should the Tier 1 rig and Tier 2 patched-wterm live in the monorepo?
   Suggested: throwaway locations like `packages/internal/termd-rig/` and
   `packages/internal/termd-tier2/`, both `.gitignore`-able or deletable after the
   validation completes.
2. Should the rig and Tier 2 measure on multiple hardware or display profiles
   (high-DPI, integrated GPU, trackpad versus mouse)? At minimum, the developer's
   primary machine; document the environment in the report.
3. What is the threshold for "smooth enough" subjectively? Tier 1 produces numerical
   metrics (60 fps holds, dropped-frame count under 1 percent). Tier 2 produces
   video captures and subjective write-ups; human judgement decides.
4. Tier 2: wterm base or xterm.js base? Default to wterm unless the plan agent
   surveys the API surface and concludes xterm.js will be lower-risk.

## Anti-goals

- Do not start writing the editord-stack terminal until both tiers pass.
- Do not add editord patterns (web components, shadow DOM, h-css, tagged loggers)
  to Tier 1 or Tier 2.
- Do not polish Tier 2 toward daily-driver quality. It is throwaway.
- Do not estimate the full editord-stack build's effort beyond what is in this
  document.
