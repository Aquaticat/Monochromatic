//! Binary entry point. Builds the Slint window, spawns the engine on its own
//! thread, and wires the two together: UI callbacks send `Command`s to the
//! engine, and engine `Update`s are applied to the window's properties from the
//! event-loop thread. Also handles CLI path arguments and the file-open dialog.

// What:     `slint::include_modules!()` is a MACRO (the `!` marks a macro call)
//           that pastes in the Rust code generated from `ui/app.slint` by
//           `build.rs`, bringing the `AppWindow` type into scope.
// Why:      Without it the compiled-from-markup component is invisible to Rust.
// Gotcha:   a `name!(...)` call is a macro, NOT a function: it runs at COMPILE
//           time and can paste in whole declarations. TS has no equivalent; the
//           closest mental model is a build-step codegen import.
//
// In TS you'd write (pseudocode):
// ```ts
// import { AppWindow } from "./generated/app.slint"; // produced by a build step
// ```
slint::include_modules!();

/// What:     `mod ui_progress;` loads the sibling `ui_progress.rs` module into this
///           binary crate.
/// Why:      The progress debounce bridge uses generated Slint types, so it belongs
///           beside `main.rs`, not in the reusable library crate.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as uiProgress from "./ui_progress";
/// ```
mod ui_progress;

/// What:     `mod ui_page;` loads the sibling `ui_page.rs` module into this binary crate.
/// Why:      The queue/now-playing projection helpers use generated Slint types, so they belong
///           beside `main.rs`, not in the reusable library crate.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as uiPage from "./ui_page";
/// ```
mod ui_page;

/// What:     `mod ui_font_scale;` loads the sibling `ui_font_scale.rs` module.
/// Why:      The OS-font-tracking scale handler uses the generated `AppWindow`, so it
///           belongs beside `main.rs`; splitting it out also keeps `main.rs` under the
///           max-lines limit.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as uiFontScale from "./ui_font_scale";
/// ```
mod ui_font_scale;

/// What:     `mod ui_led_plate;` loads the measured LED plate path adapter.
/// Why:      Slint owns text wrapping while Rust turns final cap rectangles into one
///           multi-line SVG outline behind generated `LedPlateGeometry` interface.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as uiLedPlate from "./ui_led_plate";
/// ```
mod ui_led_plate;

/// What:     `mod ui_page_style;` loads the sibling settings-persistence bridge.
/// Why:      Page-control preference wiring uses generated `AppWindow` methods and stays
///           separate so `main.rs` remains under its code-line limit.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as uiPageStyle from "./ui_page_style";
/// ```
mod ui_page_style;

/// What:     `#[cfg(test)] #[path = "ui_binding_tests.rs"] mod ui_binding_tests;` loads
///           the headless UI regression tests, compiled ONLY under `cargo test` /
///           `cargo nextest run`. `#[path]` names the sibling file explicitly because
///           the module name differs from the default `ui_binding_tests/mod.rs` lookup.
/// Why:      They instantiate `AppWindow` (in scope here from `include_modules!`) and
///           drive its Sliders via `i-slint-backend-testing`, so they belong beside
///           `main.rs` in the binary crate, not in the reusable library crate.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // test-only import, tree-shaken from production builds
/// import "./ui_binding_tests.test";
/// ```
#[cfg(test)]
#[path = "ui_binding_tests.rs"]
mod ui_binding_tests;

/// What:     `use std::path::PathBuf;`. The OWNED filesystem path type: a heap-
///           allocated, growable path buffer. Sibling: `&Path`, a BORROWED view
///           that does not own its bytes (the `String` vs `&str` distinction, but
///           for paths).
/// Why:      Picked folders and the music dir become owned `PathBuf`s, and the two
///           path helpers below return `Option<PathBuf>`; `PathBuf` (not `&Path`)
///           because these paths outlive the calls that produce them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // no import needed; a path is just a string
/// ```
use std::path::PathBuf;

/// What:     `#[cfg(unix)] use std::path::Path;`. The BORROWED path view (`&Path`),
///           imported ONLY on Unix targets. `#[cfg(unix)]` is a conditional-
///           compilation attribute that keeps the line on Unix (Linux/macOS/BSD)
///           and drops it elsewhere; siblings: `windows`, `target_os = "..."`.
/// Why:      `Path::new` is used solely inside the Unix-only `xdg_user_dir_music`
///           helper below, so importing it unconditionally would be an unused
///           import on Windows (which trips the deny-warnings clippy gate).
/// Gotcha:   `#[cfg(...)]` is COMPILE-time conditional compilation, not a runtime
///           `if`: the line literally does not exist in a non-Unix build, so it
///           cannot be an unused import there.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // no equivalent: the import is physically absent from non-Unix builds
/// ```
#[cfg(unix)]
use std::path::Path;

/// What:     `use anyhow::Result;` imports `anyhow`'s one-parameter application
///           result alias. Sibling typed results name exact error types like
///           `slint::PlatformError`.
/// Why:      Startup and event-loop failures share one user-facing error channel.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Result<T> = T; // failures throw Error objects
/// ```
use anyhow::Result;

/// What:     `use std::rc::Rc;`. `Rc<T>` is a single-threaded shared-ownership
///           pointer (reference counted). Sibling: `Arc<T>` (atomic refcount, safe
///           to share across threads); `Box<T>` (single owner, no sharing).
/// Why:      Several UI callbacks need to share the one `Engine`; they all run on
///           the UI thread, so non-atomic `Rc` is enough (and cheaper than `Arc`'s
///           atomic counter), and we never need `Box`'s single-owner model.
/// Gotcha:   `Rc` is NOT thread-safe; sending one across threads does not compile.
///           The cross-thread sharing below uses `Arc` instead.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const engine = new Engine(); // closures just capture it; GC handles sharing
/// ```
use std::rc::Rc;

/// What:     `use std::sync::{Arc, Mutex};`. `Arc<T>` is a thread-safe shared owner
///           (atomic refcount; sibling: single-thread `Rc<T>`), and `Mutex<T>` is a
///           lock that lets one thread mutate `T` at a time (sibling: `RwLock<T>`,
///           many readers OR one writer).
/// Why:      The engine update callback must be `Send`, so progress debounce state
///           cannot be an `Rc`; an `Arc<Mutex<_>>` crosses into the UI callback
///           safely and still mutates only one small state object (no need for
///           `RwLock`'s reader/writer split).
/// Gotcha:   a `Mutex` in Rust WRAPS the data it guards; you reach the value only
///           by locking. There is no "forgot to lock" path like a bare JS object.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const progressDebouncer = new ProgressDebouncer(); // GC + single thread: no lock
/// ```
use std::sync::{Arc, Mutex};

/// What:     `use std::time::Instant;`. `Instant` is a monotonic timestamp (only
///           ever moves forward). Sibling: `Duration`, the elapsed span produced by
///           `Instant::elapsed`; `SystemTime`, the wall clock that can jump.
/// Why:      Progress debounce decisions use elapsed time since startup, which needs
///           the monotonic `Instant`, not the jumpy `SystemTime`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const startedAt = performance.now(); // monotonic clock
/// ```
use std::time::Instant;

/// What:     `use music_player::command::{Command, ShuffleMode, Update};`. The
///           message types from our library crate. The package is `music-player`
///           but a Rust crate identifier cannot contain `-`, so the lib crate is
///           `music_player` (the hyphen becomes an underscore).
/// Why:      We build `Command`s and read `Update`s.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Command, ShuffleMode, Update } from "music-player/command";
/// ```
use music_player::command::{Command, ShuffleMode, Update};

/// What:     `use music_player::cli::Cli;`. The clap-derived argument-parser struct
///           from our library crate (its fields are `start_playing` and `paths`).
/// Why:      `main` calls `Cli::parse()` to turn the command line into that struct.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Cli } from "music-player/cli";
/// ```
use music_player::cli::Cli;

/// What:     `use music_player::engine::Engine;`. The controller handle.
/// Why:      We spawn it and send commands.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Engine } from "music-player/engine";
/// ```
use music_player::engine::Engine;

/// What:     `use music_player::progress::ProgressDebouncer;`. The pure debounce
///           state shared with the binary-only UI bridge.
/// Why:      The binary owns the state object; `ui_progress` owns the Slint wiring.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { ProgressDebouncer } from "music-player/progress";
/// ```
use music_player::progress::ProgressDebouncer;

/// What:     `use music_player::session::Session;`. The saved-state record.
/// Why:      We load it on launch to restore the last session.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Session } from "music-player/session";
/// ```
use music_player::session::Session;

/// What:     `use music_player::pagination;`. The pure queue-pagination module.
///           Importing the MODULE (not its items) so calls read `pagination::paginate`
///           / `pagination::page_of_index`, keeping the origin obvious at the call.
/// Why:      The binary groups the queue's display paths into pages: one per top-
///           level folder for subfolder tracks, A-Z + `#` letter pages for root-
///           level tracks.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as pagination from "music-player/pagination";
/// ```
use music_player::pagination;

/// What:     `use music_player::launcher::{self, Launcher};`. The desktop-shell
///           integration: `self` re-imports the MODULE itself (so `launcher::set_window_app_id`
///           still resolves), and `Launcher` pulls in the struct that emits KDE
///           taskbar progress.
/// Why:      `main` installs the app-id hook via the module path and constructs a
///           `Launcher`, so it needs both the module and the type in scope.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import * as launcher from "music-player/launcher";
/// import { Launcher } from "music-player/launcher";
/// ```
use music_player::launcher::{self, Launcher};

/// What:     `use clap::Parser;`. The `Parser` TRAIT whose `parse()` method reads the
///           process arguments into a `Cli`. The matching `#[derive(Parser)]` MACRO
///           lives beside the struct in `cli.rs`; here we import only the trait so we
///           can CALL `Cli::parse()` (a trait method needs its trait in scope).
/// Why:      Without the trait in scope, `Cli::parse()` would not resolve.
/// Gotcha:   in Rust a method can come from a TRAIT, and the trait must be imported
///           to call it, even though `Cli` is already in scope. There is no TS
///           analogue: TS methods always live on the value itself.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { parseArgs } from "some-cli-parser";
/// ```
use clap::Parser;

/// What:     `use i_slint_backend_winit::Backend;`. Slint's winit backend, built
///           explicitly so a window-attributes hook can run.
/// Why:      The default backend selector gives no hook to set the Wayland app id.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Backend } from "slint-winit-backend";
/// ```
use i_slint_backend_winit::Backend;

/// What:     `use slint::{ComponentHandle, Model, SharedString, VecModel};`.
///           `ComponentHandle` is the trait giving `.as_weak()`/`.run()` on the
///           window; `Model` is the trait whose `.iter()` reads a list property
///           back (we re-read the full `queue` model to repaginate); `SharedString`
///           is Slint's cheap-to-clone string (sibling: `String`, which would force
///           a fresh allocation on every clone); `VecModel` builds the list model
///           behind a list property. (The `ModelRc` a setter wants is produced by
///           `.into()`, so it needs no import.)
/// Why:      Needed to drive the window, read its `queue`, and set its list props;
///           `SharedString` over `String` because Slint clones these strings often
///           and a refcounted clone is far cheaper than reallocating.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { ComponentHandle, Model, SharedString, VecModel } from "slint";
/// ```
use slint::{ComponentHandle, Model, SharedString, VecModel};

/// What:     `use ui_page::{set_now_playing, set_queue_model, PageNav};`. The sibling module's
///           page-navigation intent type and the property-setter helpers.
/// Why:      `refresh_page` and `apply_update` below project engine `Update`s onto Slint
///           properties through these.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { setNowPlaying, setQueueModel, PageNav } from "./ui_page";
/// ```
use ui_page::{set_now_playing, set_queue_model, PageNav};

/// What:     `fn shuffle_to_int(mode: ShuffleMode) -> i32`. Map the enum to the
///           integer the UI property uses (Off=0, WithinPage=1, All=2). `i32` is a
///           32-bit signed integer; siblings: `u32` (unsigned), `i64`/`usize`.
/// Why:      Slint has no Rust enum; it stores the mode as an `int` (which is `i32`
///           on the Rust side) the radio group compares against, so `i32` matches
///           the generated property type exactly.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function shuffleToInt(mode: ShuffleMode): number { ... }
/// ```
fn shuffle_to_int(mode: ShuffleMode) -> i32 {
    // What:     `match mode { ... }`. Pattern-match each enum variant to its number.
    //           `match` is exhaustive: the compiler rejects it if a variant is
    //           unhandled, so adding a `ShuffleMode` later forces an update here.
    // Why:      Stable encoding shared with the .slint file.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // switch (mode) { ... }
    // ```
    match mode {
        // What:     `ShuffleMode::Off => 0`. The `Variant => value` arm: when `mode`
        //           is the path-qualified variant `ShuffleMode::Off`, the arm yields
        //           `0`. No trailing `;`, so the arm's value becomes the `match`'s
        //           value, which (being the function tail) is returned.
        // Why:      Off is 0.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "off": return 0;
        // ```
        ShuffleMode::Off => 0,
        // What:     `ShuffleMode::WithinPage => 1`. The within-page variant -> `1`.
        // Why:      WithinPage is 1.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "withinPage": return 1;
        // ```
        ShuffleMode::WithinPage => 1,
        // What:     `ShuffleMode::All => 2`. The all variant -> `2`.
        // Why:      All is 2.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "all": return 2;
        // ```
        ShuffleMode::All => 2,
    }
}

/// What:     `fn int_to_shuffle(value: i32) -> ShuffleMode`. Inverse of the above:
///           the UI radio's selected `i32` back into a `ShuffleMode` enum value.
/// Why:      Turn the radio group's selected integer back into a `ShuffleMode`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function intToShuffle(value: number): ShuffleMode { ... }
/// ```
fn int_to_shuffle(value: i32) -> ShuffleMode {
    // What:     `match value { 1 => WithinPage, 2 => All, _ => Off }`. The wildcard
    //           `_` arm matches anything not matched above (including 0 and any
    //           out-of-range int) and maps it to Off.
    // Why:      Defensive default to Off for any unexpected integer.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return value === 1 ? "withinPage" : value === 2 ? "all" : "off";
    // ```
    match value {
        // What:     `1 => ShuffleMode::WithinPage`. Integer literal arm -> variant.
        // Why:      1 is WithinPage.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case 1: return "withinPage";
        // ```
        1 => ShuffleMode::WithinPage,
        // What:     `2 => ShuffleMode::All`. Integer literal arm -> variant.
        // Why:      2 is All.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case 2: return "all";
        // ```
        2 => ShuffleMode::All,
        // What:     `_ => ShuffleMode::Off`. The catch-all wildcard arm.
        // Why:      Default for every other integer.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // default: return "off";
        // ```
        _ => ShuffleMode::Off,
    }
}

/// What:     `fn format_time(secs: f64) -> String`. Format seconds as "m:ss".
///           `f64` is a 64-bit float (sibling: `f32`); `String` is an owned heap
///           string (sibling: `&str`, a borrowed view we could not return here
///           because it would point at this function's freed locals).
/// Why:      Slint number-to-string is awkward, so we format here and pass strings;
///           the result is `String` (owned) so the caller can keep it past this call.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function formatTime(secs: number): string { ... }
/// ```
pub(crate) fn format_time(secs: f64) -> String {
    // What:     `let whole = if secs > 0.0 { secs as u64 } else { 0 };`. `if/else`
    //           used as an EXPRESSION (both arms yield a value). `secs as u64` is a
    //           numeric CAST that truncates the float toward zero into a 64-bit
    //           unsigned integer (`u64`; siblings: `u32`, `usize`). The else arm
    //           clamps negatives and NaN to 0.
    // Why:      Avoid negative or garbage times; `u64` because a track length never
    //           needs a sign and easily fits a 64-bit count of seconds.
    // Gotcha:   `as u64` is a SATURATING/truncating cast, not TS's `Number` coercion:
    //           NaN becomes 0 and the fraction is dropped, with no exception.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const whole = secs > 0 ? Math.floor(secs) : 0;
    // ```
    let whole = if secs > 0.0 { secs as u64 } else { 0 };
    // What:     `format!("{}:{:02}", whole / 60, whole % 60)`. The `format!` MACRO
    //           builds an owned `String` from a template: `{}` interpolates minutes
    //           (`whole / 60`, integer division) and `{:02}` interpolates seconds
    //           (`whole % 60`) zero-padded to 2 digits. No trailing `;`, so this is
    //           the function's tail expression and is returned.
    // Why:      "3:07" style display.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
    // ```
    format!("{}:{:02}", whole / 60, whole % 60)
}

/// What:     `fn refresh_page(app: &AppWindow, target: PageNav)`. Rebuild the
///           page-tab list and the visible page from the full `queue` property.
///           `app: &AppWindow` is a BORROWED, read-only reference to the window (we
///           only call its getters/setters, we do not own it). `target` is a `PageNav`:
///           `Show(page)` to show a specific page, `Follow` to jump to the current
///           track's page, or `Keep` to preserve the page already shown. No `-> ...`, so
///           it returns `()` (the unit type, like TS `void`). Runs on the UI thread.
/// Why:      One place derives the pagination view, so the tabs, the visible rows,
///           and the selected tab can never disagree.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function refreshPage(app: AppWindow, target: PageNav): void { ... }
/// ```
fn refresh_page(app: &AppWindow, target: PageNav) {
    // What:     `let names: Vec<String> = app.get_queue().iter().map(|s| s.to_string()).collect();`.
    //           `app.get_queue()` returns the full-list model (`ModelRc<SharedString>`);
    //           `.iter()` (from the `Model` trait) walks it yielding `SharedString`;
    //           `.map(|s| s.to_string())` copies each into an OWNED `String` (the
    //           `|s| ...` is a closure, `.to_string()` allocates); `.collect()`
    //           gathers them into the `Vec<String>` named by the annotation (a
    //           heap-allocated growable array; sibling `&[String]` is a borrowed view).
    // Why:      Re-read the canonical full list to regroup it into pages; owned
    //           `String`s because `paginate` keeps them past the borrowed model.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const names: string[] = [...app.queue];
    // ```
    let names: Vec<String> = app.get_queue().iter().map(|s| s.to_string()).collect();
    // What:     `let pages = pagination::paginate(&names);`. Call the module function,
    //           passing `&names` which BORROWS the vector (lends it read-only without
    //           giving up ownership). Returns the grouped pages (folder pages, then
    //           A-Z letter pages, then `#`).
    // Why:      The single source of the tabs and page contents; borrowing avoids
    //           copying the whole list into the callee.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const pages = pagination.paginate(names);
    // ```
    let pages = pagination::paginate(&names);

    // What:     `let labels: Vec<SharedString> = pages.iter().map(|page| SharedString::from(page.label.as_str())).collect();`.
    //           `.iter()` borrows each `page`; the closure takes its `label` (a
    //           `String`), `.as_str()` borrows it as `&str`, and `SharedString::from`
    //           builds the Slint string the model holds. `.collect()` gathers them
    //           into a `Vec<SharedString>`.
    // Why:      The tab captions, one per page, in page order.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const labels = pages.map((page) => page.label);
    // ```
    let labels: Vec<SharedString> = pages
        .iter()
        .map(|page| SharedString::from(page.label.as_str()))
        .collect();
    // What:     `app.set_page_labels(Rc::new(VecModel::from(labels)).into());`.
    //           `VecModel::from(labels)` wraps the vector in a list model;
    //           `Rc::new(...)` puts it behind a shared-ownership pointer; `.into()`
    //           converts that `Rc<VecModel>` into the `ModelRc` the setter wants;
    //           `set_page_labels` is the generated setter for the `page-labels`
    //           property.
    // Why:      Push the tab list to the UI.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.pageLabels = labels;
    // ```
    app.set_page_labels(Rc::new(VecModel::from(labels)).into());

    // What:     `let requested: i32 = match target { ... };`. A `match` used as an
    //           EXPRESSION assigned to `requested`. Decides which page to show: the
    //           explicit one, the page already shown, or the page of the current track.
    // Why:      `Show` carries an explicit page; `Keep` preserves the current page; `Follow`
    //           computes the current track's page.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const requested: number = target.kind === "show" ? target.page : target.kind === "keep" ? app.selectedPage : pageOfCurrent();
    // ```
    let requested: i32 = match target {
        // What:     `PageNav::Show(page) => page`. Destructure the explicit page and yield it.
        // Why:      Honour the explicitly clicked tab (or page 0 on a fresh open).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (target.kind === "show") return target.page;
        // ```
        PageNav::Show(page) => page,
        // What:     `PageNav::Keep => app.get_selected_page()`. Yield the page already shown.
        // Why:      A rescan reconcile must not move the user's tab; clamping below still keeps
        //           it in range if the page count shrank.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (target.kind === "keep") return app.selectedPage;
        // ```
        PageNav::Keep => app.get_selected_page(),
        // What:     `PageNav::Follow => { ... }`. The follow arm; its `{ ... }` block computes
        //           the page to follow the current track.
        // Why:      Keep the playing row visible after a track change.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // /* compute from current track */
        // ```
        PageNav::Follow => {
            // What:     `let index = app.get_current_index();`. The playing track's
            //           load-order index, or `-1` when nothing is playing.
            // Why:      We map it onto a page.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const index = app.currentIndex;
            // ```
            let index = app.get_current_index();
            // What:     `if index < 0 { app.get_selected_page() } else { ... }`. An
            //           `if/else` EXPRESSION (both arms yield an `i32`). With no
            //           current track (-1), keep the page the user is already viewing;
            //           otherwise find the page holding that track.
            // Why:      Do not yank the view to page 0 when nothing is playing.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return index < 0 ? app.selectedPage : (pageOfIndex(pages, index) ?? app.selectedPage);
            // ```
            if index < 0 {
                app.get_selected_page()
            } else {
                // What:     `match pagination::page_of_index(&pages, index as usize) { ... }`.
                //           `index as usize` casts the `i32` to `usize` (the pointer-
                //           sized unsigned index type std collections want; siblings
                //           `u32`/`u64`); `page_of_index` returns `Option<usize>`
                //           (`Some(page)` or `None`).
                // Why:      Locate the current track's page.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const found = pageOfIndex(pages, index);
                // ```
                match pagination::page_of_index(&pages, index as usize) {
                    // What:     `Some(page) => page as i32`. Destructure the found
                    //           page index (`usize`) and `as i32` widens it back to the
                    //           property's signed type.
                    // Why:      Show that page.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // if (found !== null) return found;
                    // ```
                    Some(page) => page as i32,
                    // What:     `None => app.get_selected_page()`. Not found (stale
                    //           index mid-update); keep the current view.
                    // Why:      Safe fallback.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // return app.selectedPage;
                    // ```
                    None => app.get_selected_page(),
                }
            }
        }
    };

    // What:     `let clamped: i32 = if pages.is_empty() { 0 } else { requested.clamp(0, pages.len() as i32 - 1) };`.
    //           An `if/else` EXPRESSION. With no pages, page 0; otherwise
    //           `i32::clamp(lo, hi)` returns the nearest bound when `requested` is
    //           outside `[0, len-1]`. `pages.len()` is a `usize` count, `as i32`
    //           narrows it.
    // Why:      A stale or out-of-range page index must not index past the pages.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const clamped = pages.length ? Math.min(Math.max(requested, 0), pages.length - 1) : 0;
    // ```
    let clamped: i32 = if pages.is_empty() {
        0
    } else {
        requested.clamp(0, pages.len() as i32 - 1)
    };

    // What:     `let items: Vec<PageItem> = match pages.get(clamped as usize) { ... };`.
    //           `clamped as usize` casts the index; `pages.get(i)` returns
    //           `Option<&Page>` (`None` when out of range, instead of panicking like
    //           `pages[i]` would). A `match` builds the selected page's rows as the
    //           generated `PageItem` struct.
    // Why:      The ListView shows only this page's tracks.
    // Gotcha:   `.get(i)` is the SAFE indexer returning an `Option`; `pages[i]`
    //           would panic on an out-of-range index. Prefer `.get` for fallbacks.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const items = (pages[clamped]?.entries ?? []).map((e) => ({ name: e.name, index: e.index }));
    // ```
    let items: Vec<PageItem> = match pages.get(clamped as usize) {
        // What:     `Some(page) => page.entries.iter().map(|entry| PageItem { name: pagination::row_display(&page.label, &entry.name).into(), index: entry.index as i32 }).collect()`.
        //           Destructure the present page; `.iter()` borrows its entries; the closure
        //           builds a Slint `PageItem`. `pagination::row_display(&page.label, &entry.name)`
        //           lends the page LABEL and the full display NAME read-only (each `&` borrows,
        //           transferring no ownership) and returns a `&str` VIEW: the name with the
        //           `<label>/` folder prefix stripped on folder pages, or the whole name on
        //           letter / `#` pages. `.into()` then converts that `&str` into the
        //           `SharedString` field (copying it). `entry.index as i32` narrows the index.
        //           `.collect()` gathers into the `Vec<PageItem>`.
        // Why:      Show the path BELOW the folder tab (the folder name is already the tab
        //           caption), while still carrying the real queue index so a click maps back
        //           correctly.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // page.entries.map((entry) => ({ name: rowDisplay(page.label, entry.name), index: entry.index }));
        // ```
        Some(page) => page
            .entries
            .iter()
            .map(|entry| PageItem {
                name: pagination::row_display(&page.label, &entry.name).into(),
                index: entry.index as i32,
            })
            .collect(),
        // What:     `None => Vec::new()`. `Vec::new()` constructs an empty vector (no
        //           page, e.g. empty queue): no rows.
        // Why:      Show an empty list.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // [];
        // ```
        None => Vec::new(),
    };
    // What:     `app.set_page_items(Rc::new(VecModel::from(items)).into());`. Same
    //           `VecModel` -> `Rc` -> `.into()` -> `ModelRc` wrapping as the labels
    //           above; `set_page_items` sets the `page-items` property.
    // Why:      Render the selected page's rows.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.pageItems = items;
    // ```
    app.set_page_items(Rc::new(VecModel::from(items)).into());
    // What:     `app.set_selected_page(clamped);`. Set the `selected-page` property
    //           to mark which tab is active.
    // Why:      Highlight the visible tab.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.selectedPage = clamped;
    // ```
    app.set_selected_page(clamped);
}

/// What:     `fn apply_update(app: &AppWindow, update: &Update)`. Apply one engine
///           update to the window's properties. `app` is a borrowed window handle;
///           `update` is BORROWED (`&Update`) so the progress-debounce wrapper can forward
///           the very same value without rebuilding it. The match reads the payload by
///           reference. Runs on the event-loop thread.
/// Why:      Keep the on-screen state mirroring the engine's state.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function applyUpdate(app: AppWindow, update: Update): void { ... }
/// ```
fn apply_update(app: &AppWindow, update: &Update) {
    // What:     `match update { ... }`. Pattern-match (and destructure) the update
    //           enum's variant; exhaustive over every `Update` case.
    // Why:      Each variant maps to one or more property setters.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // switch (update.kind) { ... }
    // ```
    match update {
        // What:     `Update::Queue(names) => { ... }`. Tuple-variant pattern: binds
        //           the variant's single payload (the `Vec<String>` of names) to
        //           `names`, moving it out of `update`.
        // Why:      Render the filenames.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "queue": { const { names } = update; ... }
        // ```
        Update::Queue(names) => {
            // What:     `set_queue_model(app, names);`. Store the full list (consuming `names`).
            // Why:      The canonical full list; the visible rows come from the paginated
            //           `page-items` set inside `refresh_page` just below.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // setQueueModel(app, names);
            // ```
            set_queue_model(app, names);
            // What:     `refresh_page(app, PageNav::Show(0));`. Rebuild the tabs and show the
            //           first page. A fresh queue (open/restore) resets to page 0; the
            //           `NowPlaying` update that follows a restore then jumps to the current
            //           track's page.
            // Why:      A fresh queue starts at the first tab.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // refreshPage(app, { kind: "show", page: 0 });
            // ```
            refresh_page(app, PageNav::Show(0));
        }
        // What:     `Update::NowPlaying { index, name, duration } => { ... }`. A
        //           STRUCT-variant pattern: destructures the variant's named fields
        //           directly into the locals `index`, `name`, `duration`.
        // Why:      Update the now-playing label, highlight, and seek-bar max.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "nowPlaying": { const { index, name, duration } = update; ... }
        // ```
        Update::NowPlaying {
            index,
            name,
            duration,
        } => {
            // What:     `set_now_playing(app, index, name, duration);`. Mirror the title, seek-bar
            //           maximum and total-time label, and the highlighted row.
            // Why:      A track change refreshes the now-playing view.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // setNowPlaying(app, index, name, duration);
            // ```
            set_now_playing(app, *index, name, *duration);
            // What:     `refresh_page(app, PageNav::Follow);`. FOLLOW the now-playing track:
            //           switch the visible page to the one holding it so the highlighted row
            //           stays on screen after Next / auto-advance / a row selection.
            // Why:      Keep the playing track visible across track changes.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // refreshPage(app, { kind: "follow" });
            // ```
            refresh_page(app, PageNav::Follow);
        }
        // What:     `Update::Reconciled { names, index, name, duration } => { ... }`. A live
        //           rescan reconciled the queue with disk: refresh the list AND the now-playing
        //           view, but keep the user's current tab.
        // Why:      An on-disk change to other files must not move the selected tab or track.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "reconciled": { const { names, index, name, duration } = update; ... }
        // ```
        Update::Reconciled {
            names,
            index,
            name,
            duration,
        } => {
            // What:     `set_queue_model(app, names);`. Replace the full list with the reconciled
            //           paths (rows may have been added or removed).
            // Why:      The list must reflect the new on-disk contents.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // setQueueModel(app, names);
            // ```
            set_queue_model(app, names);
            // What:     `set_now_playing(app, index, name, duration);`. Refresh the title and the
            //           highlighted row (the current track's index may have shifted).
            // Why:      The same track stays selected; only its position in the list may differ.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // setNowPlaying(app, index, name, duration);
            // ```
            set_now_playing(app, *index, name, *duration);
            // What:     `refresh_page(app, PageNav::Keep);`. Repaginate but KEEP the current tab.
            // Why:      A reconcile must not yank the user off the page they are browsing, even
            //           when the queue or the current track's page changed.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // refreshPage(app, { kind: "keep" });
            // ```
            refresh_page(app, PageNav::Keep);
        }
        // What:     `Update::Position(secs) => { ... }`. Tuple-variant pattern binding
        //           the live playback position (`f64` seconds) to `secs`.
        // Why:      Move the seek bar and update the elapsed label.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "position": { const { secs } = update; ... }
        // ```
        Update::Position(secs) => {
            // What:     `app.set_position(secs as f32);`. `as f32` narrows to Slint's
            //           float for the slider thumb position.
            // Why:      Slider thumb position.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // app.position = secs;
            // ```
            app.set_position(*secs as f32);
            // What:     `app.set_position_text(format_time(secs).into());`. Format the
            //           elapsed seconds and `.into()` to `SharedString`.
            // Why:      Elapsed-time label.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // app.positionText = formatTime(secs);
            // ```
            app.set_position_text(format_time(*secs).into());
        }
        // What:     `Update::Playing(on) => app.set_playing(on)`. One-line arm: bind
        //           the play/pause boolean `on` and set the `playing` property.
        // Why:      Toggle the button label.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "playing": app.playing = on; break;
        // ```
        Update::Playing(on) => app.set_playing(*on),
        // What:     `Update::Volume(v) => app.set_volume(v)`. Bind the volume `v`
        //           (already an `f32`) and set the `volume` property.
        // Why:      Sync the slider.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "volume": app.volume = v; break;
        // ```
        Update::Volume(v) => app.set_volume(*v),
        // What:     `Update::Shuffle(mode) => app.set_shuffle_mode(shuffle_to_int(mode))`.
        //           Bind the `ShuffleMode`, encode it to an int via the helper, and
        //           set the radio group's property.
        // Why:      Highlight the selected shuffle radio.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "shuffle": app.shuffleMode = shuffleToInt(mode); break;
        // ```
        Update::Shuffle(mode) => app.set_shuffle_mode(shuffle_to_int(*mode)),
        // What:     `Update::RepeatTrack(on) => app.set_repeat_track(on)`. Bind the
        //           repeat-track boolean and set the checkbox property.
        // Why:      Check/uncheck the repeat-track box.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // case "repeatTrack": app.repeatTrack = on; break;
        // ```
        Update::RepeatTrack(on) => app.set_repeat_track(*on),
    }
}



/// What:     `fn xdg_user_dir_music() -> Option<PathBuf>`. Last-resort lookup: shell
///           out to the `xdg-user-dir MUSIC` command and use its printed path. The
///           return is `Option<PathBuf>`: `Some(path)` on success, `None` otherwise
///           (Rust has no `null`; absence is modeled by the `Option` enum).
/// Why:      Some setups (and some `directories` parsing gaps) leave the music dir
///           discoverable only through the official `xdg-user-dir` tool; this is the
///           fallback when the env var and the user-dirs file both come up empty.
/// What:     `#[cfg(unix)]` compiles this Unix version of the helper only on Unix
///           targets (Linux/macOS/BSD); the `#[cfg(not(unix))]` stub just below
///           replaces it on Windows. `unix` is a built-in cfg covering the whole
///           Unix family; siblings: `windows`, `target_os = "linux"`.
/// Why:      `xdg-user-dir` is a freedesktop CLI tool that exists only on Unix
///           desktops; on Windows the spawn would always fail, so gate it out and
///           let the stub return `None` instead of wasting a process spawn.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function xdgUserDirMusic(): string | null { ... } // Unix-only implementation
/// ```
#[cfg(unix)]
fn xdg_user_dir_music() -> Option<PathBuf> {
    // What:     `let output = std::process::Command::new("xdg-user-dir").arg("MUSIC").output().ok()?;`.
    //           `Command::new(name)` starts a process builder; `.arg("MUSIC")` adds an
    //           argument; `.output()` runs it to completion and returns
    //           `io::Result<Output>` (stdout/stderr/status). `.ok()` converts that
    //           `Result` into an `Option` (DROPPING the error); the `?` then unwraps
    //           the `Option`, RETURNING `None` from this whole function if the command
    //           could not run (e.g. the tool is not installed, as in the container).
    // Why:      Ask the OS where the music directory is; treat "could not run" as
    //           "no answer" rather than an error to propagate.
    // Gotcha:   `?` here is EARLY RETURN, not optional chaining: on `None` it exits
    //           the function returning `None`. Combined with `.ok()` it also silently
    //           discards the underlying I/O error.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let output;
    // try { output = spawnSync("xdg-user-dir", ["MUSIC"]); } catch { return null; }
    // ```
    let output = std::process::Command::new("xdg-user-dir")
        .arg("MUSIC")
        .output()
        .ok()?;
    // What:     `if !output.status.success() { return None; }`. `status.success()` is
    //           `true` only on exit code 0; `!` negates it; an early `return None`
    //           constructs the empty `Option`.
    // Why:      A failed command yields no usable path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (output.status !== 0) return null;
    // ```
    if !output.status.success() {
        return None;
    }
    // What:     `let text = String::from_utf8(output.stdout).ok()?;`. `output.stdout`
    //           is the raw bytes (`Vec<u8>`); `String::from_utf8` validates them as
    //           UTF-8 returning `Result<String, _>`; `.ok()?` yields the `String` or
    //           early-returns `None` on invalid UTF-8.
    // Why:      We need the printed path as text.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const text = output.stdout.toString("utf8");
    // ```
    let text = String::from_utf8(output.stdout).ok()?;
    // What:     `let trimmed = text.trim();`. `.trim()` returns a BORROWED `&str`
    //           view of `text` with leading/trailing whitespace (including the
    //           trailing newline) removed; no new allocation.
    // Why:      Command output ends in a newline we must strip.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const trimmed = text.trim();
    // ```
    let trimmed = text.trim();
    // What:     `if trimmed.is_empty() { return None; }`. `.is_empty()` is `true` for
    //           a zero-length string; early-return the empty `Option`.
    // Why:      No path was printed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!trimmed) return null;
    // ```
    if trimmed.is_empty() {
        return None;
    }
    // What:     `if let Some(home) = std::env::var_os("HOME") && Path::new(&home) == Path::new(trimmed) { return None; }`.
    //           A LET-CHAIN `if`: it runs the body only if BOTH `var_os("HOME")` is
    //           `Some(home)` (the env var is set) AND the two paths are equal.
    //           `Path::new(x)` wraps a borrowed `&OsStr`/`&str` as a `&Path` with no
    //           allocation (unlike `PathBuf::from`, which would allocate); `&Path ==
    //           &Path` compares by path components. `&home` borrows the `OsString`.
    // Why:      `xdg-user-dir MUSIC` prints `$HOME` when no music dir is configured;
    //           reject that case to avoid auto-loading the entire home directory.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const home = process.env.HOME;
    // if (home !== undefined && home === trimmed) return null;
    // ```
    if let Some(home) = std::env::var_os("HOME")
        && Path::new(&home) == Path::new(trimmed) {
            return None;
        }
    // What:     `Some(PathBuf::from(trimmed))`. `PathBuf::from(trimmed)` allocates an
    //           owned path from the borrowed `&str`; `Some(...)` wraps it as the
    //           present case of `Option`. Tail expression -> return value.
    // Why:      Hand back the discovered music directory.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return trimmed;
    // ```
    Some(PathBuf::from(trimmed))
}

/// What:     `#[cfg(not(unix))] fn xdg_user_dir_music() -> Option<PathBuf>`. The
///           non-Unix stub (Windows): same signature as the Unix version above,
///           compiled only when NOT a Unix target. `not(unix)` inverts the `unix`
///           cfg predicate.
/// Why:      Windows has no `xdg-user-dir` tool, and `music_dir()` already resolves
///           the Windows Music known-folder via the `directories` crate one step
///           earlier, so this fallback has nothing to do; keep the call site
///           platform-agnostic by returning `None`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function xdgUserDirMusic(): string | null { return null; } // non-Unix stub
/// ```
#[cfg(not(unix))]
fn xdg_user_dir_music() -> Option<PathBuf> {
    // What:     `None`. The empty case of `Option<PathBuf>` (no path); sibling
    //           `Some(p)` would carry a path. Bare tail expression -> return value.
    // Why:      Signal "this source found no music dir" on Windows.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return null;
    // ```
    None
}

/// What:     `fn music_dir() -> Option<PathBuf>`. Find the user's music directory:
///           the `XDG_MUSIC_DIR` environment variable first, then the XDG user-dirs
///           file via the `directories` crate, then the `xdg-user-dir MUSIC`
///           command. Returns `None` unless one yields an existing directory.
/// Why:      The containerized `run` task bind-mounts the host music folder and
///           exports `XDG_MUSIC_DIR` as its in-container path; a native run has no
///           such env, so we fall back to the user-dirs file and finally the
///           `xdg-user-dir` tool. The `directories` crate reads only the file, never
///           the env var, so the env lookup must be explicit here.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function musicDir(): string | null { ... }
/// ```
fn music_dir() -> Option<PathBuf> {
    // What:     `std::env::var_os("XDG_MUSIC_DIR")`. Read an environment variable as
    //           an `Option<OsString>` (raw OS bytes, not required to be UTF-8).
    //           Sibling: `var(...)` returns `Result<String, _>` and errors on
    //           non-UTF-8; `var_os` returns `None` when unset and never errors. This
    //           expression starts a method chain whose value is the function tail.
    // Why:      Paths may hold non-UTF-8 bytes, and "unset" is not an error here, so
    //           `var_os` (not `var`) is the right reader.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return (process.env.XDG_MUSIC_DIR ?? userDirs()?.audioDir ?? xdgUserDirMusic())
    //   ?.let((p) => isDir(p) ? p : null) ?? null;
    // ```
    std::env::var_os("XDG_MUSIC_DIR")
        // What:     `.map(PathBuf::from)`. On `Some(osStr)`, convert the `OsString`
        //           into an owned `PathBuf`; passing `PathBuf::from` (the function
        //           itself) is the closure shorthand. `None` stays `None`.
        // Why:      We want a path, not a raw OS string.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // (process.env.XDG_MUSIC_DIR as path | undefined)
        // ```
        .map(PathBuf::from)
        // What:     `.or_else(|| ...)`. If the env var was unset (`None`), run the
        //           zero-argument closure `|| ...` to compute a fallback. `or_else`
        //           is LAZY: the closure runs only on `None` (sibling `.or(x)` would
        //           evaluate `x` eagerly).
        // Why:      A native run has no `XDG_MUSIC_DIR` env; read the user-dirs file
        //           only when needed.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // ?? userDirs()?.audioDir
        // ```
        .or_else(|| {
            // What:     `directories::UserDirs::new().and_then(|dirs| dirs.audio_dir().map(|p| p.to_path_buf()))`.
            //           `UserDirs::new()` is `Option<UserDirs>`; `.and_then(...)` runs
            //           the closure only when present and flattens the nested
            //           `Option`; `dirs.audio_dir()` is `Option<&Path>` parsed from the
            //           XDG user-dirs file; `.map(|p| p.to_path_buf())` turns the
            //           borrowed `&Path` into an owned `PathBuf`.
            // Why:      Standard music-dir lookup for a native (non-container) run.
            // Gotcha:   `.and_then` is the `Option`-flattening combinator (`flatMap`),
            //           NOT `.map`; using `.map` here would give `Option<Option<_>>`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // userDirs()?.audioDir;
            // ```
            directories::UserDirs::new()
                .and_then(|dirs| dirs.audio_dir().map(|p| p.to_path_buf()))
        })
        // What:     `.or_else(xdg_user_dir_music)`. If both the env var and the
        //           user-dirs file came up empty, fall back to the `xdg-user-dir`
        //           command. Passing the function by name is the closure shorthand
        //           (its signature `() -> Option<PathBuf>` matches what `or_else`
        //           wants).
        // Why:      Final fallback for setups where only the tool knows the path.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // ?? xdgUserDirMusic()
        // ```
        .or_else(xdg_user_dir_music)
        // What:     `.filter(|p| p.is_dir())`. Keep the path only if the closure is
        //           `true`, i.e. it exists and is a directory; otherwise the whole
        //           `Option` becomes `None`. `|p|` borrows the path.
        // Why:      Do not feed a missing or non-directory path to the engine.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // // ?.let((p) => isDir(p) ? p : null)
        // ```
        .filter(|p| p.is_dir())
}

/// What:     `fn main() -> Result<()>`. The entry point. The return type is
///           `anyhow`'s success-or-error enum: `Ok(())` (success with the unit
///           value, like `void`) or `Err(anyhow::Error)`. Returning `Err` from
///           `main` makes the process exit non-zero and prints the error.
/// Why:      Propagate window/backend failure (e.g. no display server) as the exit
///           status, rather than panicking.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function main(): Promise<void> { ... } // throws on platform failure
/// ```
fn main() -> Result<()> {
    // What:     `music_player::logging::init();`. Install the stderr tracing subscriber
    //           before anything else, so startup events have a sink. Idempotent.
    // Why:      Every `tracing` event from this crate and `truepeak-core` needs a sink;
    //           `RUST_LOG` tunes the level (default `info`).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // logging.init();
    // ```
    music_player::logging::init();
    // What:     `let cli = Cli::parse();`. Read and validate the command-line
    //           arguments FIRST, before any backend, window, or GPU setup.
    //           `Cli::parse()` (from the `clap::Parser` trait) reads the real process
    //           arguments; on `--help` / `--version` / a bad argument it prints and
    //           EXITS the process right here, by clap's design.
    // Why:      Parsing up front means `--help`, `--version`, and argument errors
    //           return instantly without first constructing a Slint backend and
    //           window; the parsed `cli` is consumed near the end to seed the queue.
    // Gotcha:   `Cli::parse()` itself calls `process::exit` on `--help`/bad input;
    //           that is clap's library behavior, not our code, and is the standard
    //           CLI contract (so it never returns in those cases).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const cli = parseArgs(process.argv); // prints help / exits on bad args
    // ```
    let cli = Cli::parse();

    // What:     Install Slint's winit backend explicitly, with a window-attributes
    //           hook that stamps the Wayland app id. This `{ ... }` is a BARE BLOCK
    //           SCOPE: the locals inside (`builder`, `backend`, ...) are dropped at
    //           its closing brace. This MUST happen before the first window is
    //           created (which would lock in the default platform).
    // Why:      KDE attaches taskbar progress to the running window only when the
    //           window's app id matches the `.desktop` file; the default backend
    //           selector offers no hook to set it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (process.env.SLINT_MCP_PORT === undefined) {
    //   const backend = winitBackend({ windowAttributesHook: setWindowAppId });
    //   slint.setPlatform(backend);
    // }
    // ```
    //
    // What:     Gate the whole explicit-backend block on `SLINT_MCP_PORT` being UNSET
    //           (`std::env::var_os(...).is_none()`).
    // Why:      Slint 1.17's embedded MCP server (the `slint/mcp` feature activated by
    //           SLINT_MCP_PORT, used by the `mcp` mise task for agent-driven UI
    //           testing) only starts when SLINT ITSELF creates the backend through its
    //           selector (`with_global_context` -> `init_testing_backends` ->
    //           `mcp_server::init`). Calling `set_platform` here would bypass that path,
    //           so the server would never bind AND `SLINT_BACKEND=headless` would be
    //           ignored (a real window would open). When the port is set we therefore
    //           let Slint pick the backend, honoring SLINT_BACKEND; the Wayland app-id
    //           hook is the only thing dropped, and only for that test-only run.
    if std::env::var_os("SLINT_MCP_PORT").is_none() {
        // What:     `let mut builder = Backend::builder().with_window_attributes_hook(launcher::set_window_app_id);`.
        //           `Backend::builder()` starts a backend builder; `.with_window_attributes_hook(fn)`
        //           registers the app-id hook (passed by name). `mut` marks the
        //           binding MUTABLE because a later line may reassign `builder`.
        // Why:      The hook runs for each window Slint creates (here, the one); `mut`
        //           is needed because the software-renderer branch reassigns it.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let builder = Backend.builder().withWindowAttributesHook(setWindowAppId);
        // ```
        let mut builder =
            Backend::builder().with_window_attributes_hook(launcher::set_window_app_id);
        // What:     `let force_software = std::env::var("SLINT_BACKEND").map(|value| value.contains("software")).unwrap_or(false);`.
        //           `var(...)` returns `Result<String, _>`; `.map(closure)` runs only
        //           on `Ok`, testing whether the value contains "software";
        //           `.unwrap_or(false)` extracts the `Ok(bool)` or SUBSTITUTES `false`
        //           if the var was unset/non-UTF-8 (dropping the error).
        // Why:      Honor the run task's software-renderer escape hatch.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const forceSoftware = (process.env.SLINT_BACKEND ?? "").includes("software");
        // ```
        let force_software = std::env::var("SLINT_BACKEND")
            .map(|value| value.contains("software"))
            .unwrap_or(false);
        // What:     `if force_software { builder = builder.with_renderer_name("software"); }`.
        //           Reassign `builder` (allowed because it is `mut`) to one pinned to
        //           the software renderer by Slint winit's renderer token. This is
        //           `software`, not Cargo's `renderer-software` feature name.
        // Why:      Match the previous behaviour for headless / no-GPU runs.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (forceSoftware) builder = builder.withRendererName("software");
        // ```
        if force_software {
            builder = builder.with_renderer_name("software");
        }
        // What:     `let backend = builder.build()?;`. `.build()` returns
        //           `Result<Backend, PlatformError>`; the `?` unwraps `Ok` or RETURNS
        //           the `Err` from `main` (e.g. no display server).
        // Why:      Construction can fail if `WAYLAND_DISPLAY`/`DISPLAY` is unset.
        // Gotcha:   `?` on a `Result` propagates the ERROR out of `main`; it is early
        //           return, not optional chaining.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const backend = builder.build(); // throws PlatformError on failure
        // ```
        let backend = builder.build()?;
        // What:     `slint::platform::set_platform(Box::new(backend)).expect("no Slint platform should already be set");`.
        //           `Box::new(backend)` moves the backend onto the heap behind an
        //           owning pointer (the API wants a `Box<dyn Platform>` trait object;
        //           siblings `Rc`/`Arc` would add sharing we do not need).
        //           `set_platform` returns a `Result`; `.expect(msg)` unwraps `Ok` or
        //           PANICS with `msg` on `Err`.
        // Why:      Make it the process platform so the later `AppWindow::new()` uses
        //           this backend and its hook; `.expect` because the only failure is
        //           "a platform was already set", which cannot happen here (first
        //           Slint call).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // slint.setPlatform(backend); // throws if a platform was already set
        // ```
        slint::platform::set_platform(Box::new(backend))
            .expect("no Slint platform should already be set");
    }

    // What:     `let app = AppWindow::new()?;`. `AppWindow::new()` returns
    //           `Result<AppWindow, PlatformError>`; the `?` unwraps `Ok` or returns
    //           the error from `main`.
    // Why:      We need the window before wiring anything.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const app = new AppWindow();
    // ```
    let app = AppWindow::new()?;

    // What:     `let weak = app.as_weak();`. `.as_weak()` makes a WEAK handle to the
    //           window: it does not keep the window alive, and can be sent to other
    //           threads and `upgrade()`d back to a strong handle ON the event-loop
    //           thread.
    // Why:      The engine's update callback (on another thread) needs to reach the
    //           window without owning it (which would leak or cross-thread-share the
    //           non-`Send` window).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const weak = new WeakRef(app);
    // ```
    let weak = app.as_weak();

    // What:     `ui_font_scale::apply_os_font_scale(&app);` registers the callback that
    //           scales every UI font to 0.9x the OS UI font once Slint's async portal
    //           read lands the real value.
    // Why:      Lives in a sibling module so `main.rs` stays under the max-lines limit;
    //           see `ui_font_scale.rs` for the async-portal and binding-loop rationale.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // applyOsFontScale(app);
    // ```
    ui_font_scale::apply_os_font_scale(&app);

    // What:     `ui_led_plate::apply(&app);` joins Slint's measured cap geometry to
    //           one Rust-generated SVG path.
    // Why:      The plate remains one surface without guessing text widths or
    //           overlapping row plates.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // applyLedPlateGeometry(app);
    // ```
    ui_led_plate::apply(&app);

    // Restore page-control preference and register settings persistence.
    ui_page_style::apply(&app);

    // What:     `let launcher = Launcher::new();`. Construct the KDE taskbar-progress
    //           emitter (a cheap-to-clone session-bus handle, or a no-op without a
    //           bus).
    // Why:      Each update tick clones one into the event-loop closure to push the
    //           current play position to the taskbar.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const launcher = Launcher.connect();
    // ```
    let launcher = Launcher::new();

    // What:     `let progress_started_at = Instant::now();`. `Instant::now()` captures
    //           a monotonic timestamp once, before update handling begins.
    // Why:      Later update callbacks turn this into elapsed time for debouncing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const progressStartedAt = performance.now();
    // ```
    let progress_started_at = Instant::now();
    // What:     `let progress_debouncer = Arc::new(Mutex::new(ProgressDebouncer::new()));`.
    //           Nested constructors: `ProgressDebouncer::new()` is the state;
    //           `Mutex::new(...)` wraps it so only one thread mutates it at a time;
    //           `Arc::new(...)` puts that behind a thread-safe shared-ownership
    //           pointer (sibling `Rc` would NOT be `Send`).
    // Why:      The engine callback is cross-thread, but all progress decisions need
    //           one shared baseline; `Arc<Mutex<_>>` is the safe cross-thread shape.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const progressDebouncer = new ProgressDebouncer(); // shared, no lock in JS
    // ```
    let progress_debouncer = Arc::new(Mutex::new(ProgressDebouncer::new()));

    // What:     `let engine = Rc::new(Engine::spawn(move |update| { ... }));`. Start
    //           the engine, giving it a callback that forwards each `Update` to the
    //           UI thread. `move |update| { ... }` is a MOVE closure: it takes
    //           ownership of the captures (`weak`, `launcher`, `progress_*`).
    //           `Rc::new(...)` wraps the engine so multiple UI callbacks can share it.
    // Why:      One engine, shared by all the button handlers.
    // Gotcha:   `move` here transfers OWNERSHIP of the captured variables into the
    //           closure (they cannot be used afterward), unlike a TS arrow that
    //           merely references them.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engine = Engine.spawn(update => postToUiThread(() => applyUpdate(app, update)));
    // ```
    let engine = Rc::new(Engine::spawn(move |update| {
        // What:     `let weak = weak.clone();`. `.clone()` of a weak handle is cheap
        //           (bumps a refcount); the outer closure is called repeatedly so it
        //           cannot move `weak` out, hence a fresh clone per call.
        // Why:      Each update needs its own handle to move into the inner closure.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const w = weak; // GC: no explicit clone needed
        // ```
        let weak = weak.clone();
        // What:     `let launcher = launcher.clone();`. Clone the progress emitter for
        //           this call (same reason as `weak`: the outer closure is `Fn` and
        //           may run many times).
        // Why:      The inner closure moves it to the UI thread to emit progress.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const l = launcher;
        // ```
        let launcher = launcher.clone();
        // What:     `let progress_debouncer = Arc::clone(&progress_debouncer);`.
        //           `Arc::clone(&x)` makes another owner of the SAME shared state by
        //           bumping the atomic refcount (the `&` lends the `Arc` to clone
        //           from). Written `Arc::clone(&x)` rather than `x.clone()` to make
        //           "this is a cheap refcount bump, not a deep copy" obvious.
        // Why:      The inner event-loop closure needs to own a handle to the same
        //           debounce state.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const progressDebouncerForUpdate = progressDebouncer;
        // ```
        let progress_debouncer = Arc::clone(&progress_debouncer);
        // What:     `let progress_elapsed = progress_started_at.elapsed();`.
        //           `.elapsed()` returns a `Duration` measuring monotonic time since
        //           the captured `Instant`.
        // Why:      Debounce decisions use time between accepted progress updates.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const progressElapsed = performance.now() - progressStartedAt;
        // ```
        let progress_elapsed = progress_started_at.elapsed();
        // What:     `let _ = slint::invoke_from_event_loop(move || { ... });`.
        //           `invoke_from_event_loop` schedules the MOVE closure to run ON the
        //           UI/event-loop thread (required for touching window properties) and
        //           returns a `Result`. `let _ =` discards that result (it errs only
        //           if the loop is gone, e.g. during shutdown).
        // Why:      Updates arrive on the engine thread but must be applied on the UI
        //           thread; failure during shutdown is safe to ignore.
        // Gotcha:   `let _ = expr` EXPLICITLY discards a value; for a `#[must_use]`
        //           `Result` it is how you say "I am intentionally ignoring this".
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // queueMicrotaskOnUiThread(() => { ... });
        // ```
        let _ = slint::invoke_from_event_loop(move || {
            // What:     `if let Some(app) = weak.upgrade() { ... }`. `upgrade()` turns
            //           the weak handle back into `Option<AppWindow>`; the `if let
            //           Some(app)` pattern runs the body only when the window still
            //           exists, binding the strong handle to `app`.
            // Why:      The window may have closed before this scheduled closure runs.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const app = weak.deref(); if (app) { ... }
            // ```
            if let Some(app) = weak.upgrade() {
                // What:     `ui_progress::apply_update_with_progress_debounce(&app, &launcher, &progress_debouncer, progress_elapsed, update);`.
                //           Call the bridge, lending `app`, `launcher`, and the
                //           debouncer by reference (`&`), and moving `progress_elapsed`
                //           and `update` in by value.
                // Why:      State updates stay immediate, while seek-bar and taskbar
                //           progress updates are rate-limited.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // uiProgress.applyUpdateWithProgressDebounce(app, launcher, progressDebouncer, progressElapsed, update);
                // ```
                ui_progress::apply_update_with_progress_debounce(
                    &app,
                    &launcher,
                    &progress_debouncer,
                    progress_elapsed,
                    update,
                );
            }
        });
    }));

    // What:     `app.on_toggle_play({ let engine = engine.clone(); move || engine.send(Command::TogglePlay) });`.
    //           Register the play/pause handler. The `{ ... }` BLOCK EXPRESSION clones
    //           the `Rc<Engine>` and evaluates to a `move` closure that owns the
    //           clone. `on_toggle_play` is the generated registrar for the
    //           `toggle-play` callback.
    // Why:      Button press -> engine command.
    // Gotcha:   the `{ let engine = ...; move || ... }` block is a common Rust idiom
    //           to clone a capture BEFORE moving it into the closure, so the original
    //           `engine` stays usable for the next handler.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.onTogglePlay(() => engine.send(Command.TogglePlay));
    // ```
    app.on_toggle_play({
        // What:     `let engine = engine.clone();`. A shared-owner clone of the `Rc`
        //           for this closure (cheap: bumps the reference count).
        // Why:      The closure must own an engine handle that outlives this scope.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const e = engine;
        // ```
        let engine = engine.clone();
        // What:     `move || engine.send(Command::TogglePlay)`. A zero-argument MOVE
        //           closure (the `|| ...` is the param list) that owns the cloned
        //           `engine` and sends the toggle command.
        // Why:      Ask the engine to toggle play/pause.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // () => engine.send(Command.TogglePlay)
        // ```
        move || engine.send(Command::TogglePlay)
    });

    // What:     `app.on_prev({ ... })`. Register the previous-track handler, same
    //           clone-then-move-closure idiom as `on_toggle_play`.
    // Why:      Prev button -> `Command::Prev`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.onPrev(() => engine.send(Command.Prev));
    // ```
    app.on_prev({
        // What:     `let engine = engine.clone();`. Clone the `Rc<Engine>` for this
        //           handler's closure (refcount bump).
        // Why:      The closure needs its own owning handle.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const e = engine;
        // ```
        let engine = engine.clone();
        // What:     `move || engine.send(Command::Prev)`. Zero-arg move closure that
        //           sends the previous-track command.
        // Why:      One Prev click -> one `Prev` command.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // () => engine.send(Command.Prev)
        // ```
        move || engine.send(Command::Prev)
    });

    // What:     `app.on_next({ ... })`. Register the next-track handler.
    // Why:      Next button -> `Command::Next`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.onNext(() => engine.send(Command.Next));
    // ```
    app.on_next({
        // What:     `let engine = engine.clone();`. Clone the `Rc<Engine>` for this
        //           handler's closure.
        // Why:      The closure needs its own owning handle.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const e = engine;
        // ```
        let engine = engine.clone();
        // What:     `move || engine.send(Command::Next)`. Zero-arg move closure that
        //           sends the next-track command.
        // Why:      One Next click -> one `Next` command.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // () => engine.send(Command.Next)
        // ```
        move || engine.send(Command::Next)
    });

    // What:     `app.on_seek({ ... })`. Register the seek handler; its closure takes
    //           the slider value `secs: f32` and forwards it as `f64` seconds.
    // Why:      Dragging the seek bar jumps playback.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.onSeek((secs) => engine.send(Command.Seek(secs)));
    // ```
    app.on_seek({
        // What:     `let engine = engine.clone();`. Clone the `Rc<Engine>` for this
        //           handler's closure.
        // Why:      The closure needs its own owning handle.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const e = engine;
        // ```
        let engine = engine.clone();
        // What:     `move |secs| engine.send(Command::Seek(secs as f64))`. A move
        //           closure taking one `f32` parameter `secs`; `as f64` WIDENS it to
        //           the seconds type `Command::Seek` carries.
        // Why:      One seek drag -> one `Seek` command at the dragged position.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // (secs) => engine.send(Command.Seek(secs))
        // ```
        move |secs| engine.send(Command::Seek(secs as f64))
    });

    // What:     `app.on_set_volume({ ... })`. Register the volume handler; its closure
    //           takes the gain `v: f32`.
    // Why:      Volume slider -> `Command::SetVolume`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.onSetVolume((v) => engine.send(Command.SetVolume(v)));
    // ```
    app.on_set_volume({
        // What:     `let engine = engine.clone();`. Clone the `Rc<Engine>` for this
        //           handler's closure.
        // Why:      The closure needs its own owning handle.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const e = engine;
        // ```
        let engine = engine.clone();
        // What:     `move |v| engine.send(Command::SetVolume(v))`. A move closure
        //           taking one `f32` gain `v` and forwarding it.
        // Why:      One slider change -> one `SetVolume` command.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // (v) => engine.send(Command.SetVolume(v))
        // ```
        move |v| engine.send(Command::SetVolume(v))
    });

    // What:     `app.on_set_shuffle_mode({ ... })`. Register the shuffle radio
    //           handler; the clicked radio passes its mode integer `m: i32` (0/1/2).
    //           Map it back to the enum and send. No property read needed: the radio
    //           carries the target mode directly.
    // Why:      Selecting a shuffle radio sets that exact mode.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.onSetShuffleMode((m) => engine.send(Command.SetShuffle(intToShuffle(m))));
    // ```
    app.on_set_shuffle_mode({
        // What:     `let engine = engine.clone();`. Clone the `Rc<Engine>` for this
        //           handler's closure.
        // Why:      The closure needs its own owning handle.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const e = engine;
        // ```
        let engine = engine.clone();
        // What:     `move |m| engine.send(Command::SetShuffle(int_to_shuffle(m)))`. A
        //           move closure taking the mode int `m`, decoding it to the enum via
        //           `int_to_shuffle`, and forwarding it.
        // Why:      One radio click -> one shuffle-mode command.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // (m) => engine.send(Command.SetShuffle(intToShuffle(m)))
        // ```
        move |m| engine.send(Command::SetShuffle(int_to_shuffle(m)))
    });

    // What:     `app.on_set_repeat_track({ ... })`. Register the repeat-track checkbox
    //           handler; the checkbox passes the desired boolean `on: bool`.
    // Why:      Toggling the box sets the flag directly.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.onSetRepeatTrack((on) => engine.send(Command.SetRepeatTrack(on)));
    // ```
    app.on_set_repeat_track({
        // What:     `let engine = engine.clone();`. Clone the `Rc<Engine>` for this
        //           handler's closure.
        // Why:      The closure needs its own owning handle.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const e = engine;
        // ```
        let engine = engine.clone();
        // What:     `move |on| engine.send(Command::SetRepeatTrack(on))`. A move
        //           closure taking the desired boolean `on` and forwarding it.
        // Why:      One checkbox toggle -> one repeat-track command.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // (on) => engine.send(Command.SetRepeatTrack(on))
        // ```
        move |on| engine.send(Command::SetRepeatTrack(on))
    });

    // What:     `app.on_select_index({ ... })`. Register the row-select handler; its
    //           closure takes the queue row `i: i32` and sends it as a `usize` index.
    // Why:      A single click on an unselected row selects it (Rust loads it
    //           paused); the UI sends `TogglePlay` instead when the clicked row is
    //           already current, so this only ever carries a select.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.onSelectIndex((i) => engine.send(Command.SelectIndex(i)));
    // ```
    app.on_select_index({
        // What:     `let engine = engine.clone();`. Clone the `Rc<Engine>` for this
        //           handler's closure.
        // Why:      The closure needs its own owning handle.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const e = engine;
        // ```
        let engine = engine.clone();
        // What:     `move |i| engine.send(Command::SelectIndex(i as usize))`. A move
        //           closure taking the row `i: i32`; `as usize` casts it to the
        //           pointer-sized index type the command carries.
        // Why:      One row click -> one `SelectIndex` command.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // (i) => engine.send(Command.SelectIndex(i))
        // ```
        move |i| engine.send(Command::SelectIndex(i as usize))
    });
    // What:     `app.on_select_page({ ... })`. Register the tab-click handler; the
    //           closure takes the page index `p: i32`. It does NOT touch the engine:
    //           pagination is a pure display concern, so it just re-renders the
    //           chosen page from the existing `queue` property. Needs a weak handle
    //           to read/write properties.
    // Why:      Clicking a tab filters the list to that folder (or letter) page.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.onSelectPage((p) => refreshPage(app, p));
    // ```
    app.on_select_page({
        // What:     `let weak = app.as_weak();`. A WEAK handle the `'static` closure
        //           can hold (it cannot borrow `app`, which would not live long
        //           enough).
        // Why:      `refresh_page` needs the window to read `queue` and set the page.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const w = app; // WeakRef so the closure does not keep the window alive
        // ```
        let weak = app.as_weak();
        // What:     `move |p| { if let Some(app) = weak.upgrade() { refresh_page(&app, PageNav::Show(p)); } }`.
        //           A move closure taking the page `p`; `weak.upgrade()` yields
        //           `Option<AppWindow>`, the `if let Some(app)` runs only if the window
        //           still exists, and `refresh_page(&app, PageNav::Show(p))` lends the window
        //           and requests that EXACT page (not the follow-current or keep paths).
        // Why:      Show the clicked tab's tracks.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // (p) => { const app = weak.deref(); if (app) refreshPage(app, { kind: "show", page: p }); }
        // ```
        move |p| {
            if let Some(app) = weak.upgrade() {
                refresh_page(&app, PageNav::Show(p));
            }
        }
    });

    // What:     `app.on_open_files({ ... })`. Register the Open-button handler. It
    //           opens the FOLDER picker on a SEPARATE thread (the dialog blocks) and
    //           sends the chosen directory.
    // Why:      A blocking dialog must not freeze the UI event loop. The XDG portal
    //           treats files and folders as separate dialog modes, so this player
    //           picks a folder and scans it recursively (individual files are still
    //           openable via command-line arguments).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.onOpenFiles(() => { showFolderPickerAsync().then((dir) => tx.send(openPaths([dir], false))); });
    // ```
    app.on_open_files({
        // What:     `let tx = engine.sender();`. `.sender()` returns a `Send`
        //           `CommandSender` (the command channel's send end bundled with the
        //           worker handle) for the picker thread, because the `Rc<Engine>`
        //           itself is `!Send` (single-thread only).
        // Why:      The thread cannot hold the `Rc`; it holds the sender instead, and
        //           sending through it also wakes the worker.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const tx = engine.sender();
        // ```
        let tx = engine.sender();
        // What:     `move || { ... }`. The zero-argument move handler closure that owns
        //           `tx`.
        // Why:      Launch the picker when the Open button fires.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // () => { ... }
        // ```
        move || {
            // What:     `let tx = tx.clone();`. Clone the sender for this invocation.
            // Why:      Each open spawns a fresh thread that owns its own sender.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const t = tx;
            // ```
            let tx = tx.clone();
            // What:     `std::thread::spawn(move || { ... });`. `thread::spawn` starts
            //           a NEW OS thread running the move closure (which owns `tx`).
            // Why:      Run the blocking dialog off the UI thread so the UI stays
            //           responsive while it is open.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // runInWorker(() => { ... });
            // ```
            std::thread::spawn(move || {
                // What:     `if let Some(dir) = rfd::FileDialog::new().pick_folder() { ... }`.
                //           `FileDialog::new().pick_folder()` shows a folder picker (XDG
                //           portal on Wayland) and returns `Option<PathBuf>`: `Some(dir)`
                //           if the user confirmed, `None` if cancelled. The `if let
                //           Some(dir)` runs the body only on confirm.
                // Why:      Let the user enqueue a whole folder.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const dir = await showOpenDialog({ directory: true });
                // if (dir) { ... }
                // ```
                if let Some(dir) = rfd::FileDialog::new().pick_folder() {
                    // What:     `tx.send(Command::OpenRoot { root: dir, select: None, play: false });`.
                    //           The picked folder becomes the Source Root; `select: None`
                    //           opens with nothing cued; `play: false` loads PAUSED (only a
                    //           `--start-playing` command-line launch auto-plays).
                    //           `CommandSender::send` swallows a send error (engine gone)
                    //           internally, then wakes the worker; the engine scans the root.
                    // Why:      Replace the queue with the folder's tracks without surprise
                    //           playback; the user presses play.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // tx.send(Command.OpenRoot({ root: dir, select: null, play: false }));
                    // ```
                    tx.send(Command::OpenRoot {
                        root: dir,
                        select: None,
                        play: false,
                    });
                }
            });
        }
    });

    // What:     `match cli.path { Some(path) => ..., None => ... }`. The single optional
    //           positional path was parsed into `cli` at the top of `main`. A CLI path
    //           takes precedence over a saved session; with no path, restore the session.
    // Why:      Opening a path explicitly should override resuming.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (cli.path) { ... } else { ... }
    // ```
    match cli.path {
        // What:     `Some(path) => { ... }`. A CLI path: a directory becomes the Source
        //           Root with nothing selected; a file becomes its parent directory as the
        //           root with that file preselected. `path.is_dir()` tests the filesystem.
        // Why:      Exactly one directory Source Root; a single file is cued inside its
        //           folder.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (isDir(path)) engine.send(OpenRoot({ root: path, select: null, play }));
        // else engine.send(OpenRoot({ root: dirname(path), select: path, play }));
        // ```
        Some(path) => {
            if path.is_dir() {
                engine.send(Command::OpenRoot {
                    root: path,
                    select: None,
                    play: cli.start_playing,
                });
            } else {
                // What:     `path.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| PathBuf::from("."))`.
                //           The file's parent directory, or the current directory when the
                //           path has no parent (a bare filename).
                // Why:      The parent folder is the Source Root for a single-file launch.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const root = dirname(path) || ".";
                // ```
                let root = path
                    .parent()
                    .map(|p| p.to_path_buf())
                    .unwrap_or_else(|| PathBuf::from("."));
                engine.send(Command::OpenRoot {
                    root,
                    select: Some(path),
                    play: cli.start_playing,
                });
            }
        }
        // What:     `None => { ... }`. No CLI path: restore the saved session, falling back
        //           to the music directory.
        // Why:      Resume where the user left off when nothing was named on the CLI.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // else { /* restore or auto-load music dir */ }
        // ```
        None => {
            // What:     `let session = Session::load();`. Read the saved session (defaults
            //           if none/corrupt). It no longer prunes; the engine re-scans the root.
            // Why:      Resume where the user left off.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const session = Session.load();
            // ```
            let session = Session::load();
            // What:     `let root = session.source_root.clone().filter(|r| r.is_dir());`. The
            //           saved Source Root, kept only if it still exists as a directory.
            // Why:      A missing root falls back to the music directory (and is replaced on
            //           the next save), so a non-directory root is treated as absent.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const root = (session.sourceRoot && isDir(session.sourceRoot)) ? session.sourceRoot : null;
            // ```
            let root = session.source_root.clone().filter(|r| r.is_dir());
            // What:     `if let Some(root) = root { ... } else if let Some(music_dir) = music_dir() { ... }`.
            //           Restore the saved root with its Selected Track and position, else
            //           restore the music directory carrying the saved settings but no
            //           selection, else leave the queue empty.
            // Why:      Keep the user's settings even when the saved root is gone, and never
            //           leave a usable launch empty when a music directory exists.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (root) restore(root, session.selected, ...);
            // else if (musicDir()) restore(musicDir(), null, settingsOnly);
            // ```
            if let Some(root) = root {
                engine.send(Command::Restore {
                    root,
                    selected: session.selected,
                    position: session.position_secs,
                    volume: session.volume,
                    shuffle: session.shuffle,
                    repeat_track: session.repeat_track,
                });
            } else if let Some(music_dir) = music_dir() {
                engine.send(Command::Restore {
                    root: music_dir,
                    selected: None,
                    position: 0.0,
                    volume: session.volume,
                    shuffle: session.shuffle,
                    repeat_track: session.repeat_track,
                });
            }
        }
    }

    // What:     `app.run()?; Ok(())`. Show the window and run the event loop until
    //           it closes; `?` converts any `PlatformError` into `anyhow::Error`.
    //           When it returns, `app` and `engine` drop: the engine's `Drop` sends
    //           `Quit` and joins its thread, tearing down PipeWire.
    // Why:      Hand control to Slint.
    // Gotcha:   Rust runs DESTRUCTORS (`Drop`) at end of scope deterministically;
    //           that is what cleanly stops the engine here, with no GC or manual
    //           teardown call.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // await app.run();
    // return;
    // ```
    app.run()?;
    Ok(())
}
