//! What: Wrapper-only escape-hatch spellings shared by several command modules.
//! Why: `reset`, `stash` and `clean` share one hatch, and `branch`, `checkout` and `switch`
//!      share another; each spelling is declared once.
//! Gotcha: `escape_hatch.rs` of the forwarding work declares
//!         `WORKTREE_ENFORCEMENT_ESCAPE_HATCH` too. This branch was cut before that file
//!         existed; the two declarations are meant to be unified when the branches meet.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // export const WORKTREE_ENFORCEMENT_ESCAPE_HATCH = '--no-enforce-worktree';
//! ```

/// Wrapper-only flag that suppresses linked-worktree enforcement for one guarded
/// `reset`, `stash` or `clean` invocation.
pub const WORKTREE_ENFORCEMENT_ESCAPE_HATCH: &str = "--no-enforce-worktree";

/// Wrapper-only flag that suppresses worktree-first branch creation enforcement for one
/// `branch`, `checkout` or `switch` invocation.
pub const BRANCH_WORKTREE_ESCAPE_HATCH: &str = "--no-enforce-worktree-branch";
