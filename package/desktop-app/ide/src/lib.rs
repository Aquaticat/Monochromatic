//! Read-only document and workspace logic, independent of the native window.

/// What: Export the document module without exporting a writable filesystem API.
/// Why: Tests and the native window share the same state transitions.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * as document from './document';
/// ```
pub mod document;

/// Shared glyph geometry used by painting and pointer hit testing.
pub mod view_model;
