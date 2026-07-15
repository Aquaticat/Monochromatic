//! Compiles the Slint UI markup into generated Rust at build time, and on
//! Windows embeds the application icon into the .exe.

fn main() {
    slint_build::compile("ui/app.slint").expect("Slint UI compilation failed");

    // What:     `#[cfg(windows)]` is a conditional-compilation attribute. It
    //           tells the Rust compiler to keep the statement directly below it
    //           ONLY when this build script is compiled for a Windows host; on
    //           Linux and macOS the statement is physically removed before
    //           compilation, so nothing runs there. (We build each OS natively,
    //           so host == target; we never cross-compile Windows from Linux.)
    // Why:      Embedding an icon resource into an executable is a Windows-only
    //           concept. The macOS icon lives in the .app bundle and Linux uses
    //           the .desktop file's `Icon=` name, so neither needs this.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (process.platform === "win32") embedWindowsIcon();
    // ```
    #[cfg(windows)]
    embed_windows_icon();
}

// What:     A plain function declaration named `embed_windows_icon`, taking no
//           arguments and returning nothing (Rust's `()`, i.e. void). The
//           `#[cfg(windows)]` attribute means the whole function only exists in a
//           Windows build, mirroring its call site; non-Windows builds never see
//           it and never pull in the winresource crate (itself gated to
//           cfg(windows) in Cargo.toml).
// Why:      Keeps the Windows-only logic out of `main` and out of every other
//           platform's compile entirely.
//
// In TS you'd write (pseudocode):
// ```ts
// function embedWindowsIcon(): void { ... }
// ```
#[cfg(windows)]
fn embed_windows_icon() {
    // What:     `winresource::WindowsResource::new()` calls the associated
    //           function `new` on the `WindowsResource` type from the
    //           `winresource` crate, producing a fresh builder value.
    //           `let mut resource` binds it to a MUTABLE local (`mut` is needed
    //           because the next line changes it; a bare `let` would be
    //           read-only).
    // Why:      The builder accumulates what to embed (here, the icon) and then
    //           compiles it into a `.res` object file the linker bakes into the
    //           .exe.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const resource = new WindowsResource();
    // ```
    let mut resource = winresource::WindowsResource::new();

    // What:     `.set_icon(...)` is a method on the builder recording the path to
    //           the .ico to embed. The argument is the committed icon produced by
    //           the `gen:icons` mise task.
    // Why:      Tells winresource which icon the .exe should carry, shown by
    //           Explorer, the taskbar, and Alt-Tab on Windows.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // resource.setIcon("asset/music-player.ico");
    // ```
    resource.set_icon("asset/music-player.ico");

    // What:     `.compile()` runs the Windows resource compiler (rc.exe / llvm-rc
    //           from the installed toolchain) to turn the recorded resources into
    //           a `.res` file and tells Cargo to link it into the binary. It
    //           returns a `Result` (Rust's ok-or-error value); `.expect("...")`
    //           unwraps the success case and PANICS with the given message if it
    //           is an error, failing the build loudly.
    // Why:      A missing or broken resource compiler should stop the build with a
    //           clear message rather than silently shipping an icon-less .exe.
    // Gotcha:   `.expect` on an error aborts the whole build script; there is no
    //           silent fallback.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // resource.compile(); // throws on failure
    // ```
    resource
        .compile()
        .expect("embedding the Windows icon into the .exe failed");
}
