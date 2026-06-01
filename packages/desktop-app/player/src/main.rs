//! Binary entry point. Currently just opens the placeholder window; the
//! engine wiring (commands, updates, playback) is added in a later step.

// What:     `slint::include_modules!()` is a MACRO (the `!` marks a macro call)
//           that pastes in the Rust code generated from `ui/app.slint` by
//           `build.rs`. It brings the `AppWindow` type into scope.
// Why:      Without it, the compiled-from-markup component is invisible to Rust.
// TS map:   like an auto-generated `import { AppWindow } from "./app.slint.gen";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { AppWindow } from "./generated/app.slint";
// ```
slint::include_modules!();

// What:     `fn main() -> Result<(), slint::PlatformError>`. The entry point.
//           Returning `Result<(), E>` lets `main` end with an error: `()` is the
//           success payload (like `void`), `slint::PlatformError` is the failure
//           type Slint raises when it cannot create a window/backend.
// Why:      Window creation can fail (no display, no GPU); propagate that as the
//           process exit status instead of panicking.
// TS map:   `async function main(): Promise<void>` that may throw PlatformError.
//
// In TS you'd write (pseudocode):
// ```ts
// async function main(): Promise<void> {
//   const ui = new AppWindow();
//   await ui.run();
// }
// ```
fn main() -> Result<(), slint::PlatformError> {
    // What:     `let ui = AppWindow::new()?;` constructs the window component.
    //           `::new()` returns `Result<AppWindow, PlatformError>`; the trailing
    //           `?` unwraps the `Ok` or returns the `Err` from `main`.
    // Why:      Build the UI; bail out cleanly if the platform refuses.
    // TS map:   `const ui = new AppWindow();`
    let ui = AppWindow::new()?;
    // What:     `ui.run()` shows the window and runs the event loop until the
    //           window closes. It returns `Result<(), PlatformError>` and is the
    //           tail expression, so it becomes `main`'s return value.
    // Why:      Hand control to Slint's event loop.
    // TS map:   `return ui.run();`
    ui.run()
}
