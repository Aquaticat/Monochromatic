//! Regular-expression abstract syntax: the node algebra and its smart constructors.

/// The derivative-regex node type (`Node`) and its variants.
pub mod node;

/// Normalizing constructors that keep the node algebra canonical.
pub mod smart;
