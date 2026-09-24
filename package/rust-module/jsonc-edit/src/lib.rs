//! What:     `monochromatic-jsonc-edit` parses JSONC into a comment-bearing document model, edits it
//!           immutably, and emits canonical JSONC.
//!           A Rust crate is closest to a TypeScript package module: it holds private implementation
//!           files and one public API surface, and the public items are re-exported here so callers
//!           write `monochromatic_jsonc_edit::parse_jsonc` instead of reaching into modules.
//! Why:      The maintained TypeScript package `@monochromatic-dev/module-jsonc-edit` treats comments
//!           as queryable data rather than discarded trivia, compares numbers by exact mathematical
//!           value while retaining unedited spelling, and keeps escaped unpaired UTF-16 surrogates.
//!           This crate carries the same supported behavior into native Rust with no dependencies and
//!           no `unsafe` block, as recorded in `doc/decision/jsonc-edit-rust-foundation.md`.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! import { parseJsonc, jsoncStringify } from '@monochromatic-dev/module-jsonc-edit';
//! ```

/// What:     The crate's public failure types.
/// Why:      Parse, number, address and shape failures answer different caller questions, so each has
///           its own type.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export * from './errors';
/// ```
pub mod error;

/// What:     Decimal digit-string arithmetic for unbounded number exponents.
/// Why:      A JSON exponent may carry more digits than any machine integer holds, and this crate
///           refuses to bound or materialize it.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // private module: decimal string addition and subtraction.
/// ```
mod number_scale;

/// What:     The exact mathematical identity of a JSON number literal.
/// Why:      `1`, `1.0` and `1e0` must compare equal while adjacent large integers stay distinct.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export { JsoncNumberIdentity } from './number';
/// ```
pub mod number;

/// What:     Document addresses used by the read and edit surface.
/// Why:      A key and an array index are different questions, and the type keeps them apart.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export type { JsoncPath } from './path';
/// ```
pub mod path;

/// What:     The parsed document model: values, members, keys, numbers and attached comments.
/// Why:      Every key and every value carries its own optional comment, which is what makes the
///           comment surface queryable instead of merely preserved.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export type { JsoncValue } from './value';
/// ```
pub mod value;

/// What:     Re-export the failure types at the crate root.
/// Why:      Callers name `monochromatic_jsonc_edit::JsoncParseError` in signatures without importing
///           a module path.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export { JsoncParseError, JsoncPathNotFoundError, JsoncTypeError } from './errors';
/// ```
pub use error::{JsoncNumberError, JsoncParseError, JsoncPathNotFoundError, JsoncTypeError};
/// What:     Re-export the exact-number identity.
/// Why:      It appears inside the public value model, so it is part of the API surface.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export { JsoncNumberIdentity } from './number';
/// ```
pub use number::JsoncNumberIdentity;
/// What:     Re-export the address type and its key-path helper.
/// Why:      Read and edit calls take addresses, so callers need the type at the crate root.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export { jsoncKeyPath, type JsoncPathSegment } from './path';
/// ```
pub use path::{jsonc_key_path, JsoncPathSegment};
/// What:     Re-export the document model.
/// Why:      These are the types every caller holds, inspects and edits.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// export type { JsoncValue, JsoncKind, JsoncEntry, JsoncKey, JsoncComment } from './value';
/// ```
pub use value::{JsoncComment, JsoncCommentKind, JsoncEntry, JsoncKey, JsoncKind, JsoncValue};
