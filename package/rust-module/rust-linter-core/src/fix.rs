//! Edits a rule proposes, and how much trust each one carries.

// What:     `use crate::span::Span;` imports a type from this same crate.
//           `crate::` means "from the root of this crate", never from an external
//           dependency; a dependency would be named directly, as `ra_ap_syntax::`.
// Why:      An edit is a span plus the text that replaces it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Span } from "./span";
// ```
/// Imports the source-range type an edit replaces.
use crate::span::Span;

// What:     `pub enum FixKind { ... }` declares a type whose value is exactly one
//           of the listed variants. Unlike a TS union of string literals, the
//           variants are not strings and cannot be compared to arbitrary text;
//           the compiler checks every branch that inspects one.
// Why:      oxlint gates its three fix flags on exactly this distinction, and
//           parity means a rule can say how much trust its edit deserves rather
//           than the runner guessing.
//
// In TS you'd write (pseudocode):
// ```ts
// type FixKind = "safe" | "suggestion" | "dangerous";
// ```
/// How much trust an edit carries, mirroring oxlint's three fix levels.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FixKind {
    /// Preserves behaviour; applied by `--fix`.
    Safe,

    /// May change behaviour; applied only by `--fix-suggestions`.
    Suggestion,

    /// May change behaviour and may be wrong; applied only by `--fix-dangerously`.
    Dangerous,
}

/// Ordering helpers for fix trust levels.
impl FixKind {
    // What:     `pub fn is_applied_at(&self, ceiling: FixKind) -> bool`. `&self`
    //           borrows the value read-only rather than taking ownership of it,
    //           so the caller keeps its copy. `bool` is the same true/false type
    //           TS has.
    // Why:      The runner holds one ceiling derived from which fix flag the user
    //           passed, and asks each edit whether it clears that ceiling. Putting
    //           the comparison here keeps the ordering in one place instead of
    //           spread across the applier.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // isAppliedAt(ceiling: FixKind): boolean
    // ```
    /// Report whether an edit of this kind may be applied under `ceiling`.
    pub fn is_applied_at(&self, ceiling: FixKind) -> bool {
        // `rank` maps each variant onto a number so the comparison is a plain
        // integer one rather than a nest of equality tests.
        return self.rank() <= ceiling.rank()
    }

    /// Return this kind's position in the trust ordering, lowest is most trusted.
    fn rank(&self) -> u8 {
        // What:     `if *self == FixKind::Safe { .. }`. `*self` dereferences the
        //           borrow back to a value so it can be compared; `::` is the
        //           namespace separator, reaching a variant inside its enum.
        //           An if/else chain rather than a `match`, because the repo's
        //           AGENTS.md PP9 prefers chains over `switch`-shaped constructs.
        // Why:      Safe edits are applied under every ceiling, dangerous ones
        //           only under the highest.
        if *self == FixKind::Safe {
            return 0
        } else if *self == FixKind::Suggestion {
            return 1
        } else {
            return 2
        }
    }
}

// What:     `pub struct Edit { .. }` is one textual replacement.
// Why:      Splitting an edit out from the fix that owns it lets one fix rewrite
//           several disjoint ranges, which a rule that moves an item between two
//           places needs.
/// One replacement of a source range with new text.
#[derive(Clone, Debug)]
pub struct Edit {
    /// Range replaced by `replacement`.
    pub span: Span,

    // What:     `replacement: String`. An OWNED, heap-allocated, growable UTF-8
    //           string. Sibling: `&str`, a borrowed view into someone else's
    //           text. Owned here because replacement text is built at runtime and
    //           must outlive the rule invocation that produced it.
    // Why:      Hold the text written over the span.
    /// Text written in place of `span`; empty text deletes the range.
    pub replacement: String,
}

/// Constructors for source edits.
impl Edit {
    /// Build an edit replacing `span` with `replacement`.
    pub fn new(span: Span, replacement: impl Into<String>) -> Self {
        return Self {
            span,
            replacement: replacement.into(),
        }
    }
}

// What:     `pub struct Fix { .. }` bundles the edits of one proposed repair with
//           the trust level that governs whether they are applied.
// Why:      A fix is atomic: either all its edits apply or none do, because half
//           a rename is worse than no rename.
/// Complete repair a rule proposes for one diagnostic.
#[derive(Clone, Debug)]
pub struct Fix {
    /// Trust level gating whether this repair is applied.
    pub kind: FixKind,

    // What:     `edits: Vec<Edit>`. `Vec<T>` is a growable, heap-allocated,
    //           OWNED array, the counterpart of a TS `T[]`. Sibling: `&[T]`, a
    //           borrowed view of someone else's array.
    // Why:      One repair may touch several disjoint ranges.
    /// Every edit this repair performs, applied together or not at all.
    pub edits: Vec<Edit>,

    /// Short description of the repair, shown by editors offering it as an action.
    pub message: String,
}

/// Constructors for proposed repairs.
impl Fix {
    /// Build a single-edit repair at the given trust level.
    pub fn single(kind: FixKind, message: impl Into<String>, edit: Edit) -> Self {
        // What:     `vec![edit]`. `vec!` is a macro, which the trailing `!` marks;
        //           it builds a `Vec` from the listed elements. Macros run at
        //           compile time and are not ordinary function calls.
        // Why:      Wrap the one edit in the collection the field expects.
        return Self {
            kind,
            edits: vec![edit],
            message: message.into(),
        }
    }

    /// Build a repair performing several edits together.
    pub fn multiple(kind: FixKind, message: impl Into<String>, edits: Vec<Edit>) -> Self {
        return Self {
            kind,
            edits,
            message: message.into(),
        }
    }
}
