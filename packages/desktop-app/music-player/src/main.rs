//! Binary entry point. Builds the Slint window, spawns the engine on its own
//! thread, and wires the two together: UI callbacks send `Command`s to the
//! engine, and engine `Update`s are applied to the window's properties from the
//! event-loop thread. Also handles CLI path arguments and the file-open dialog.

// What:     `slint::include_modules!()` is a MACRO (the `!` marks a macro call)
//           that pastes in the Rust code generated from `ui/app.slint` by
//           `build.rs`, bringing the `AppWindow` type into scope.
// Why:      Without it the compiled-from-markup component is invisible to Rust.
// TS map:   like an auto-generated `import { AppWindow } from "./app.slint.gen";`
slint::include_modules!();

// What:     `use std::path::{Path, PathBuf};`. `PathBuf` is the OWNED filesystem
//           path; `Path` is the BORROWED view (like `String` vs `&str`).
// Why:      CLI arguments and picked files become owned `PathBuf`s; `Path::new`
//           gives a cheap borrowed path for comparisons without allocating.
// TS map:   both are just `string` paths in TS.
use std::path::{Path, PathBuf};

// What:     `use std::rc::Rc;`. `Rc<T>` is a single-threaded shared-ownership
//           pointer (reference counted). Sibling: `Arc<T>` (atomic, multi-thread).
// Why:      Several UI callbacks need to share the one `Engine`; they all run on
//           the UI thread, so non-atomic `Rc` is enough (and cheaper than `Arc`).
// TS map:   no equivalent; GC makes every JS object implicitly shared.
//
// In TS you'd write (pseudocode):
// ```ts
// const engine = new Engine(); // closures just capture it; GC handles sharing
// ```
use std::rc::Rc;

// What:     `use music_player::command::{Command, ShuffleMode, Update};`. The
//           message types from our library crate. The package is `music-player`
//           but a Rust crate identifier cannot contain `-`, so the lib crate is
//           `music_player` (the hyphen becomes an underscore).
// Why:      We build `Command`s and read `Update`s.
// TS map:   `import { Command, ShuffleMode, Update } from "music-player/command";`
use music_player::command::{Command, ShuffleMode, Update};

// What:     `use music_player::engine::Engine;`. The controller handle.
// Why:      We spawn it and send commands.
// TS map:   `import { Engine } from "music-player/engine";`
use music_player::engine::Engine;

// What:     `use music_player::session::Session;`. The saved-state record.
// Why:      We load it on launch to restore the last session.
// TS map:   `import { Session } from "music-player/session";`
use music_player::session::Session;

// What:     `use music_player::pagination;`. The pure queue-pagination module.
//           Importing the MODULE (not its items) so calls read `pagination::paginate`
//           / `pagination::page_of_index`, keeping the origin obvious at the call.
// Why:      The binary groups the queue's display paths into pages: one per top-
//           level folder for subfolder tracks, A-Z + `#` letter pages for root-
//           level tracks.
// TS map:   `import * as pagination from "music-player/pagination";`
use music_player::pagination;

// What:     `use slint::{ComponentHandle, Model, SharedString, VecModel};`.
//           `ComponentHandle` is the trait giving `.as_weak()`/`.run()` on the
//           window; `Model` is the trait whose `.iter()` reads a list property
//           back (we re-read the full `queue` model to repaginate); `SharedString`
//           is Slint's cheap-to-clone string; `VecModel` builds the list model
//           behind a list property. (The `ModelRc` a setter wants is produced by
//           `.into()`, so it needs no import.)
// Why:      Needed to drive the window, read its `queue`, and set its list props.
// TS map:   importing the UI runtime's helpers.
use slint::{ComponentHandle, Model, SharedString, VecModel};

// What:     `fn shuffle_to_int(mode: ShuffleMode) -> i32`. Map the enum to the
//           integer the UI property uses (Off=0, WithinPage=1, All=2).
// Why:      Slint has no Rust enum; it stores the mode as an `int` the radio
//           group compares against.
// TS map:   `function shuffleToInt(mode: ShuffleMode): number`
fn shuffle_to_int(mode: ShuffleMode) -> i32 {
    // What:     `match mode { ... }`. Map each variant to its number.
    // Why:      Stable encoding shared with the .slint file.
    // TS map:   `switch (mode) { ... }`
    match mode {
        // What:     `ShuffleMode::Off => 0`. Path-qualified variant -> 0.
        // Why:      Off is 0.
        // TS map:   `case "off": return 0;`
        ShuffleMode::Off => 0,
        // What:     `ShuffleMode::WithinPage => 1`.
        // Why:      WithinPage is 1.
        // TS map:   `case "withinPage": return 1;`
        ShuffleMode::WithinPage => 1,
        // What:     `ShuffleMode::All => 2`.
        // Why:      All is 2.
        // TS map:   `case "all": return 2;`
        ShuffleMode::All => 2,
    }
}

// What:     `fn int_to_shuffle(value: i32) -> ShuffleMode`. Inverse of the above.
// Why:      Turn the radio group's selected integer back into a `ShuffleMode`.
// TS map:   `function intToShuffle(value: number): ShuffleMode`
fn int_to_shuffle(value: i32) -> ShuffleMode {
    // What:     `match value { 1 => WithinPage, 2 => All, _ => Off }`. The wildcard
    //           `_` maps anything else (including 0) to Off.
    // Why:      Defensive default to Off.
    // TS map:   `return value === 1 ? "withinPage" : value === 2 ? "all" : "off";`
    match value {
        // What:     `1 => ShuffleMode::WithinPage`.
        // Why:      1 is WithinPage.
        // TS map:   `case 1: return "withinPage";`
        1 => ShuffleMode::WithinPage,
        // What:     `2 => ShuffleMode::All`.
        // Why:      2 is All.
        // TS map:   `case 2: return "all";`
        2 => ShuffleMode::All,
        // What:     `_ => ShuffleMode::Off`. Everything else.
        // Why:      Default.
        // TS map:   `default: return "off";`
        _ => ShuffleMode::Off,
    }
}

// What:     `fn format_time(secs: f64) -> String`. Format seconds as "m:ss".
// Why:      Slint number-to-string is awkward, so we format here and pass strings.
// TS map:   `function formatTime(secs: number): string`
fn format_time(secs: f64) -> String {
    // What:     `let whole = if secs > 0.0 { secs as u64 } else { 0 };`. Clamp
    //           negatives/NaN to 0, then truncate to whole seconds (`as u64`).
    // Why:      Avoid negative or garbage times.
    // TS map:   `const whole = secs > 0 ? Math.floor(secs) : 0;`
    let whole = if secs > 0.0 { secs as u64 } else { 0 };
    // What:     `format!("{}:{:02}", whole / 60, whole % 60)`. Minutes, then
    //           seconds zero-padded to 2 digits (`{:02}`). Tail -> return.
    // Why:      "3:07" style display.
    // TS map:   `return `${Math.floor(whole/60)}:${String(whole%60).padStart(2,"0")}`;`
    format!("{}:{:02}", whole / 60, whole % 60)
}

// What:     `fn refresh_page(app: &AppWindow, target: Option<i32>)`. Rebuild the
//           page-tab list and the visible page from the full `queue` property.
//           `target` is `Some(page)` to show a specific page, or `None` to follow
//           the current track (used when the track changes). Runs on the UI thread.
// Why:      One place derives the pagination view, so the tabs, the visible rows,
//           and the selected tab can never disagree.
// TS map:   `function refreshPage(app: AppWindow, target: number | null): void`
fn refresh_page(app: &AppWindow, target: Option<i32>) {
    // What:     `let names: Vec<String> = app.get_queue().iter().map(|s| s.to_string()).collect();`.
    //           `app.get_queue()` returns the full-list model (`ModelRc<SharedString>`);
    //           `.iter()` (from the `Model` trait) walks it yielding `SharedString`;
    //           `.map(|s| s.to_string())` copies each into an owned `String`;
    //           `.collect()` gathers them into the `Vec<String>` `paginate` takes.
    // Why:      Re-read the canonical full list to regroup it into pages.
    // TS map:   `const names = [...app.queue];`
    let names: Vec<String> = app.get_queue().iter().map(|s| s.to_string()).collect();
    // What:     `let pages = pagination::paginate(&names);`. Group the relative
    //           paths into pages (folder pages, then A-Z letter pages, then `#`).
    //           `&names` lends the vector.
    // Why:      The single source of the tabs and page contents.
    // TS map:   `const pages = pagination.paginate(names);`
    let pages = pagination::paginate(&names);

    // What:     `let labels: Vec<SharedString> = pages.iter().map(|page| SharedString::from(page.label.as_str())).collect();`.
    //           Borrow each page (`page.iter()`), take its `label` (a `String`),
    //           `.as_str()` borrows it as `&str`, and `SharedString::from` makes the
    //           Slint string the model holds. `.collect()` gathers them.
    // Why:      The tab captions, one per page, in page order.
    // TS map:   `const labels = pages.map(p => p.label);`
    let labels: Vec<SharedString> = pages
        .iter()
        .map(|page| SharedString::from(page.label.as_str()))
        .collect();
    // What:     `app.set_page_labels(Rc::new(VecModel::from(labels)).into());`. Wrap
    //           the labels in a `VecModel` behind an `Rc`, convert to the `ModelRc`
    //           the property wants with `.into()`, and set it.
    // Why:      Push the tab list to the UI.
    // TS map:   `app.pageLabels = labels;`
    app.set_page_labels(Rc::new(VecModel::from(labels)).into());

    // What:     `let requested: i32 = match target { ... };`. Decide which page to
    //           show: the explicit one, or the page of the current track when
    //           following.
    // Why:      `select-page` passes an explicit page; a track change passes `None`.
    // TS map:   `const requested = target ?? pageOfCurrent();`
    let requested: i32 = match target {
        // What:     `Some(page) => page`. An explicit page index was requested.
        // Why:      Honour the clicked tab.
        // TS map:   `if (target !== null) return target;`
        Some(page) => page,
        // What:     `None => { ... }`. Follow the current track instead.
        // Why:      Keep the playing row visible after a track change.
        // TS map:   `else { ... compute from current ... }`
        None => {
            // What:     `let index = app.get_current_index();`. The playing track's
            //           load-order index, or `-1` when nothing is playing.
            // Why:      We map it onto a page.
            // TS map:   `const index = app.currentIndex;`
            let index = app.get_current_index();
            // What:     `if index < 0 { app.get_selected_page() } else { ... }`. With
            //           no current track, keep the page the user is already viewing;
            //           otherwise find the page holding that track.
            // Why:      Do not yank the view to page 0 when nothing is playing.
            // TS map:   `index < 0 ? app.selectedPage : (pageOfIndex(...) ?? app.selectedPage)`
            if index < 0 {
                app.get_selected_page()
            } else {
                // What:     `match pagination::page_of_index(&pages, index as usize) { ... }`.
                //           `index as usize` narrows the `i32` to the index type;
                //           `page_of_index` returns `Some(page)` or `None`.
                // Why:      Locate the current track's page.
                // TS map:   `pageOfIndex(pages, index) ?? app.selectedPage`
                match pagination::page_of_index(&pages, index as usize) {
                    // What:     `Some(page) => page as i32`. Found; widen to the
                    //           property's `i32`.
                    // Why:      Show that page.
                    // TS map:   `return page;`
                    Some(page) => page as i32,
                    // What:     `None => app.get_selected_page()`. Not found (stale
                    //           index mid-update); keep the current view.
                    // Why:      Safe fallback.
                    // TS map:   `return app.selectedPage;`
                    None => app.get_selected_page(),
                }
            }
        }
    };

    // What:     `let clamped: i32 = if pages.is_empty() { 0 } else { requested.clamp(0, pages.len() as i32 - 1) };`.
    //           With no pages, page 0; otherwise pin `requested` into the valid
    //           range. `i32::clamp(lo, hi)` returns the nearest bound when outside.
    //           `pages.len() as i32` narrows the `usize` count.
    // Why:      A stale or out-of-range page index must not index past the pages.
    // TS map:   `const clamped = pages.length ? Math.min(Math.max(requested, 0), pages.length - 1) : 0;`
    let clamped: i32 = if pages.is_empty() {
        0
    } else {
        requested.clamp(0, pages.len() as i32 - 1)
    };

    // What:     `let items: Vec<PageItem> = match pages.get(clamped as usize) { ... };`.
    //           `pages.get(i)` returns `Option<&Page>` (None when empty). Build the
    //           selected page's rows as the generated `PageItem` struct.
    // Why:      The ListView shows only this page's tracks.
    // TS map:   `const items = (pages[clamped]?.entries ?? []).map(...);`
    let items: Vec<PageItem> = match pages.get(clamped as usize) {
        // What:     `Some(page) => page.entries.iter().map(|entry| PageItem { name: entry.name.as_str().into(), index: entry.index as i32 }).collect()`.
        //           Map each `PageEntry` to a Slint `PageItem`: `entry.name.as_str().into()`
        //           makes the `SharedString`, `entry.index as i32` narrows the index.
        // Why:      Carry the real queue index so a click maps back correctly.
        // TS map:   `page.entries.map(e => ({ name: e.name, index: e.index }))`
        Some(page) => page
            .entries
            .iter()
            .map(|entry| PageItem {
                name: entry.name.as_str().into(),
                index: entry.index as i32,
            })
            .collect(),
        // What:     `None => Vec::new()`. No page (empty queue): no rows.
        // Why:      Show an empty list.
        // TS map:   `[]`
        None => Vec::new(),
    };
    // What:     `app.set_page_items(Rc::new(VecModel::from(items)).into());`. Push the
    //           page's rows to the UI (same `VecModel`/`.into()` wrapping as labels).
    // Why:      Render the selected page.
    // TS map:   `app.pageItems = items;`
    app.set_page_items(Rc::new(VecModel::from(items)).into());
    // What:     `app.set_selected_page(clamped);`. Mark which tab is active.
    // Why:      Highlight the visible tab.
    // TS map:   `app.selectedPage = clamped;`
    app.set_selected_page(clamped);
}

// What:     `fn apply_update(app: &AppWindow, update: Update)`. Apply one engine
//           update to the window's properties. Runs on the event-loop thread.
// Why:      Keep the on-screen state mirroring the engine's state.
// TS map:   `function applyUpdate(app: AppWindow, update: Update): void`
fn apply_update(app: &AppWindow, update: Update) {
    // What:     `match update { ... }`. Dispatch on the update variant.
    // Why:      Each maps to one or more property setters.
    // TS map:   `switch (update.kind) { ... }`
    match update {
        // What:     `Update::Queue(names) => { ... }`. Replace the queue list.
        // Why:      Render the filenames.
        // TS map:   `case "queue": ...`
        Update::Queue(names) => {
            // What:     `let items: Vec<SharedString> = names.into_iter().map(SharedString::from).collect();`.
            //           Convert each `String` to a `SharedString`. `into_iter()`
            //           consumes the vec; `.map(SharedString::from)` converts each;
            //           `.collect()` gathers into a new `Vec`.
            // Why:      Slint models hold `SharedString`, not `String`.
            // TS map:   `const items = names.slice();`
            let items: Vec<SharedString> = names.into_iter().map(SharedString::from).collect();
            // What:     `let model = Rc::new(VecModel::from(items));`. Wrap the
            //           items in a `VecModel` (a list model) behind an `Rc`.
            // Why:      Slint list properties take a reference-counted model.
            // TS map:   `const model = items;`
            let model = Rc::new(VecModel::from(items));
            // What:     `app.set_queue(model.into());`. `model.into()` converts the
            //           `Rc<VecModel>` into the `ModelRc` the property wants.
            //           `set_queue` is the generated setter for the `queue` property.
            //           This `queue` property is the canonical full list; the visible
            //           rows come from the paginated `page-items` set just below.
            // Why:      Store the full list (the pagination view is derived from it).
            // TS map:   `app.queue = model;`
            app.set_queue(model.into());
            // What:     `refresh_page(app, Some(0));`. Rebuild the tabs and show the
            //           first page. A fresh queue resets to page 0; the `NowPlaying`
            //           update that always follows an open/restore then jumps to the
            //           current track's page.
            // Why:      Repaginate whenever the queue changes.
            // TS map:   `refreshPage(app, 0);`
            refresh_page(app, Some(0));
        }
        // What:     `Update::NowPlaying { index, name, duration } => { ... }`.
        //           Destructure the struct variant's fields.
        // Why:      Update the now-playing label, highlight, and seek-bar max.
        // TS map:   `case "nowPlaying": { const { index, name, duration } = update; ... }`
        Update::NowPlaying {
            index,
            name,
            duration,
        } => {
            // What:     `app.set_track_name(name.into());`. `.into()` converts the
            //           `String` to `SharedString`.
            // Why:      Show the filename.
            // TS map:   `app.trackName = name;`
            app.set_track_name(name.into());
            // What:     `app.set_duration(duration as f32);`. Slint's `float` is
            //           f32, so narrow our f64 seconds.
            // Why:      The seek slider's maximum.
            // TS map:   `app.duration = duration;`
            app.set_duration(duration as f32);
            // What:     `app.set_duration_text(format_time(duration).into());`.
            //           Set the human-readable label.
            // Why:      Show total time.
            // TS map:   `app.durationText = formatTime(duration);`
            app.set_duration_text(format_time(duration).into());
            // What:     `let index_i32 = match index { Some(i) => i as i32, None => -1 };`.
            //           Encode "no current track" as -1 for the UI.
            // Why:      Slint `int` cannot be null; -1 means "none".
            // TS map:   `const indexI32 = index ?? -1;`
            let index_i32 = match index {
                // What:     `Some(i) => i as i32`. Narrow the `usize` index to `i32`.
                // Why:      Slint `int` is i32.
                // TS map:   `i;`
                Some(i) => i as i32,
                // What:     `None => -1`. No current track.
                // Why:      Sentinel.
                // TS map:   `-1;`
                None => -1,
            };
            // What:     `app.set_current_index(index_i32);`. Highlight that row.
            // Why:      Mark the playing track.
            // TS map:   `app.currentIndex = indexI32;`
            app.set_current_index(index_i32);
            // What:     `refresh_page(app, None);`. Follow the now-playing track:
            //           switch the visible page to the one holding it so the
            //           highlighted row stays on screen after Next / auto-advance.
            // Why:      Keep the playing track visible across track changes.
            // TS map:   `refreshPage(app, null);`
            refresh_page(app, None);
        }
        // What:     `Update::Position(secs) => { ... }`. Live playback position.
        // Why:      Move the seek bar and update the elapsed label.
        // TS map:   `case "position": ...`
        Update::Position(secs) => {
            // What:     `app.set_position(secs as f32);`. Narrow to Slint's float.
            // Why:      Slider thumb position.
            // TS map:   `app.position = secs;`
            app.set_position(secs as f32);
            // What:     `app.set_position_text(format_time(secs).into());`.
            // Why:      Elapsed-time label.
            // TS map:   `app.positionText = formatTime(secs);`
            app.set_position_text(format_time(secs).into());
        }
        // What:     `Update::Playing(on) => app.set_playing(on)`. Play/pause state.
        // Why:      Toggle the button label.
        // TS map:   `case "playing": app.playing = on;`
        Update::Playing(on) => app.set_playing(on),
        // What:     `Update::Volume(v) => app.set_volume(v)`. Volume (f32 already).
        // Why:      Sync the slider.
        // TS map:   `case "volume": app.volume = v;`
        Update::Volume(v) => app.set_volume(v),
        // What:     `Update::Shuffle(mode) => app.set_shuffle_mode(shuffle_to_int(mode))`.
        //           Encode the mode to an int for the UI radio group.
        // Why:      Highlight the selected shuffle radio.
        // TS map:   `case "shuffle": app.shuffleMode = shuffleToInt(mode);`
        Update::Shuffle(mode) => app.set_shuffle_mode(shuffle_to_int(mode)),
        // What:     `Update::RepeatTrack(on) => app.set_repeat_track(on)`. Repeat-track
        //           checkbox state.
        // Why:      Check/uncheck the repeat-track box.
        // TS map:   `case "repeatTrack": app.repeatTrack = on;`
        Update::RepeatTrack(on) => app.set_repeat_track(on),
    }
}

// What:     `fn xdg_user_dir_music() -> Option<PathBuf>`. Last-resort lookup: shell
//           out to the `xdg-user-dir MUSIC` command and use its printed path.
// Why:      Some setups (and some `directories` parsing gaps) leave the music dir
//           discoverable only through the official `xdg-user-dir` tool; this is the
//           fallback when the env var and the user-dirs file both come up empty.
// TS map:   `function xdgUserDirMusic(): string | null`
fn xdg_user_dir_music() -> Option<PathBuf> {
    // What:     `let output = std::process::Command::new("xdg-user-dir").arg("MUSIC").output().ok()?;`.
    //           Build and run the external command, capturing its output.
    //           `Command::new(name)` starts a builder; `.arg("MUSIC")` adds an
    //           argument; `.output()` runs it to completion and returns
    //           `io::Result<Output>` (stdout/stderr/status). `.ok()` turns the
    //           `Result` into an `Option` (dropping the error); the `?` returns
    //           `None` from this function if the command could not run (e.g. the
    //           tool is not installed, as in the container).
    // Why:      Ask the OS where the music directory is.
    // TS map:   `let output; try { output = spawnSync("xdg-user-dir", ["MUSIC"]); } catch { return null; }`
    let output = std::process::Command::new("xdg-user-dir")
        .arg("MUSIC")
        .output()
        .ok()?;
    // What:     `if !output.status.success() { return None; }`. `status.success()`
    //           is true only on exit code 0; `!` negates it.
    // Why:      A failed command yields no usable path.
    // TS map:   `if (output.status !== 0) return null;`
    if !output.status.success() {
        return None;
    }
    // What:     `let text = String::from_utf8(output.stdout).ok()?;`. `output.stdout`
    //           is the raw bytes (`Vec<u8>`); `String::from_utf8` validates them as
    //           UTF-8 and returns `Result<String, _>`; `.ok()?` yields the `String`
    //           or returns `None` on invalid UTF-8.
    // Why:      We need the printed path as text.
    // TS map:   `const text = output.stdout.toString("utf8");`
    let text = String::from_utf8(output.stdout).ok()?;
    // What:     `let trimmed = text.trim();`. `.trim()` returns a borrowed `&str`
    //           with leading/trailing whitespace (including the trailing newline)
    //           removed.
    // Why:      Command output ends in a newline we must strip.
    // TS map:   `const trimmed = text.trim();`
    let trimmed = text.trim();
    // What:     `if trimmed.is_empty() { return None; }`. Guard against empty output.
    // Why:      No path was printed.
    // TS map:   `if (!trimmed) return null;`
    if trimmed.is_empty() {
        return None;
    }
    // What:     `if let Some(home) = std::env::var_os("HOME") { if Path::new(&home) == Path::new(trimmed) { return None; } }`.
    //           `xdg-user-dir MUSIC` prints `$HOME` when no music dir is configured;
    //           compare the result to `$HOME` and reject that case. `Path::new(x)`
    //           wraps a borrowed `&OsStr`/`&str` as a `&Path` with no allocation
    //           (unlike `PathBuf::from`, which would allocate), and `&Path == &Path`
    //           compares by path components.
    // Why:      Avoid auto-loading the entire home directory when MUSIC is unset.
    // TS map:   `if (trimmed === process.env.HOME) return null;`
    if let Some(home) = std::env::var_os("HOME") {
        if Path::new(&home) == Path::new(trimmed) {
            return None;
        }
    }
    // What:     `Some(PathBuf::from(trimmed))`. Wrap the path as present. Tail -> return.
    // Why:      Hand back the discovered music directory.
    // TS map:   `return trimmed;`
    Some(PathBuf::from(trimmed))
}

// What:     `fn music_dir() -> Option<PathBuf>`. Find the user's music directory:
//           the `XDG_MUSIC_DIR` environment variable first, then the XDG user-dirs
//           file via the `directories` crate, then the `xdg-user-dir MUSIC`
//           command. Returns `None` unless one yields an existing directory.
// Why:      The containerized `run` task bind-mounts the host music folder and
//           exports `XDG_MUSIC_DIR` as its in-container path; a native run has no
//           such env, so we fall back to the user-dirs file and finally the
//           `xdg-user-dir` tool. The `directories` crate reads only the file, never
//           the env var, so the env lookup must be explicit here.
// TS map:   `function musicDir(): string | null`
fn music_dir() -> Option<PathBuf> {
    // What:     `std::env::var_os("XDG_MUSIC_DIR")`. Read an environment variable as
    //           an `Option<OsString>` (raw OS bytes, not required to be UTF-8).
    //           Sibling: `var(...)` returns `Result<String, _>` and errors on
    //           non-UTF-8; `var_os` returns `None` when unset and never errors.
    // Why:      Paths may hold non-UTF-8 bytes, and "unset" is not an error here.
    // TS map:   `process.env.XDG_MUSIC_DIR` (string | undefined)
    std::env::var_os("XDG_MUSIC_DIR")
        // What:     `.map(PathBuf::from)`. When set, convert the `OsString` into an
        //           owned `PathBuf`. Passing `PathBuf::from` (the function itself) is
        //           the closure shorthand.
        // Why:      We want a path, not a raw string.
        // TS map:   `.map(s => s as path)`
        .map(PathBuf::from)
        // What:     `.or_else(|| ...)`. If the env var was unset (`None`), run the
        //           zero-argument closure `|| ...` to compute a fallback (lazy: it
        //           runs only on `None`).
        // Why:      A native run has no `XDG_MUSIC_DIR` env; read the user-dirs file.
        // TS map:   `?? userDirs()?.audioDir`
        .or_else(|| {
            // What:     `directories::UserDirs::new().and_then(|dirs| dirs.audio_dir().map(|p| p.to_path_buf()))`.
            //           `UserDirs::new()` is `Option<UserDirs>`; `.and_then(...)` runs
            //           only if present; `dirs.audio_dir()` is `Option<&Path>` parsed
            //           from the XDG user-dirs file; `.map(|p| p.to_path_buf())` owns
            //           the borrowed path.
            // Why:      Standard music-dir lookup for a native (non-container) run.
            // TS map:   `userDirs()?.audioDir`
            directories::UserDirs::new()
                .and_then(|dirs| dirs.audio_dir().map(|p| p.to_path_buf()))
        })
        // What:     `.or_else(xdg_user_dir_music)`. If both the env var and the
        //           user-dirs file came up empty, fall back to the `xdg-user-dir`
        //           command. Passing the function by name is the closure shorthand
        //           (its signature `() -> Option<PathBuf>` matches what `or_else`
        //           wants).
        // Why:      Final fallback for setups where only the tool knows the path.
        // TS map:   `?? xdgUserDirMusic()`
        .or_else(xdg_user_dir_music)
        // What:     `.filter(|p| p.is_dir())`. Keep the path only if it exists and is
        //           a directory; otherwise the whole result is `None`.
        // Why:      Do not feed a missing or non-directory path to the engine.
        // TS map:   `.filter(p => isDir(p))`
        .filter(|p| p.is_dir())
}

// What:     `fn main() -> Result<(), slint::PlatformError>`. The entry point;
//           may end with a `PlatformError` if Slint cannot create a window.
// Why:      Propagate window/backend failure as the exit status.
// TS map:   `async function main(): Promise<void>` that may throw.
fn main() -> Result<(), slint::PlatformError> {
    // What:     `let app = AppWindow::new()?;`. Build the window; `?` returns the
    //           error from `main` on failure.
    // Why:      We need the window before wiring anything.
    // TS map:   `const app = new AppWindow();`
    let app = AppWindow::new()?;

    // What:     `let weak = app.as_weak();`. A WEAK handle to the window: it does
    //           not keep the window alive, and can be sent to other threads and
    //           upgraded back to a strong handle ON the event-loop thread.
    // Why:      The engine's update callback (on another thread) needs to reach
    //           the window without owning it.
    // TS map:   `const weak = new WeakRef(app);`
    let weak = app.as_weak();

    // What:     `let engine = Rc::new(Engine::spawn(move |update| { ... }));`. Start
    //           the engine, giving it a callback that forwards each `Update` to the
    //           UI thread. `move` makes the closure own `weak`. Wrap the engine in
    //           `Rc` so multiple UI callbacks can share it.
    // Why:      One engine, shared by all the button handlers.
    // TS map:   `const engine = Engine.spawn(update => { ... });`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const engine = Engine.spawn(update => postToUiThread(() => applyUpdate(app, update)));
    // ```
    let engine = Rc::new(Engine::spawn(move |update| {
        // What:     `let weak = weak.clone();`. Clone the weak handle for this call
        //           (the outer closure is called repeatedly, so it cannot move
        //           `weak` out).
        // Why:      Each update needs its own handle to move into the inner closure.
        // TS map:   `const w = weak;`
        let weak = weak.clone();
        // What:     `let _ = slint::invoke_from_event_loop(move || { ... });`. Run
        //           the inner closure ON the UI/event-loop thread (required for
        //           touching window properties). `let _ =` ignores the result
        //           (it errs only if the loop is gone, e.g. during shutdown).
        // Why:      Updates arrive on the engine thread but must be applied on the
        //           UI thread.
        // TS map:   `queueMicrotaskOnUiThread(() => { ... });`
        let _ = slint::invoke_from_event_loop(move || {
            // What:     `if let Some(app) = weak.upgrade() { apply_update(&app, update); }`.
            //           `upgrade()` turns the weak handle back into a strong one if
            //           the window still exists; if so, apply the update.
            // Why:      The window may have closed before this runs.
            // TS map:   `const app = weak.deref(); if (app) applyUpdate(app, update);`
            if let Some(app) = weak.upgrade() {
                apply_update(&app, update);
            }
        });
    }));

    // What:     `app.on_toggle_play({ let engine = engine.clone(); move || engine.send(Command::TogglePlay) });`.
    //           Register the play/pause handler. The block clones the `Rc<Engine>`
    //           and returns a `move` closure that owns the clone. `on_toggle_play`
    //           is the generated registrar for the `toggle-play` callback.
    // Why:      Button press -> engine command.
    // TS map:   `app.onTogglePlay(() => engine.send(Command.TogglePlay));`
    app.on_toggle_play({
        // What:     `let engine = engine.clone();`. A shared-owner clone for this
        //           closure (cheap: bumps the reference count).
        // Why:      The closure must own an engine handle that outlives this scope.
        // TS map:   `const e = engine;`
        let engine = engine.clone();
        // What:     `move || engine.send(Command::TogglePlay)`. The handler.
        // Why:      Ask the engine to toggle.
        // TS map:   `() => engine.send(Command.TogglePlay)`
        move || engine.send(Command::TogglePlay)
    });

    // What:     `app.on_prev(...)`. Previous-track handler.
    // Why:      Prev button.
    // TS map:   `app.onPrev(() => engine.send(Command.Prev));`
    app.on_prev({
        let engine = engine.clone();
        move || engine.send(Command::Prev)
    });

    // What:     `app.on_next(...)`. Next-track handler.
    // Why:      Next button.
    // TS map:   `app.onNext(() => engine.send(Command.Next));`
    app.on_next({
        let engine = engine.clone();
        move || engine.send(Command::Next)
    });

    // What:     `app.on_seek(move |secs| ...)`. Seek handler. The closure takes the
    //           slider value `secs: f32` and forwards it as `f64` seconds.
    // Why:      Dragging the seek bar jumps playback.
    // TS map:   `app.onSeek(secs => engine.send(Command.Seek(secs)));`
    app.on_seek({
        let engine = engine.clone();
        move |secs| engine.send(Command::Seek(secs as f64))
    });

    // What:     `app.on_set_volume(move |v| ...)`. Volume handler; `v: f32` gain.
    // Why:      Volume slider.
    // TS map:   `app.onSetVolume(v => engine.send(Command.SetVolume(v)));`
    app.on_set_volume({
        let engine = engine.clone();
        move |v| engine.send(Command::SetVolume(v))
    });

    // What:     `app.on_set_shuffle_mode(move |m| ...)`. Shuffle radio handler; the
    //           clicked radio passes its mode integer `m: i32` (0/1/2). Map it back
    //           to the enum and send. No property read needed: the radio carries the
    //           target mode directly.
    // Why:      Selecting a shuffle radio sets that exact mode.
    // TS map:   `app.onSetShuffleMode(m => engine.send(Command.SetShuffle(intToShuffle(m))));`
    app.on_set_shuffle_mode({
        let engine = engine.clone();
        // What:     `move |m| engine.send(Command::SetShuffle(int_to_shuffle(m)))`. The
        //           handler closure takes the mode int and forwards the enum.
        // Why:      One radio click -> one shuffle-mode command.
        // TS map:   `m => engine.send(Command.SetShuffle(intToShuffle(m)))`
        move |m| engine.send(Command::SetShuffle(int_to_shuffle(m)))
    });

    // What:     `app.on_set_repeat_track(move |on| ...)`. Repeat-track checkbox
    //           handler; the checkbox passes the desired boolean `on: bool`.
    // Why:      Toggling the box sets the flag directly.
    // TS map:   `app.onSetRepeatTrack(on => engine.send(Command.SetRepeatTrack(on)));`
    app.on_set_repeat_track({
        let engine = engine.clone();
        // What:     `move |on| engine.send(Command::SetRepeatTrack(on))`. The handler.
        // Why:      One checkbox toggle -> one repeat-track command.
        // TS map:   `on => engine.send(Command.SetRepeatTrack(on))`
        move |on| engine.send(Command::SetRepeatTrack(on))
    });

    // What:     `app.on_play_index(move |i| ...)`. Click-to-play handler; `i: i32`
    //           is the queue row. Sent as a `usize` index.
    // Why:      Clicking a queue row plays it.
    // TS map:   `app.onPlayIndex(i => engine.send(Command.PlayIndex(i)));`
    app.on_play_index({
        let engine = engine.clone();
        move |i| engine.send(Command::PlayIndex(i as usize))
    });

    // What:     `app.on_select_page(...)`. Tab-click handler; `p: i32` is the page
    //           index. It does not touch the engine: pagination is a pure display
    //           concern, so it just re-renders the chosen page from the existing
    //           `queue` property. Needs a weak handle to read/write properties.
    // Why:      Clicking a tab filters the list to that folder (or letter) page.
    // TS map:   `app.onSelectPage(p => refreshPage(app, p));`
    app.on_select_page({
        // What:     `let weak = app.as_weak();`. A weak handle the `'static` closure
        //           can hold (it cannot borrow `app`).
        // Why:      `refresh_page` needs the window to read `queue` and set the page.
        // TS map:   `const w = app;`
        let weak = app.as_weak();
        // What:     `move |p| { if let Some(app) = weak.upgrade() { refresh_page(&app, Some(p)); } }`.
        //           Upgrade the weak handle, then render the explicit page `p`.
        //           `Some(p)` requests that exact page (not the follow-current path).
        // Why:      Show the clicked tab's tracks.
        // TS map:   `p => { if (app) refreshPage(app, p); }`
        move |p| {
            if let Some(app) = weak.upgrade() {
                refresh_page(&app, Some(p));
            }
        }
    });

    // What:     `app.on_open_files(...)`. Opens the FOLDER picker on a SEPARATE
    //           thread (the dialog blocks) and sends the chosen directory.
    // Why:      A blocking dialog must not freeze the UI event loop. The XDG
    //           portal treats files and folders as separate dialog modes, so this
    //           player picks a folder and scans it recursively (individual files
    //           are still openable via command-line arguments).
    // TS map:   `app.onOpenFiles(() => { showFolderPickerAsync().then(dir => tx.send(...)); });`
    app.on_open_files({
        // What:     `let tx = engine.sender();`. A `Send` clone of the command
        //           channel for the picker thread (the `Rc<Engine>` is `!Send`).
        // Why:      The thread cannot hold the `Rc`; it holds the sender instead.
        // TS map:   `const tx = engine.sender();`
        let tx = engine.sender();
        // What:     `move || { ... }`. The handler.
        // Why:      Launch the picker.
        // TS map:   `() => { ... }`
        move || {
            // What:     `let tx = tx.clone();`. Clone the sender for this thread.
            // Why:      Each open spawns a fresh thread that owns its own sender.
            // TS map:   `const t = tx;`
            let tx = tx.clone();
            // What:     `std::thread::spawn(move || { ... });`. Run the dialog off
            //           the UI thread.
            // Why:      Keep the UI responsive while the dialog is open.
            // TS map:   `runInWorker(() => { ... });`
            std::thread::spawn(move || {
                // What:     `if let Some(dir) = rfd::FileDialog::new().pick_folder() { ... }`.
                //           Show a folder picker (XDG portal on Wayland). Returns
                //           `Some(PathBuf)` (one chosen directory) if the user
                //           confirmed, else `None` (cancelled).
                // Why:      Let the user enqueue a whole folder.
                // TS map:   `const dir = await showOpenDialog({ directory: true }); if (dir) { ... }`
                if let Some(dir) = rfd::FileDialog::new().pick_folder() {
                    // What:     `let _ = tx.send(Command::OpenPaths { paths: vec![dir], play: true });`.
                    //           Wrap the single folder in a one-element vector
                    //           (`vec![...]`) and send it with `play: true` (a user
                    //           open should start playback); the engine expands it
                    //           recursively. `let _ =` ignores a send error (engine gone).
                    // Why:      Replace the queue with the folder's tracks and play.
                    // TS map:   `tx.send(Command.OpenPaths({ paths: [dir], play: true }));`
                    let _ = tx.send(Command::OpenPaths {
                        paths: vec![dir],
                        play: true,
                    });
                }
            });
        }
    });

    // What:     `let cli_paths: Vec<PathBuf> = std::env::args().skip(1).map(PathBuf::from).collect();`.
    //           Collect command-line arguments after the program name into paths.
    //           `skip(1)` drops `argv[0]`; `.map(PathBuf::from)` converts each.
    // Why:      Allow `music-player file1 dir2 ...` to enqueue on launch.
    // TS map:   `const cliPaths = process.argv.slice(2);`
    let cli_paths: Vec<PathBuf> = std::env::args().skip(1).map(PathBuf::from).collect();
    // What:     `if !cli_paths.is_empty() { ... } else { ... }`. CLI paths take
    //           precedence over a saved session; with no paths, restore the
    //           last session instead.
    // Why:      Opening files explicitly should override resuming.
    // TS map:   `if (cliPaths.length) { ... } else { ... }`
    if !cli_paths.is_empty() {
        // What:     `engine.send(Command::OpenPaths { paths: cli_paths, play: true });`.
        //           Enqueue and play. `play: true` because explicit arguments mean
        //           the user wants playback.
        // Why:      Honour CLI arguments.
        // TS map:   `engine.send(Command.OpenPaths({ paths: cliPaths, play: true }));`
        engine.send(Command::OpenPaths {
            paths: cli_paths,
            play: true,
        });
    } else {
        // What:     `let session = Session::load();`. Read the saved session
        //           (returns defaults if none/corrupt; prunes moved files).
        // Why:      Resume where the user left off.
        // TS map:   `const session = Session.load();`
        let session = Session::load();
        // What:     `if !session.tracks.is_empty() { ... } else if let Some(music_dir) = ... { ... }`.
        //           Restore a saved queue when one survived pruning. `load()` already
        //           dropped files that moved, so an all-missing session arrives here
        //           with `tracks` empty and falls through to auto-loading the XDG
        //           music directory.
        // Why:      A launch with nothing to resume (no session, or every saved file
        //           pruned away) should not leave an empty queue when the user has a
        //           music folder.
        // TS map:   `if (session.tracks.length) { restore } else if (musicDir) { autoload }`
        if !session.tracks.is_empty() {
            // What:     `engine.send(Command::Restore { ... });`. Reinstate the saved
            //           session (loads paused at the saved position).
            // Why:      Resume the previous queue and position.
            // TS map:   `engine.send({ kind: "restore", ... });`
            engine.send(Command::Restore {
                tracks: session.tracks,
                current: session.current,
                position: session.position_secs,
                volume: session.volume,
                shuffle: session.shuffle,
                repeat_track: session.repeat_track,
            });
        // What:     `} else if let Some(music_dir) = music_dir() {`. Otherwise try the
        //           user's music directory (see the `music_dir` helper above).
        // Why:      Populate a fresh launch from the music library.
        // TS map:   `} else if (musicDir()) {`
        } else if let Some(music_dir) = music_dir() {
            // What:     `engine.send(Command::OpenPaths { paths: vec![music_dir], play: false });`.
            //           Auto-load the music directory PAUSED (`play: false`), so the
            //           queue is populated without blasting audio on launch.
            // Why:      Give a fresh launch a ready-to-play library without surprise
            //           playback.
            // TS map:   `engine.send(Command.OpenPaths({ paths: [musicDir], play: false }));`
            engine.send(Command::OpenPaths {
                paths: vec![music_dir],
                play: false,
            });
        }
    }

    // What:     `app.run()`. Show the window and run the event loop until it
    //           closes; returns `Result<(), PlatformError>`. Tail -> return.
    //           When it returns, `app` and `engine` drop: the engine's `Drop`
    //           sends `Quit` and joins its thread, tearing down PipeWire.
    // Why:      Hand control to Slint.
    // TS map:   `return app.run();`
    app.run()
}
