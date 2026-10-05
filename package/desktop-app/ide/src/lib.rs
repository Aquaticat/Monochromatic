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

/// Tab expansion retains exact source/display correspondence.
pub mod text_projection;

/// Shared shaping for mixed-script source rows, caret, and hit testing.
pub mod shaped_text;

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

/// Partial ligature selection clips foreground against source selection geometry.
mod selection_paint;

/// One local project boundary exposes directory snapshots without mutation operations.
pub mod workspace;

/// Lazy tree rows and expansion state consume background directory snapshots without I/O.
pub mod file_tree;

/// Bounded background directory reads apply only current tree-request replies.
pub mod directory_worker;

/// Startup argument grammar is independent of filesystem and native display initialization.
pub mod cli;

/// Unmodified variable and real italic font assets with stable source-font identities.
pub mod font_asset;

/// Validated immutable source weight, italic, and OpenType feature settings.
pub mod source_typography;
