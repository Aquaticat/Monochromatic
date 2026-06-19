//! rules walker support for the forbidden-strings scanner.
/// Imports dependencies used by this module.
use super::atom::{skip_atom_with_extract, walk_literal_bytes};

/// Implements `extract_scope`.
// What:     `pub(super) fn extract_scope(s: &str, ci: bool) -> Option<Vec<(String, bool)>>`
//           splits `s` on top-level `|` (respecting paren depth, character
//           classes, and `\X` escapes) and returns the union of each
//           branch's required-substring set, each tagged with the
//           ci context active when extracted. Returns `None` if any
//           branch's `extract_branch` returns None -- soundness demands
//           that every branch be covered by at least one registered
//           substring. A branch with no required content (e.g. `.*`,
//           `(?:foo)?`) cannot be gated, so the whole alternation
//           cannot be gated.
// Why:      Top-level alternation handling lives here so it can be
//           reached BOTH from the outer wrapper (`extract_gating_substrings`)
//           AND from inside a group body via `skip_atom_with_extract`'s
//           recursion. The body of `(?:foo|bar)` has its own top-level
//           alternation; calling `extract_scope` on it splits "foo|bar"
//           and returns [("foo", ci), ("bar", ci)] inheriting the
//           caller's ci context.
//
// In TS you'd write (pseudocode):
// ```ts
// function extractScope(s: string, ci: boolean): Array<{ sub: string; ci: boolean }> | null {
//   const branches = splitTopLevelAlternations(s);
//   const out: Array<{ sub: string; ci: boolean }> = [];
//   for (const branch of branches) {
//     const branchSubs = extractBranch(branch, ci);
//     if (branchSubs === null) return null;
//     out.push(...branchSubs);
//   }
//   return out;
// }
// ```
pub(super) fn extract_scope(s: &str, ci: bool) -> Option<Vec<(String, bool)>> {
    let branches = split_top_level_alternations(s);
    let mut out: Vec<(String, bool)> = Vec::new();
    for branch in branches {
        let branch_subs = extract_branch(branch, ci)?;
        out.extend(branch_subs);
    }
    if out.is_empty() {
        return None;
    }
    Some(out)
}

/// Implements `extract_branch`.
// What:     `fn extract_branch(s: &str, ci: bool) -> Option<Vec<(String, bool)>>`
//           walks one branch (no top-level `|`), returning the BEST candidate
//           gating set. A "candidate" is either a single literal run
//           (e.g. ("keyword", ci)) or the multi-substring set returned
//           by a required group's body (e.g. [("foo", ci), ("bar", ci)]
//           from `(?:foo|bar)`). "Best" is the most-selective: highest
//           minimum substring length across the candidate's elements.
//           The `ci` parameter is the scoped-flag context; `current_lit`
//           literals walked at this level inherit it. A scoped-flag
//           group inside the branch may yield substrings tagged with a
//           different ci -- those carry their own per-substring ci.
// Why:      A single branch may have multiple required structures in
//           sequence (`prefix(?:foo|bar)suffix`). The walker only needs
//           ONE of them as the rule's gate -- pick the most selective
//           to minimise spurious AC fires. Choosing the longest single
//           literal beats a low-min alternation; choosing a long-min
//           alternation beats a short literal.
//
// In TS you'd write (pseudocode):
// ```ts
// function extractBranch(s: string, ci: boolean): Array<{ sub: string; ci: boolean }> | null {
//   let best: Array<{ sub: string; ci: boolean }> = [];
//   let bestScore = 0;
//   let current = "";
//   while (s.length > 0) {
//     // walk literals into current at outer ci; pick best between current-as-singleton and prior best
//     // skip atom (class/group/escape); recurse into group body via extractScope with appropriate ci
//   }
//   return best.length > 0 ? best : null;
// }
// ```
fn extract_branch(s: &str, ci: bool) -> Option<Vec<(String, bool)>> {
    // What:     `let mut s = s;`. Shadows the parameter `s: &str`
    //           with a NEW mutable binding of the same type, allowing
    //           us to reassign `s` to a tail slice as the walker
    //           advances. The original parameter binding was
    //           immutable; this `let mut` rebinding gives us mutability
    //           without changing the underlying borrow.
    // Why:      The walker repeatedly trims the head of `s` as it
    //           consumes atoms; we need to be able to write `s = rest;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let s = sParam;
    // ```
    let mut s = s;
    // What:     `let mut ci = ci;`. Same shadow-into-mut pattern as
    //           the `s` rebinding above. We need ci to be mutable so
    //           that an inline `(?flags)` group encountered mid-branch
    //           can update the ci context for subsequent literals at
    //           this scope.
    // Why:      Closes BUG 1: previously `ci` was a function parameter
    //           used unchanged through the loop, so inline-flag changes
    //           did not propagate forward. Subsequent literals walked
    //           after an inline `(?i)` were tagged with the original ci.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let ci = ciParam;
    // ```
    let mut ci = ci;
    let mut best: Vec<(String, bool)> = Vec::new();
    let mut best_score: usize = 0;
    // What:     `let mut current_lit = String::new();`. Empty owned
    //           `String` that will hold the literal characters being
    //           accumulated by `walk_literal_bytes`. `String::new()`
    //           is the empty-string constructor (no allocation until
    //           the first push).
    // Why:      Buffer for the run of literal characters at the
    //           current walker position.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let currentLit = "";
    // ```
    let mut current_lit = String::new();
    loop {
        // What:     `walk_literal_bytes(s, &mut current_lit, &mut s)`.
        //           `&mut current_lit` is a MUTABLE BORROW: we lend
        //           the owned `String` to the callee with permission
        //           to modify it. Same with `&mut s` -- a mutable
        //           borrow of the binding `s` itself, so the callee
        //           can reassign `s` to point at the un-walked tail.
        //           Plain `s` (no `&`) on the first arg is a copy of
        //           the `&str` (cheap; `&str` is `Copy`).
        // Why:      Have the walker append literal bytes into our
        //           buffer and advance `s` past them in one call.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const result = walkLiteralBytes(s);
        // currentLit += result.consumed;
        // s = result.remainder;
        // ```
        walk_literal_bytes(s, &mut current_lit, &mut s);
        if !current_lit.is_empty() {
            let score = current_lit.len();
            if score > best_score {
                // What:     `best = vec![(std::mem::take(&mut current_lit), ci)];`.
                //           - `vec![...]` is a macro that builds a
                //             `Vec` from a list of elements.
                //           - `std::mem::take(&mut current_lit)`
                //             swaps `current_lit` for its DEFAULT
                //             value (empty `String`) and returns the
                //             ORIGINAL contents to us. This is the
                //             Rust idiom for "move out of a borrowed
                //             location while leaving it valid". It
                //             avoids cloning while satisfying the
                //             borrow checker (we're not allowed to
                //             move out of `&mut`-borrowed memory
                //             without leaving something there).
                // Why:      Reset the buffer for the next round
                //           AND hand the just-collected literal into
                //           the new `best` vector in one move,
                //           without an extra allocation.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // best = [[currentLit, ci]];
                // currentLit = "";
                // ```
                best = vec![(std::mem::take(&mut current_lit), ci)];
                best_score = score;
            } else {
                current_lit.clear();
            }
        }
        if s.is_empty() {
            break;
        }
        // What:     A `|` here means top-level alternation in the parent
        //           scope -- the caller already split on it, so seeing
        //           `|` at this depth means our walker tried to recurse
        //           below an unrecognised structure. Stop the branch
        //           walk; the best candidate so far is what we have.
        // Why:      Don't consume across the `|` -- doing so would
        //           splice two branches' content into one fake "best",
        //           breaking soundness on patterns like `foobar|barfoo`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (s[0] === "|") break;
        // ```
        if s.starts_with('|') {
            break;
        }
        // What:     Resharp `&` intersects the current positive
        //           operand with the next operand. It consumes no
        //           input bytes itself, so it should not become part
        //           of a literal AC gate.
        // Why:      A pattern like `BUILD_[0-9]{6}&~(BUILD_000000)`
        //           must gate on `BUILD_`, not on a source-text
        //           fragment containing `&`. Skipping `&` also lets
        //           extraction continue to later positive operands
        //           when earlier operands have no useful literal.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (s.startsWith("&")) { s = s.slice(1); continue; }
        // ```
        if let Some(rest) = s.strip_prefix('&') {
            s = rest;
            continue;
        }
        if let Some((rest, contribution, ci_update)) = skip_atom_with_extract(s, ci) {
            s = rest;
            // What:     `if let Some(new_ci) = ci_update { ci = new_ci; }`
            //           applies the bubble-up signal from
            //           `skip_atom_with_extract`. The third tuple
            //           element is `Some(new_ci)` only when the atom
            //           we just consumed was an inline `(?flags)`
            //           group; for every other atom it is `None`.
            // Why:      Closes BUG 1: subsequent calls to
            //           `walk_literal_bytes` push into `current_lit`
            //           which then becomes `(_, ci)` -- the ci tag
            //           reflects what's been declared at this point
            //           in source order, including inline flag changes.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (ciUpdate !== null) ci = ciUpdate;
            // ```
            if let Some(new_ci) = ci_update {
                ci = new_ci;
            }
            if let Some(candidate) = contribution {
                let score = candidate.iter().map(|(x, _)| x.len()).min().unwrap_or(0);
                if score > best_score {
                    best = candidate;
                    best_score = score;
                }
            }
            continue;
        }
        break;
    }
    if best.is_empty() {
        return None;
    }
    Some(best)
}

/// Implements `split_top_level_alternations`.
// What:     `fn split_top_level_alternations(s: &str) -> Vec<&str>`
//           returns slices of `s` separated by `|` characters at
//           depth 0 (i.e. NOT inside a `(...)` group, NOT inside a
//           `[...]` character class, and NOT escaped as `\|`). The
//           slices share `s`'s lifetime -- no allocation per branch.
// Why:      Cannot just call `s.split('|')` because:
//           - `|` inside `[a|b]` is a literal character.
//           - `|` inside `(foo|bar)` is alternation at depth 1, which
//             is the GROUP's responsibility, not the outer scope's.
//           - `\|` is an escaped pipe (literal `|`).
//
// In TS you'd write (pseudocode):
// ```ts
// function splitTopLevelAlternations(s: string): string[] {
//   // Walk bytes, tracking paren depth + class membership.
//   // Push slice on each unescaped depth-0 `|` outside a class.
// }
// ```
fn split_top_level_alternations(s: &str) -> Vec<&str> {
    let bytes = s.as_bytes();
    let mut out: Vec<&str> = Vec::new();
    let mut start: usize = 0;
    let mut depth: usize = 0;
    let mut in_class = false;
    let mut i: usize = 0;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'\\' {
            // Escape: skip 2 bytes (regardless of class membership).
            i += 2;
            continue;
        }
        if !in_class && c == b'[' {
            in_class = true;
            i += 1;
            continue;
        }
        if in_class {
            if c == b']' {
                in_class = false;
            }
            i += 1;
            continue;
        }
        if c == b'(' {
            depth += 1;
            i += 1;
            continue;
        }
        if c == b')' {
            depth = depth.saturating_sub(1);
            i += 1;
            continue;
        }
        if c == b'|' && depth == 0 {
            out.push(&s[start..i]);
            start = i + 1;
        }
        i += 1;
    }
    out.push(&s[start..]);
    out
}
