//! UI-side queue and now-playing projection helpers.
//!
//! This module sits in the binary crate because it talks to generated Slint types
//! (`AppWindow`). It holds the page-navigation intent type and the small property-setter
//! helpers that `main.rs`'s `refresh_page`/`apply_update` use to mirror engine `Update`s onto
//! the on-screen Slint properties.

/// What:     `use std::rc::Rc;`. Single-thread shared-ownership pointer.
/// Why:      Slint list models are handed to properties behind an `Rc`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // a reference-counted handle
/// ```
use std::rc::Rc;

/// What:     `use slint::{SharedString, VecModel};`. The Slint string type and the vector-backed
///           list model.
/// Why:      `set_queue_model` builds a `VecModel<SharedString>` for the `queue` property.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { SharedString, VecModel } from "slint";
/// ```
use slint::{SharedString, VecModel};

/// What:     `use crate::{format_time, AppWindow};`. The binary crate's "m:ss" formatter and the
///           generated window type.
/// Why:      The generated `AppWindow` only exists in this binary crate; `format_time` is shared
///           with `main.rs`'s position handler.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { formatTime, AppWindow } from "./main";
/// ```
use crate::{format_time, AppWindow};

/// What:     `enum PageNav { Show(i32), Follow, Keep }`. How `refresh_page` should choose the
///           selected tab after repaginating. `Show(p)` shows page `p` (a tab click, or page 0
///           on a fresh open); `Follow` jumps to the current track's page (a transport/selection
///           change, keeping the playing row visible); `Keep` preserves whatever page the user is
///           already viewing (a live rescan reconcile, which must not move the tab).
/// Why:      Three distinct intents drive the page; encoding them as a type (not a bare
///           `Option<i32>`) keeps the pagination decision explicit and UI-only.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PageNav = { kind: "show"; page: number } | { kind: "follow" } | { kind: "keep" };
/// ```
pub(crate) enum PageNav {
    /// What:     `Show(i32)` show this exact page index.
    /// Why:      A tab click, or page 0 on a fresh open/restore.
    Show(
        /// What:     Unnamed field `.0` of the `Show` variant: a page index as an `i32`
        ///           (32-bit SIGNED integer; siblings: `usize`, the type a true container
        ///           index uses, and `u32`).
        /// Why:      Signed `i32` (not `usize`) because the page index crosses into
        ///           Slint's `int` tab model at the UI boundary; it names the exact page
        ///           `refresh_page` selects on a tab click or a fresh open (page 0).
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// // the `page: number` payload of { kind: "show" }
        /// ```
        i32,
    ),
    /// What:     `Follow` jump to the current track's page (or keep the page when nothing is
    ///           current).
    /// Why:      A transport/selection change keeps the playing row visible.
    Follow,
    /// What:     `Keep` leave the selected page as it is (clamped to the new page count).
    /// Why:      A rescan reconcile refreshes the data without moving the user's tab.
    Keep,
}

/// What:     `pub(crate) fn set_queue_model(app: &AppWindow, names: &[String])`. Store the full
///           queue list into the `queue` property. Borrows the slice; each `String` is copied
///           into a `SharedString` the Slint model holds.
/// Why:      Shared by the `Queue` (fresh) and `Reconciled` (rescan) updates, which both replace
///           the canonical full list; the visible rows are then derived by `refresh_page`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function setQueueModel(app: AppWindow, names: string[]): void { app.queue = names.slice(); }
/// ```
pub(crate) fn set_queue_model(app: &AppWindow, names: &[String]) {
    // What:     `let items: Vec<SharedString> = names.iter().map(|s| SharedString::from(s.as_str())).collect();`.
    //           Copy each borrowed `String` into the `SharedString`s the model holds.
    // Why:      Slint models hold `SharedString`, not `String` (so building the model copies
    //           the text whether the input is owned or borrowed).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const items = names.slice();
    // ```
    let items: Vec<SharedString> = names.iter().map(|s| SharedString::from(s.as_str())).collect();
    // What:     `app.set_queue(Rc::new(VecModel::from(items)).into());`. Wrap the vector as a
    //           reference-counted list model and set the `queue` property.
    // Why:      Slint list properties take a `ModelRc`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.queue = items;
    // ```
    app.set_queue(Rc::new(VecModel::from(items)).into());
}

/// What:     `pub(crate) fn set_now_playing(app: &AppWindow, index: Option<usize>, name: &str, duration: f64)`.
///           Mirror the now-playing view into the window properties: title, seek-bar maximum and
///           total-time label, and the highlighted row index (-1 when none).
/// Why:      Shared by the `NowPlaying` (transport) and `Reconciled` (rescan) updates, which both
///           refresh the current-track view; only the page choice afterward differs.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function setNowPlaying(app, index, name, duration) { app.trackName = name; app.duration = duration; app.durationText = formatTime(duration); app.currentIndex = index ?? -1; }
/// ```
pub(crate) fn set_now_playing(app: &AppWindow, index: Option<usize>, name: &str, duration: f64) {
    // What:     `app.set_track_name(name.into());`. Convert to `SharedString` and set the title
    //           source.
    // Why:      Show the filename (empty string clears it).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.trackName = name;
    // ```
    app.set_track_name(name.into());
    // What:     `app.set_duration(duration as f32);`. Narrow `f64` seconds to Slint's `float`.
    // Why:      The seek slider's maximum.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.duration = duration;
    // ```
    app.set_duration(duration as f32);
    // What:     `app.set_duration_text(format_time(duration).into());`. Format to "m:ss".
    // Why:      Show total time as a human-readable label.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.durationText = formatTime(duration);
    // ```
    app.set_duration_text(format_time(duration).into());
    // What:     `let index_i32 = match index { Some(i) => i as i32, None => -1 };`. Encode the
    //           `Option<usize>` as a plain `i32`, -1 for "none" (Slint `int` cannot be null).
    // Why:      The row highlight compares against this.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const indexI32 = index ?? -1;
    // ```
    let index_i32 = match index {
        Some(i) => i as i32,
        None => -1,
    };
    // What:     `app.set_current_index(index_i32);`. Set the highlighted row.
    // Why:      Mark the playing/selected track.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // app.currentIndex = indexI32;
    // ```
    app.set_current_index(index_i32);
}
