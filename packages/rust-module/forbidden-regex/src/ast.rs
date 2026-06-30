//! What:    Regular-expression abstract syntax: the node algebra and its smart constructors.
//! Why:     This file is the Rust module that groups the ast implementation, so a reader can
//!          enter the package through one named area.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // module ast: see exported functions and types below.
//! ```

/// What:    The derivative-regex node type (`Node`) and its variants.
/// Why:     The package keeps that concept in a separate Rust file so this module can refer to
///          it by name.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import "./node";
/// ```
pub mod node;

/// What:    Normalizing constructors that keep the node algebra canonical.
/// Why:     The package keeps that concept in a separate Rust file so this module can refer to
///          it by name.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import "./smart";
/// ```
pub mod smart;
