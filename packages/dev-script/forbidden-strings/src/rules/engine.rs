// What:     `use resharp::Regex;` imports the resharp regex type.
//           Resharp's `Regex` holds a `Mutex<RegexInner>` for lazy DFA
//           growth, so calling `is_match`/`find_all` on a SHARED Regex
//           from multiple threads serializes through that lock. Each
//           rule gets its own Regex, so per-rule parallelism still
//           works (different mutexes).
// Why:      We use resharp only for the (smaller) regex bucket --
//           literals go through AC. The combined-over-regex-bucket
//           Regex acts as a fast "any regex rule might match?" gate.
// TS map:   `import { Regex } from "resharp";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Regex } from "resharp";
// ```
use resharp::Regex;

// What:     `use regex::bytes::Regex as PlainRegex;` imports the
//           standard `regex` crate's byte-mode regex type under an
//           alias to disambiguate from `resharp::Regex`. The `regex`
//           crate is Rust's mainline regex engine (Russ Cox-style
//           NFA + lazy DFA + Teddy literal accel); its compile path
//           is roughly 100x faster than resharp on patterns that
//           don't use set-algebra (`A&B`, `~(A)`). Resharp's
//           strength is set-algebra and bounded-state guarantees --
//           its compile cost is the price of admitting set
//           operations as first-class. For rules without set-algebra
//           (the overwhelming majority of our secret-detection
//           corpus -- 257 of 259 rules in the betterleaks example),
//           `regex` produces an equivalent matcher in a fraction of
//           the time.
// Why:      Phase 1 (regex compile) was the dominant remaining cost
//           at 2.0s of 2.96s total wall. Switching the 257
//           non-set-algebra rules to `regex` drops Phase 1 to
//           tens of milliseconds, putting total wall well under 1s
//           on the current corpus and providing the 5x growth
//           headroom the user asked for.
// TS map:   No equivalent crate exists in TS; closest is the
//           built-in `RegExp` which is engineered for pattern-search
//           rather than streaming bulk-text scan.
//
// In TS you'd write (pseudocode):
// ```ts
// // No 1:1; pretend `import { Regex as PlainRegex } from "regex-bytes";`
// ```
use regex::bytes::Regex as PlainRegex;

// What:     `pub enum CompiledRegex { Resharp(Regex), Plain(PlainRegex) }`
//           is the unified compiled-regex container. Each rule's
//           source is classified at load time (set-algebra vs not)
//           and routed to the appropriate engine. Both engines
//           satisfy the same `find_all`/`is_match` contract via
//           inherent methods on this enum.
// Why:      A single dispatch point keeps `scan.rs` engine-agnostic
//           on the hot path. Without this, `RegexRule.re` would have
//           to be `Box<dyn Trait>` -- which adds vtable indirection
//           per call AND prevents inlining. Static dispatch via
//           `match` lets LLVM specialize each branch.
// TS map:   `type CompiledRegex = { kind: "resharp"; re: Regex } | { kind: "plain"; re: PlainRegex };`.
//
// In TS you'd write (pseudocode):
// ```ts
// type CompiledRegex =
//   | { kind: "resharp"; re: Regex }
//   | { kind: "plain"; re: PlainRegex };
// ```
//
// Clippy lint suppressed: `Resharp` carries a 3.3 KiB inner DFA struct,
// while `Plain` is 32 bytes. Boxing the Resharp arm would add a heap
// indirection on every `find_all`/`is_match` (the hot path), regressing
// scan throughput. The size asymmetry is acceptable -- a few hundred
// `RegexRule` values is a one-time per-process cost.
#[allow(clippy::large_enum_variant)]
pub enum CompiledRegex {
    Resharp(Regex),
    Plain(PlainRegex),
}

// What:     `pub struct ScanMatch { pub start: usize, pub end: usize }`
//           is the engine-agnostic match record. Field-shape is
//           identical to `resharp::Match` so `scan.rs` code reading
//           `m.start`/`m.end` works unchanged whether the source
//           engine is resharp or regex. The fields are byte offsets
//           into the scanned content; `start` is inclusive, `end`
//           exclusive (half-open range).
// Why:      We can't expose `resharp::Match` directly when the match
//           originated from `regex` because regex's match type
//           (`regex::bytes::Match`) is a separate library type with
//           method-style accessors `.start()`/`.end()`. Translating
//           to a common record at the dispatch boundary keeps
//           call-sites uniform.
// TS map:   `type ScanMatch = { start: number; end: number };`.
//
// In TS you'd write (pseudocode):
// ```ts
// type ScanMatch = { start: number; end: number };
// ```
#[derive(Debug, Clone, Copy)]
pub struct ScanMatch {
    pub start: usize,
    pub end: usize,
}

impl CompiledRegex {
    // What:     `pub fn find_all(&self, content: &[u8]) -> Result<Vec<ScanMatch>, ()>`
    //           returns every non-overlapping match in `content` as
    //           a Vec of ScanMatch. The empty Vec means clean (no
    //           matches). The `Result::Err(())` arm covers engine-
    //           specific errors that callers don't need to
    //           distinguish (resharp can return `Error::TooLarge`
    //           on pathological inputs; we treat any error as
    //           "skip this rule on this file" rather than crash).
    // Why:      Single dispatch point for the violation-path
    //           `find_all` call from `scan.rs`. The `Result<_, ()>`
    //           shape lets callers use `if let Ok(matches) = ...`
    //           without unwrapping engine-specific error types.
    // TS map:   `findAll(content: Uint8Array): ScanMatch[]` (TS would
    //           throw on engine error rather than return Result).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // findAll(content: Uint8Array): ScanMatch[] {
    //   if (this.kind === "resharp") return this.re.findAll(content);
    //   return Array.from(this.re.findIter(content), (m) => ({ start: m.start, end: m.end }));
    // }
    // ```
    pub fn find_all(&self, content: &[u8]) -> Result<Vec<ScanMatch>, ()> {
        match self {
            CompiledRegex::Resharp(re) => re
                .find_all(content)
                .map(|ms| {
                    ms.into_iter()
                        .map(|m| ScanMatch { start: m.start, end: m.end })
                        .collect()
                })
                .map_err(|_| ()),
            CompiledRegex::Plain(re) => Ok(re
                .find_iter(content)
                .map(|m| ScanMatch { start: m.start(), end: m.end() })
                .collect()),
        }
    }

    // What:     `pub fn is_match(&self, content: &[u8]) -> bool` is the
    //           short-circuit "any match anywhere" check. Used by the
    //           Combined residual shard's gate.
    // Why:      Some engines short-circuit on first match much faster
    //           than collecting all matches; expose `is_match`
    //           explicitly so the gate path uses the engine's fast
    //           path. Errors are folded into `false` (treat as no
    //           match) -- the same conservative-no-match behaviour as
    //           `find_all`'s `Err`.
    // TS map:   `isMatch(content: Uint8Array): boolean`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // isMatch(content: Uint8Array): boolean {
    //   if (this.kind === "resharp") return this.re.isMatch(content);
    //   return this.re.isMatch(content);
    // }
    // ```
    pub fn is_match(&self, content: &[u8]) -> bool {
        match self {
            CompiledRegex::Resharp(re) => re.is_match(content).unwrap_or(false),
            CompiledRegex::Plain(re) => re.is_match(content),
        }
    }
}

// What:     `fn requires_resharp(src: &str) -> bool` returns `true` when
//           `src` contains any feature the `regex` crate cannot parse
//           but resharp can. Two feature families trigger true:
//           1. Set-algebra operators: unescaped `&` or `~(` outside a
//              character class (resharp's intersection / complement).
//           2. Lookaround groups: `(?=`, `(?!`, `(?<=`, `(?<!`. The
//              `regex` crate rejects these with "look-around, including
//              look-ahead and look-behind, is not supported"; resharp
//              accepts them.
//           Conservative: any of the above triggers true, even if the
//           resharp parser would have accepted a sequence the regex
//           crate also accepts (no false-positive cost beyond using the
//           slower engine).
// Why:      We need to dispatch each rule to its engine at compile time.
//           This shallow string scan avoids invoking either engine's
//           parser; the actual parse happens once via the chosen
//           engine. Regex character classes can contain `&` and parens
//           as literal bytes (e.g. `[&a-z]`, `[()]`) without those
//           characters carrying their group/algebra meaning, so we
//           track class membership and skip class interiors. Named
//           captures `(?<name>` / `(?P<name>` and non-capturing groups
//           `(?:` must NOT trigger -- the regex crate handles them --
//           so the lookbehind discriminator is "the byte after `(?<`
//           is `=` or `!`", not "the regex contains `(?<`".
// TS map:   `function requiresResharp(src: string): boolean`.
//
// In TS you'd write (pseudocode):
// ```ts
// function requiresResharp(src: string): boolean {
//   // walk bytes, skip \X escapes, track class membership,
//   // return true on outside-class `&`, `~(`, or any of
//   // `(?=`, `(?!`, `(?<=`, `(?<!`.
// }
// ```
pub fn requires_resharp(src: &str) -> bool {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'\\' {
            i += 2;
            continue;
        }
        if !in_class && c == b'[' {
            in_class = true;
            i += 1;
            continue;
        }
        if in_class && c == b']' {
            in_class = false;
            i += 1;
            continue;
        }
        if !in_class {
            if c == b'&' {
                return true;
            }
            if c == b'~' && i + 1 < bytes.len() && bytes[i + 1] == b'(' {
                return true;
            }
            // Lookaround detection. Shape: `(?` followed by `=`/`!` is
            // a lookahead; `(?<` followed by `=`/`!` is a lookbehind.
            // Other `(?...` forms (`(?:`, `(?P<`, `(?<name>`, `(?#...)`,
            // inline flags `(?i)`) are NOT lookarounds and the regex
            // crate handles them, so they must not trigger.
            if c == b'(' && i + 2 < bytes.len() && bytes[i + 1] == b'?' {
                let after = bytes[i + 2];
                if after == b'=' || after == b'!' {
                    return true;
                }
                if after == b'<'
                    && i + 3 < bytes.len()
                    && (bytes[i + 3] == b'=' || bytes[i + 3] == b'!')
                {
                    return true;
                }
            }
        }
        i += 1;
    }
    false
}

// What:     `const TROUBLESHOOT_REF: &str = "...";` is a compile-time
//           constant pointing readers from a runtime error message to
//           the long-form troubleshooting doc. `&str` here is a
//           reference into the binary's read-only string table -- no
//           allocation, no per-call cost.
// Why:      Centralise the doc reference so renaming or moving the
//           file updates one site, not five. Every message returned by
//           `lookaround_in_complement` ends with this constant.
// TS map:   `const TROUBLESHOOT_REF = "...";`.
//
// In TS you'd write (pseudocode):
// ```ts
// const TROUBLESHOOT_REF = "See TROUBLESHOOTING.resharp.md for workarounds.";
// ```
const TROUBLESHOOT_REF: &str = "See TROUBLESHOOTING.resharp.md for workarounds.";

// What:     `pub fn lookaround_in_complement(src: &str) -> Option<String>`
//           returns `Some(reason)` when `src` contains a `~(...)` whose
//           body holds an atom that resharp 0.5.x cannot handle, and
//           `None` otherwise. The detected atoms are:
//             - `\b` (rewritten to a lookaround pair, then refused by
//               the reverse pass at `resharp-algebra/src/lib.rs:2234`)
//             - `\B` (parser falls through to the generic assertion
//               handler at `resharp-parser/src/lib.rs:1419-1424` and
//               rejects at parse time)
//             - unescaped `^` or `$` (rewritten to lookaround in
//               default-multiline mode at
//               `resharp-parser/src/lib.rs:1425-1441`, then refused)
//             - user-explicit lookaround `(?=`, `(?!`, `(?<=`, `(?<!`
//               (refused by the same reverse-pass arm)
//           The function tracks paren depth via a stack of "is this
//           open paren a complement-open" flags so we can recognise
//           when the matching close exits the complement. Character
//           class interiors `[...]` are skipped because inside a class
//           those bytes are literal, not the structural metacharacters.
// Why:      Catch the failure shape before the rule reaches
//           `resharp::Regex::new`, so the user gets an actionable
//           message that names the surface trigger ("complement body
//           contains \b") instead of resharp's opaque rendering
//           ("unsupported lookaround pattern" or
//           "UnsupportedResharpRegex"), which the user must reverse-
//           engineer back to their own input.
// TS map:   `function lookaroundInComplement(src: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function lookaroundInComplement(src: string): string | null {
//   // walk bytes; for each position, track:
//   //   inClass: are we inside `[...]`?
//   //   parenStack: bool[] -- true means the open paren was `~(`
//   // inside a complement (any `true` in the stack) and outside a class,
//   // reject \b, \B, ^, $, (?=, (?!, (?<=, (?<!.
// }
// ```
pub fn lookaround_in_complement(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    // What:     `let mut paren_stack: Vec<bool> = Vec::new();`. A growable
    //           vector of `bool`. Each entry records the kind of an
    //           unclosed open paren -- `true` if the opener was `~(`,
    //           `false` for any other `(` (including non-capturing
    //           `(?:`, named `(?P<...>`, inline flags `(?i)`). On `)`
    //           we pop the top; tracking complement-ness depth-aware
    //           lets nested constructs like `~(.*(?:foo).*)` correctly
    //           identify the `~(` as the complement while the inner
    //           `(?:foo)` close does not exit the complement.
    // Why:      Without per-open kind tracking we cannot tell whether
    //           a `)` closes a complement or a regular group, so we
    //           cannot bound the complement body.
    // TS map:   `const parenStack: boolean[] = [];`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const parenStack: boolean[] = [];
    // ```
    let mut paren_stack: Vec<bool> = Vec::new();
    while i < bytes.len() {
        let c = bytes[i];
        // What:     `if c == b'\\' { ... }` handles regex escape
        //           sequences. The trigger atoms `\b` and `\B` ARE
        //           escape sequences, so we check the escapee byte
        //           BEFORE skipping past the pair. Outside a complement
        //           or inside a class, `\b` is literal-ish and we just
        //           skip the two bytes.
        // Why:      The trigger is the escape sequence itself, not the
        //           backslash. Treating `\\` as "skip 2" would let us
        //           miss `\b` and `\B` entirely.
        // TS map:   `if (c === 0x5c) { ... }` (0x5c = `\`).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (c === '\\'.charCodeAt(0)) {
        //   if (inComplement && !inClass && i + 1 < bytes.length) {
        //     const e = bytes[i + 1];
        //     if (e === 'b') return msgWordBoundary();
        //     if (e === 'B') return msgNotWordBoundary();
        //   }
        //   i += 2; continue;
        // }
        // ```
        if c == b'\\' {
            let in_complement = !in_class && paren_stack.iter().any(|&k| k);
            if in_complement && i + 1 < bytes.len() {
                match bytes[i + 1] {
                    b'b' => {
                        return Some(format!(
                            "complement body contains \\b; resharp 0.5.x rewrites it to an internal lookaround which the reverse pass refuses. Replace with \\W (consumes a char on each side) or literal whitespace, or move the boundary check outside the complement. {}",
                            TROUBLESHOOT_REF
                        ));
                    }
                    b'B' => {
                        return Some(format!(
                            "complement body contains \\B; resharp 0.5.x rejects it at parse time when its neighbours are unclassifiable. Restructure the rule to avoid \\B inside the complement. {}",
                            TROUBLESHOOT_REF
                        ));
                    }
                    _ => {}
                }
            }
            i += 2;
            continue;
        }
        if !in_class && c == b'[' {
            in_class = true;
            i += 1;
            continue;
        }
        if in_class && c == b']' {
            in_class = false;
            i += 1;
            continue;
        }
        if !in_class {
            // What:     `let in_complement = paren_stack.iter().any(|&k| k);`
            //           returns `true` when ANY entry in the paren
            //           stack is a complement-open. Equivalent to
            //           "we are nested inside at least one `~(`".
            //           `.iter()` borrows the vec; `.any(closure)`
            //           short-circuits on the first match.
            // Why:      A `^` inside a regular group nested inside a
            //           complement (`~(foo(.|\n)*^bar)`) is still
            //           "inside the complement" for resharp's purposes;
            //           the rewrite happens regardless of intermediate
            //           non-complement parens.
            // TS map:   `const inComplement = parenStack.some(Boolean);`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const inComplement = parenStack.some(Boolean);
            // ```
            let in_complement = paren_stack.iter().any(|&k| k);
            if in_complement {
                if c == b'^' {
                    return Some(format!(
                        "complement body contains ^; resharp 0.5.x rewrites it to a lookbehind in default-multiline mode, which the reverse pass refuses. Use \\A for whole-content start-anchor semantics, or move the anchor outside the complement. {}",
                        TROUBLESHOOT_REF
                    ));
                }
                if c == b'$' {
                    return Some(format!(
                        "complement body contains $; resharp 0.5.x rewrites it to a lookahead in default-multiline mode, which the reverse pass refuses. Use \\z for whole-content end-anchor semantics, or move the anchor outside the complement. {}",
                        TROUBLESHOOT_REF
                    ));
                }
                if c == b'(' && i + 2 < bytes.len() && bytes[i + 1] == b'?' {
                    let after = bytes[i + 2];
                    if after == b'=' || after == b'!' {
                        return Some(format!(
                            "complement body contains a lookahead (?{}; the reverse pass refuses complement-of-lookaround. Lift the lookaround outside the complement. {}",
                            after as char, TROUBLESHOOT_REF
                        ));
                    }
                    if after == b'<'
                        && i + 3 < bytes.len()
                        && (bytes[i + 3] == b'=' || bytes[i + 3] == b'!')
                    {
                        return Some(format!(
                            "complement body contains a lookbehind (?<{}; the reverse pass refuses complement-of-lookaround. Lift the lookaround outside the complement. {}",
                            bytes[i + 3] as char, TROUBLESHOOT_REF
                        ));
                    }
                }
            }
            // What:     Push/pop the paren stack. Order matters: detect
            //           `~(` BEFORE the bare-`(` arm, otherwise the `~`
            //           and `(` would be pushed independently and we
            //           would miscount.
            // Why:      Maintain accurate complement-depth tracking
            //           across nested groups.
            // TS map:   The same push/pop pattern in JS.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (c === '~' && bytes[i+1] === '(') { parenStack.push(true); i += 2; continue; }
            // if (c === '(') { parenStack.push(false); i += 1; continue; }
            // if (c === ')') { parenStack.pop(); i += 1; continue; }
            // ```
            if c == b'~' && i + 1 < bytes.len() && bytes[i + 1] == b'(' {
                paren_stack.push(true);
                i += 2;
                continue;
            }
            if c == b'(' {
                paren_stack.push(false);
                i += 1;
                continue;
            }
            if c == b')' {
                paren_stack.pop();
                i += 1;
                continue;
            }
        }
        i += 1;
    }
    None
}
