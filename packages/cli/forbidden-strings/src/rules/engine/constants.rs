//! Rustdoc summary for the `rules::engine::constants` module.
/// Rustdoc summary for constant `TROUBLESHOOT_REF`.
// What:     `pub(super) const TROUBLESHOOT_REF: &str = "...";` is a compile-time
//           constant pointing readers from a runtime error message to
//           the long-form troubleshooting doc. `&str` here is a
//           reference into the binary's read-only string table -- no
//           allocation, no per-call cost.
// Why:      Centralise the doc reference so renaming or moving the
//           file updates one site, not five. Every message returned by
//           `lookaround_in_complement` ends with this constant.
//
// In TS you'd write (pseudocode):
// ```ts
// pub(super) const TROUBLESHOOT_REF = "See docs/troubleshooting/resharp.md for workarounds.";
// ```
pub(super) const TROUBLESHOOT_REF: &str = "See docs/troubleshooting/resharp.md for workarounds.";
