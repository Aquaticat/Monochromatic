//! Library entry point for the Monochromatic file manager.
//!
//! The product is a Niri-like infinite horizontal strip of columns, each column stacking panes
//! vertically (see docs/planning/file-manager.md for the full interaction model, and
//! docs/handover/file-manager-gtk-build.md for build state). `run` installs non-blocking
//! logging, creates the GTK `Application`, and drives its event loop; `main.rs` is a thin bin
//! over it so the plain-Rust domain modules stay unit-testable without spinning up GTK.

/// What: the shared-constants module (application id, default geometry, env var names).
/// Why: one source of truth for magic values used across the shell modules.
mod constants;
/// What: the top-level window construction module.
/// Why: keeps window assembly out of `run`, each file under the max-lines budget.
mod window;

/// What: imports the GTK application-extension traits (`connect_activate`, `run`, `quit`).
/// Why: `run` drives an `Application` through those trait methods, which live in the prelude.
use gtk4::prelude::*;
/// What: imports the GTK `Application` type and the `glib` module (`ExitCode`, timers).
/// Why: `run` constructs an `Application` and returns the `glib::ExitCode` GTK yields.
use gtk4::{Application, glib};

/// What: imports the tracing subscriber's env-filter type.
/// Why: log verbosity is driven by `RUST_LOG`, defaulting to `info` when it is unset.
use tracing_subscriber::EnvFilter;

/// What: imports the application-id constant and the self-quit env var name.
/// Why: the `Application` is identified by `APP_ID`; `QUIT_MS_ENV` drives unattended runs.
use crate::constants::{APP_ID, QUIT_MS_ENV};

/// What: install non-blocking tracing, build the GTK application, and run its event loop.
/// Why: the `Application` owns the GDK backend; `run` blocks until the last window closes. The
///      tracing writer guard is held for the whole run so a slow stderr never blocks the UI
///      thread. Returns GTK's process exit code for `main` to propagate.
pub fn run() -> glib::ExitCode {
    let (writer, _guard) = tracing_appender::non_blocking(std::io::stderr());
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with_writer(writer)
        .init();
    enable_windows_gpu_rendering();
    tracing::info!("monochromatic file manager starting");

    let app = Application::builder().application_id(APP_ID).build();
    app.connect_activate(|app| {
        window::build_window(app);
        schedule_self_quit(app);
    });
    app.run()
}

/// What: on Windows, opt into DirectComposition so GTK's GL renderer runs on the GPU.
/// Why: gvsbuild patches DirectComposition to opt-in and GTK's GL renderer hard-requires a
///      DComp device; without it GTK falls back to the Cairo software renderer at 3-6 fps (see
///      docs/troubleshooting/gtk4-windows-gvsbuild-directcomposition.md). Set before GDK init,
///      and only when unset so an explicit `GDK_DEBUG` from the environment still wins.
#[cfg(windows)]
fn enable_windows_gpu_rendering() {
    if std::env::var_os("GDK_DEBUG").is_none() {
        // SAFETY: called at startup before GTK/GDK initialization while still single-threaded,
        // so no other thread can be reading the environment concurrently.
        unsafe {
            std::env::set_var("GDK_DEBUG", "dcomp");
        }
        tracing::info!("set GDK_DEBUG=dcomp for GPU rendering on Windows");
    }
}

/// What: no-op stand-in for the Windows GPU-rendering opt-in on other platforms.
/// Why: keeps `run` platform-agnostic; the Wayland and Quartz backends need no such flag.
#[cfg(not(windows))]
fn enable_windows_gpu_rendering() {}

/// What: if `FM_QUIT_MS` holds a millisecond count, quit `app` after that delay.
/// Why: an unattended verification run opens the window, proves it renders, then exits itself.
///      An absent or unparsable value leaves the app running normally until the window closes.
fn schedule_self_quit(app: &Application) {
    let Some(raw) = std::env::var_os(QUIT_MS_ENV) else {
        return;
    };
    let Some(ms) = raw.to_str().and_then(|value| value.parse::<u64>().ok()) else {
        return;
    };
    let app = app.clone();
    glib::timeout_add_local_once(std::time::Duration::from_millis(ms), move || {
        tracing::info!(ms, "self-quit timer elapsed, quitting");
        app.quit();
    });
}
