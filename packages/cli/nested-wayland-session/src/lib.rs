//! A minimal single-app nested Wayland compositor for GUI testing.
//!
//! This library owns everything except process startup: argument parsing, the
//! compositor state and its protocol handlers, the winit backend and render loop,
//! and the hosted-child lifecycle. Keeping it all in the library (with the binary a
//! thin shell over `run`) lets the display-independent pieces (argument parsing) be
//! unit-tested without opening a window. See the module docs for each part.

/// What:     `pub mod app;`. Declares the `app` module from `src/app.rs`.
/// Why:      Holds `run`, the whole-program orchestration entry.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as app from "./app";
/// ```
pub mod app;

/// What:     `pub mod backend;`. Declares the winit/EGL/dmabuf backend init module.
/// Why:      Builds the nested window, GLES renderer, output, and dmabuf state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as backend from "./backend";
/// ```
pub mod backend;

/// What:     `pub mod child;`. Declares the hosted-client lifecycle module.
/// Why:      Spawns the app and stops the loop on its exit.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as child from "./child";
/// ```
pub mod child;

/// What:     `pub mod cli;`. Declares the argument-parsing module.
/// Why:      Turns raw arguments into a validated `Config`; display-independent and
///           unit-tested.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as cli from "./cli";
/// ```
pub mod cli;

/// What:     `pub mod handlers;`. Declares the Wayland protocol handler module tree.
/// Why:      Implements the compositor/xdg-shell/shm/seat/dmabuf behaviour.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as handlers from "./handlers";
/// ```
pub mod handlers;

/// What:     `pub mod render;`. Declares the rendering module.
/// Why:      Composites the hosted window into the nested framebuffer each frame.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as render from "./render";
/// ```
pub mod render;

/// What:     `pub mod state;`. Declares the central-state module.
/// Why:      Defines `Compositor`, the value the event loop carries.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as state from "./state";
/// ```
pub mod state;

/// What:     `pub use app::run;`. Re-export `run` at the crate root.
/// Why:      The binary calls `nested_wayland_session::run` without knowing the module
///           layout.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export { run } from "./app";
/// ```
pub use app::run;

/// What:     `pub use cli::{parse_args, Config};`. Re-export the parser and its output.
/// Why:      The binary and tests use these directly from the crate root.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export { parseArgs, Config } from "./cli";
/// ```
pub use cli::{parse_args, Config};
