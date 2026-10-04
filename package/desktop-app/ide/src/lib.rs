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
