//! Read-only document and workspace logic, independent of the native window.

/// What: Export the document module without exporting a writable filesystem API.
/// Why: Tests and the native window share the same state transitions.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as document from './document';
/// ```
pub mod document;

/// Semantic source classifications do not depend on terminal-cell geometry.
pub mod source_style;

/// Session-local Ctrl+digit history with editord's promotion semantics.
pub mod recent;

/// Tab projection retains exact source/display correspondence.
pub mod text_projection;

/// Pixel tab stops at multiples of two space advances, independent of the preceding script.
pub mod tab_stop;

/// Two-pass shaping that widens each tab's stand-in space to its stop.
mod tab_layout;

/// One shaped row with its caret, hit-test, and range geometry.
pub mod shaped_row;

/// Shared shaping for mixed-script source rows, caret, and hit testing.
pub mod shaped_text;

/// Grapheme, word, line, and document caret movement over source characters.
pub mod caret_motion;

/// Up, Down, and page movement by shaped pixel position with a remembered column.
pub mod vertical_motion;

/// Click counting and unit-wise drag extension for pointer selection.
pub mod pointer_selection;

/// Pixel painting consumes the same shaped geometry as reading interaction.
pub mod text_raster;

/// Internal bounded glyph images shared across source-raster frames.
mod glyph_cache;

/// Paint identity separates source-image updates from caret presentation.
pub mod source_frame;

/// Disk reads prepare correspondence without mutating project files or UI state.
pub mod file_reload;

/// One bounded background read/diff job keeps the native input loop independent.
pub mod reload_worker;

/// Worker-side target resolution and revision-bound source classification.
mod reload_read;

/// Helix-backed source classifications use canonical character offsets.
pub mod syntax;

/// User-facing parser diagnostics distinguish limits from missing assets.
mod syntax_error;

/// Language-server feature paths run on one worker thread and are polled; server edits are refused.
pub mod language;

/// Inlay hints and diagnostics of the displayed file, reduced to the materialized rows; stale snapshots paint nothing.
pub mod annotation;

/// Underline runs, severity markers, and hint labels positioned after each line's text from the shaped rows.
pub mod annotation_layout;

/// Diagnostic underline pixels in one line style per severity.
pub mod annotation_paint;

/// Partial ligature selection clips foreground against source selection geometry.
mod selection_paint;

/// Selected-text ink follows the selection background's lightness, not the color scheme.
pub mod selection_ink;

/// One local project boundary exposes directory snapshots without mutation operations.
pub mod workspace;

/// Lazy tree rows and expansion state consume background directory snapshots without I/O.
pub mod file_tree;

/// Bounded background directory reads apply only current tree-request replies.
pub mod directory_worker;

/// Startup argument grammar is independent of filesystem and native display initialization.
pub mod cli;

/// Latest-request-wins project source opening preserves the displayed document until success.
pub mod file_open;

/// Bounded combined-search results retain independent filename and content outcomes.
pub mod search;

/// Ripgrep JSON and native filename payloads are validated before entering result models.
pub mod search_protocol;

/// Filename matching follows editord's smart-case literal-substring rule.
pub mod search_query;

/// Overlay query parsing and shortcut timing are independent of native event delivery.
pub mod search_input;

/// One-way cancellation reaches both search children without waiting for another output record.
pub mod search_cancel;

/// One latest query and one latest reply keep search independent of native event-loop timing.
pub mod search_worker;

/// Child output is bounded before parsing or diagnostic retention.
mod search_io;

/// Streaming collectors preserve result order and stop at the approved caps.
mod search_collect;

/// Read-only ripgrep subprocesses are killed and reaped on cancellation or output limits.
mod search_process;

/// Plain literal, case-insensitive in-file matching kept in one replaceable function.
pub mod find;

/// Active, next, previous, and visible matches derived from the reading selection.
pub mod find_navigation;

/// One bounded in-file find job; replies are tagged by file generation, revision, and query.
pub mod find_worker;

/// Match rectangles for materialized rows share selection's shaped geometry.
pub mod find_paint;

/// Unmodified variable and real italic font assets with stable source-font identities.
pub mod font_asset;

/// Validated immutable source weight, italic, and OpenType feature settings.
pub mod source_typography;
