//! Library root for the Slint + libghostty-vt terminal prototype.
//!
//! The binary owns only Slint wiring. This library owns VT input, viewport row
//! mapping, resize support, and render extraction so those pieces can be tested
//! without opening a window.

// What:     `pub mod demo;` declares the `demo` module from `src/demo.rs` and
//           makes it public to the binary.
// Why:      Demo VT content is intentionally separate from the engine so PTY I/O
//           can replace only the feeder later.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as demo from "./demo";
// ```
/// Demo module.
pub mod demo;

// What:     `pub mod engine;` exposes the libghostty-vt wrapper.
// Why:      The binary and tests need to feed bytes, resize, scroll, and render.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as engine from "./engine";
// ```
/// Engine module.
pub mod engine;

// What:     `pub mod error;` exposes the crate error type.
// Why:      Engine methods share one typed error instead of returning raw FFI
//           errors directly.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as error from "./error";
// ```
/// Error module.
pub mod error;

// What:     `pub mod input;` exposes keyboard-to-terminal byte encoding.
// Why:      The binary writes Slint key events to the PTY through this pure mapper.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as input from "./input";
// ```
/// Input module.
pub mod input;

// What:     `pub mod launcher;` exposes desktop-shell setup helpers.
// Why:      The binary needs to stamp the Wayland app id before creating the
//           Slint window.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as launcher from "./launcher";
// ```
/// Launcher module.
pub mod launcher;

// What:     `pub mod pty;` exposes interactive PTY process management.
// Why:      The binary needs shell spawning, output events, input writes, and resize.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as pty from "./pty";
// ```
/// Pty module.
pub mod pty;

// What:     `pub mod render;` exposes renderer-neutral cell and snapshot types.
// Why:      The engine returns these plain models, and the binary converts them
//           to Slint structs.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as render from "./render";
// ```
/// Render module.
pub mod render;

// What:     `pub mod scroll;` exposes pixel-to-row scroll mapping.
// Why:      The bridge from Slint pixels to libghostty-vt rows is pure logic and
//           has unit tests.
//
// In TS you'd write (pseudocode):
// ```ts
// export * as scroll from "./scroll";
// ```
/// Scroll module.
pub mod scroll;
