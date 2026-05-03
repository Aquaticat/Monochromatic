use super::atom::{skip_atom_with_extract, walk_literal_bytes};

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
// TS map:   `function extractScope(s: string, ci: boolean): Array<{ sub: string; ci: boolean }> | null`.
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
// TS map:   `function extractBranch(s: string, ci: boolean): Array<{ sub: string; ci: boolean }> | null`.
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
    let mut s = s;
    let mut best: Vec<(String, bool)> = Vec::new();
    let mut best_score: usize = 0;
    let mut current_lit = String::new();
    loop {
        walk_literal_bytes(s, &mut current_lit, &mut s);
        if !current_lit.is_empty() {
            let score = current_lit.len();
            if score > best_score {
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
        // TS map:   `if (s[0] === "|") break;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (s[0] === "|") break;
        // ```
        if s.starts_with('|') {
            break;
        }
        if let Some((rest, contribution)) = skip_atom_with_extract(s, ci) {
            s = rest;
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
// TS map:   `function splitTopLevelAlternations(s: string): string[]`.
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
