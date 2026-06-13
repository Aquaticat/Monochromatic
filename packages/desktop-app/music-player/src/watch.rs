//! The Source Root file watcher. It watches the current Source Root recursively and,
//! on any debounced filesystem change, sends `Command::Rescan` so the queue is
//! re-derived from disk. It deliberately ignores the event details (which file,
//! what kind): the queue is the scan of the root, so any change just means "rescan".
//! See `docs/decisions/music-player-live-update-rescan.md`.

// What:     `use std::path::{Path, PathBuf};`. Borrowed path view and owned path buffer.
// Why:      `watch` takes a borrowed `&Path`; the currently-watched root is stored owned.
// TS map:   paths are plain `string` values in TypeScript.
//
// In TS you'd write (pseudocode):
// ```ts
// type Path = string;
// ```
use std::path::{Path, PathBuf};

// What:     `use std::time::Duration;`. A span of time.
// Why:      The debounce window is a `Duration`.
// TS map:   a millisecond count.
//
// In TS you'd write (pseudocode):
// ```ts
// // a number of milliseconds
// ```
use std::time::Duration;

// What:     `use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};`.
//           The constructor, the handler's argument type, and the guard type.
// Why:      Build a debounced recursive watcher whose handler we drive.
// TS map:   `import { newDebouncer, DebounceEventResult, Debouncer } from "notify-debouncer-mini";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { newDebouncer, type DebounceEventResult, type Debouncer } from "notify-debouncer-mini";
// ```
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};

// What:     `use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};`.
//           The platform-default watcher type and the recursive-mode enum. The
//           `watch`/`unwatch` methods reached via `Debouncer::watcher()` resolve without
//           importing the `Watcher` trait here.
// Why:      `RecommendedWatcher` is the `Debouncer`'s type parameter; `RecursiveMode`
//           selects a deep watch.
// TS map:   `import { RecommendedWatcher, RecursiveMode } from "notify";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { RecommendedWatcher, RecursiveMode } from "notify";
// ```
use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};

// What:     `use crate::command::Command;`. The engine command enum.
// Why:      The handler sends `Command::Rescan`.
// TS map:   `import { Command } from "./command";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { Command } from "./command";
// ```
use crate::command::Command;

// What:     `use crate::engine::CommandSender;`. The send-and-wake handle.
// Why:      The handler must both enqueue `Rescan` AND unpark the worker thread, which is
//           exactly what `CommandSender::send` does (a bare channel send would not wake an
//           idle/parked worker).
// TS map:   `import { CommandSender } from "./engine";`
//
// In TS you'd write (pseudocode):
// ```ts
// import { CommandSender } from "./engine";
// ```
use crate::engine::CommandSender;

// What:     `const DEBOUNCE_MS: u64 = 500;`. The debounce window in milliseconds.
// Why:      Coalesce bursts (copying an album, an editor's atomic-rename temp files) into
//           one rescan instead of one per raw event. Named (not an inline literal) per the
//           magic-number rule.
// TS map:   `const DEBOUNCE_MS = 500;`
//
// In TS you'd write (pseudocode):
// ```ts
// const DEBOUNCE_MS = 500;
// ```
const DEBOUNCE_MS: u64 = 500;

// What:     `pub(crate) struct SourceWatcher { ... }`. Owns the debouncer (a guard that
//           stops its background thread on drop) and remembers which root is watched.
// Why:      The controller holds one of these and re-points it whenever the Source Root
//           changes; dropping it (on quit) tears the watcher down.
// TS map:   `class SourceWatcher { debouncer: Debouncer; watched: string | null; }`
//
// In TS you'd write (pseudocode):
// ```ts
// class SourceWatcher { debouncer: Debouncer; watched: string | null; }
// ```
pub(crate) struct SourceWatcher {
    // What:     `debouncer: Debouncer<RecommendedWatcher>`. The debounced watcher guard.
    // Why:      Kept alive so its background thread keeps delivering events; dropping it
    //           stops the watch.
    // TS map:   `debouncer: Debouncer;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // debouncer: Debouncer;
    // ```
    debouncer: Debouncer<RecommendedWatcher>,
    // What:     `watched: Option<PathBuf>`. The currently-watched root (`Some`), or `None`.
    // Why:      `watch` unwatches this before watching a new root, so only one root is ever
    //           watched at a time.
    // TS map:   `watched: string | null;`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // watched: string | null;
    // ```
    watched: Option<PathBuf>,
}

// What:     `impl SourceWatcher { ... }`. The constructor and the re-point method.
// Why:      Two operations: create the debouncer, and watch a given root.
// TS map:   methods on `SourceWatcher`.
//
// In TS you'd write (pseudocode):
// ```ts
// class SourceWatcher { static new() {} watch() {} }
// ```
impl SourceWatcher {
    // What:     `pub(crate) fn new(sender: CommandSender) -> Option<SourceWatcher>`. Build the
    //           debouncer whose handler sends `Rescan`; `None` if the OS watcher cannot be
    //           created.
    // Why:      The app must still run (without live updates) if the watcher fails to start.
    // TS map:   `static new(sender: CommandSender): SourceWatcher | null`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static new(sender: CommandSender): SourceWatcher | null { ... }
    // ```
    pub(crate) fn new(sender: CommandSender) -> Option<SourceWatcher> {
        // What:     `let debouncer = new_debouncer(Duration::from_millis(DEBOUNCE_MS), move |result| { ... }).ok()?;`.
        //           Create the debouncer with our window and a `move` handler that owns
        //           `sender`. `.ok()?` turns a creation error into `None` (early return).
        // Why:      The handler runs on the watcher's own thread, so it must own a `Send`
        //           `CommandSender`; any event batch triggers a rescan.
        // TS map:   `const debouncer = newDebouncer(DEBOUNCE_MS, (result) => { ... });`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const debouncer = newDebouncer(DEBOUNCE_MS, (result) => { ... });
        // ```
        let debouncer = new_debouncer(
            Duration::from_millis(DEBOUNCE_MS),
            move |result: DebounceEventResult| {
                // What:     `match result { Ok(events) if events.is_empty() => {}, _ => sender.send(Command::Rescan) }`.
                //           An empty `Ok` batch is ignored; any non-empty batch OR an error
                //           (which may mean events were dropped) requests a rescan.
                // Why:      We do not interpret the events; the rescan reconciles the queue
                //           with whatever is on disk now.
                // TS map:   `if (result.ok && result.events.length) sender.send(Rescan); else if (!result.ok) sender.send(Rescan);`
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // if (!result.ok || result.events.length) sender.send({ kind: "rescan" });
                // ```
                match result {
                    Ok(events) if events.is_empty() => {}
                    _ => sender.send(Command::Rescan),
                }
            },
        )
        .ok()?;
        // What:     `Some(SourceWatcher { debouncer, watched: None })`. Wrap the new watcher;
        //           nothing is watched yet.
        // Why:      The controller calls `watch` once a Source Root is known.
        // TS map:   `return { debouncer, watched: null };`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { debouncer, watched: null };
        // ```
        Some(SourceWatcher {
            debouncer,
            watched: None,
        })
    }

    // What:     `pub(crate) fn watch(&mut self, root: &Path)`. Watch `root` recursively,
    //           after unwatching any previously-watched root.
    // Why:      Re-point the single watch when the Source Root changes (open, restore).
    // TS map:   `watch(root: string): void`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // watch(root: string): void { ... }
    // ```
    pub(crate) fn watch(&mut self, root: &Path) {
        // What:     `if let Some(prev) = self.watched.take() { let _ = self.debouncer.watcher().unwatch(&prev); }`.
        //           `take()` removes and yields the previous root; `unwatch` stops watching
        //           it (errors are ignored: the path may already be gone).
        // Why:      Only the current root should be watched.
        // TS map:   `if (this.watched) { this.debouncer.watcher().unwatch(this.watched); this.watched = null; }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.watched) { try { this.debouncer.watcher().unwatch(this.watched); } catch {} }
        // ```
        if let Some(prev) = self.watched.take() {
            let _ = self.debouncer.watcher().unwatch(&prev);
        }
        // What:     `match self.debouncer.watcher().watch(root, RecursiveMode::Recursive) { ... }`.
        //           Start a deep watch; on success remember the root, on failure log it.
        // Why:      Record the watched root so the next `watch` can unwatch it; a failed
        //           watch must not pretend it succeeded.
        // TS map:   `try { this.debouncer.watcher().watch(root, "recursive"); this.watched = root; } catch (e) { console.error(e); }`
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // try { this.debouncer.watcher().watch(root, "recursive"); this.watched = root; }
        // catch (e) { console.error(e); }
        // ```
        match self.debouncer.watcher().watch(root, RecursiveMode::Recursive) {
            // What:     `Ok(()) => self.watched = Some(root.to_path_buf())`. Remember it.
            // Why:      So a later re-point unwatches this exact root.
            // TS map:   `this.watched = root;`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // this.watched = root;
            // ```
            Ok(()) => self.watched = Some(root.to_path_buf()),
            // What:     `Err(e) => eprintln!(...)`. Log and leave `watched` as `None`.
            // Why:      Live updates silently degrade if the OS watch cannot start.
            // TS map:   `console.error(...);`
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // console.error("music-player: watch failed for", root, e);
            // ```
            Err(e) => eprintln!("music-player: watch failed for {}: {e}", root.display()),
        }
    }
}
