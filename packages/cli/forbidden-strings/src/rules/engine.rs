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

// What:     `use std::panic::{catch_unwind, AssertUnwindSafe};` brings
//           the panic-recovery primitives into scope.
//           - `catch_unwind(closure)` runs the closure on the current
//             thread. If the closure panics, the panic is INTERCEPTED
//             instead of propagating: the call returns
//             `Err(Box<dyn Any + Send>)` carrying the panic payload.
//             Successful returns are wrapped in `Ok(value)`. The
//             intercepted panic does NOT cause the process to abort or
//             the thread to die -- execution continues after the call.
//           - `AssertUnwindSafe(value)` is a transparent wrapper that
//             asserts to the compiler "I have personally verified this
//             value's invariants survive a panic crossing my
//             closure". Required because Rust's `UnwindSafe` is an
//             AUTO-TRAIT (the compiler derives it structurally): it is
//             NOT implemented for `&T where T: !RefUnwindSafe`, and
//             `&resharp::Regex` is NOT `RefUnwindSafe` because
//             `Regex` holds a `Mutex<RegexInner>` (the lazy-DFA cache
//             from `resharp`'s lazy-determinisation strategy).
//             `AssertUnwindSafe` is sound for our usage because:
//             (a) every `Regex` instance is owned by exactly one
//                 `CompiledRegex` and lives the entire scanner run, so
//                 there is no shared interior state for a panic to
//                 corrupt across calls;
//             (b) a poisoned `Mutex` after a caught panic returns
//                 `PoisonError` on the next lock attempt, which
//                 resharp converts into one of its own `Error`
//                 variants -- our `.map_err(|_| ())` already swallows
//                 those into `Err(())`, exactly the same shape callers
//                 already handle (synthetic "engine error" hit in
//                 `scan.rs`); the failure stays inside the engine
//                 boundary;
//             (c) we never look at the panic payload, so payload-
//                 specific UnwindSafe concerns do not apply.
//             Siblings: `RefUnwindSafe` (same idea, for shared
//             references); `panic::resume_unwind` (re-throws a caught
//             payload -- we never want this here because we are the
//             top of the engine boundary, not a transparent passthrough).
// Why:      Resharp 0.5.x through 0.6.x panics on a handful of fuzzer-
//           discovered rule shapes -- one during `Regex::new` (algebra
//           overflow at `resharp-algebra/src/lib.rs:2479`), one during
//           `find_all` (engine "unexpected end" assertion at
//           `resharp/src/engine.rs:1020`, behind a `debug_assert!`
//           that fires in test profile but is compiled out of release;
//           release silently returns corrupted matches instead).
//           Both crashes are inside upstream code we do not own.
//           `Result::map_err` cannot catch panics; only `catch_unwind`
//           can. Without this wrapper an upstream panic propagates
//           through our process, libFuzzer records a crash, and
//           (more importantly) a production scanner run on the same
//           rule + content pair aborts the process instead of
//           degrading gracefully to "skip this
//           rule on this file". The scanner is a CI gate: an aborted
//           run silently passes the gate.
// TS map:   `try { ... } catch (e) { ... }` -- TS exceptions are
//           always caught structurally; Rust panics require an
//           explicit unwind barrier.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent. Rust requires catch_unwind + AssertUnwindSafe to
// // intercept panics across a closure boundary.
// ```
use std::panic::{catch_unwind, AssertUnwindSafe};

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
            // What:     `catch_unwind(AssertUnwindSafe(|| re.find_all(content)))`.
            //           - The outer `catch_unwind` runs the inner
            //             closure with an unwind barrier; any panic
            //             inside (resharp 0.5.x through 0.6.x has a
            //             `debug_assert!` in `scan_fwd_all` at
            //             `engine.rs:1020` that fires on
            //             `(?:lookahead&lookbehind)` shapes -- only
            //             when `debug_assertions` is on; in release
            //             that path returns corrupted matches instead)
            //             is intercepted and returned as the outer `Err`
            //             arm of a `Result<_, Box<dyn Any + Send>>`.
            //           - `AssertUnwindSafe(...)` wraps the closure so
            //             the compiler accepts that we have manually
            //             verified the captured `&Regex` (which is
            //             NOT `RefUnwindSafe` because it owns a
            //             `Mutex<RegexInner>` for lazy DFA growth) is
            //             safe to use across the panic boundary in
            //             our usage -- see the import-site comment
            //             for the full soundness argument.
            //           - The double-nested `match` flattens the
            //             two-level `Result<Result<_, _>, _>` into a
            //             single `Result<_, ()>`: an outer `Err`
            //             (caught panic), an inner `Err` (resharp's
            //             own `Error`), and the inner `Ok` are all
            //             distinct paths but the engine boundary
            //             erases the difference -- callers already
            //             treat `Err(())` as "engine refused; emit
            //             synthetic hit".
            // Why:      Defense in depth against upstream panics. A
            //           resharp panic without this wrapper would
            //           abort the whole scanner process; with it the
            //           panic stays inside the engine boundary,
            //           degrades the rule on this file only, and lets
            //           the rest of the scan proceed.
            // TS map:   `try { return { ok: true, value: this.re.findAll(content) }; } catch { return { ok: false }; }`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // try {
            //   return { ok: true, value: this.re.findAll(content).map(m => ({ start: m.start, end: m.end })) };
            // } catch { return { ok: false }; }
            // ```
            CompiledRegex::Resharp(re) => {
                let caught = catch_unwind(AssertUnwindSafe(|| re.find_all(content)));
                match caught {
                    Ok(Ok(ms)) => Ok(ms
                        .into_iter()
                        .map(|m| ScanMatch { start: m.start, end: m.end })
                        .collect()),
                    Ok(Err(_)) => Err(()),
                    Err(_) => Err(()),
                }
            }
            CompiledRegex::Plain(re) => Ok(re
                .find_iter(content)
                .map(|m| ScanMatch { start: m.start(), end: m.end() })
                .collect()),
        }
    }

    // What:     `pub fn is_match(&self, content: &[u8]) -> Result<bool, ()>`
    //           is the short-circuit "any match anywhere" check. Used by
    //           the Combined residual shard's gate. Returns `Ok(true)` on
    //           a match, `Ok(false)` on a clean miss, and `Err(())` when
    //           the engine itself refuses to evaluate (resharp can return
    //           `Error::TooLarge` on pathological inputs).
    // Why:      Closes BUG 7: pre-fix the function folded engine errors
    //           into `false` via `unwrap_or(false)`, indistinguishable
    //           from a real "no match". For a secret-scanning tool that
    //           failure mode is fail-open -- a file the engine could not
    //           evaluate exits with zero hits, silently passing CI. Post-
    //           fix callers see the `Err` and emit a synthetic hit (or
    //           fall back to per-member evaluation when this is the gate
    //           of a multi-rule shard).
    // TS map:   `isMatch(content: Uint8Array): Result<boolean>`. TS has
    //           no Result; the equivalent would throw on engine error.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // isMatch(content: Uint8Array): { ok: true; value: boolean } | { ok: false } {
    //   if (this.kind === "resharp") {
    //     try { return { ok: true, value: this.re.isMatch(content) }; }
    //     catch { return { ok: false }; }
    //   }
    //   return { ok: true, value: this.re.isMatch(content) };
    // }
    // ```
    pub fn is_match(&self, content: &[u8]) -> Result<bool, ()> {
        match self {
            // What:     Same `catch_unwind(AssertUnwindSafe(...))`
            //           shape as `find_all`. `is_match` reuses the
            //           same resharp engine internals (lazy DFA),
            //           so the same `scan_fwd_*` panic surface is
            //           reachable from here -- on the gate path of
            //           a Combined residual shard, an `is_match` call
            //           against a content slice that trips resharp's
            //           assertion would abort the whole scanner
            //           process pre-fix. Post-fix it returns
            //           `Err(())`, and `scan.rs`'s existing
            //           `Err(()) => fall back to per-member find_all`
            //           branch handles the rest.
            // Why:      Symmetry with `find_all` -- any caller-
            //           visible engine surface must be unwind-safe
            //           or upstream panics escape the boundary.
            // TS map:   `try { return { ok: true, value: this.re.isMatch(content) }; } catch { return { ok: false }; }`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // try { return { ok: true, value: this.re.isMatch(content) }; }
            // catch { return { ok: false }; }
            // ```
            CompiledRegex::Resharp(re) => {
                let caught = catch_unwind(AssertUnwindSafe(|| re.is_match(content)));
                match caught {
                    Ok(Ok(v)) => Ok(v),
                    Ok(Err(_)) => Err(()),
                    Err(_) => Err(()),
                }
            }
            CompiledRegex::Plain(re) => Ok(re.is_match(content)),
        }
    }
}

// What:     `fn requires_resharp(src: &str) -> bool` returns `true` when
//           `src` contains any feature the `regex` crate cannot parse
//           OR would parse with semantics different from resharp's.
//           Three feature families trigger true:
//           1. Set-algebra operators: unescaped `&` or `~(` outside a
//              character class (resharp's intersection / complement).
//           2. Lookaround groups: `(?=`, `(?!`, `(?<=`, `(?<!`. The
//              `regex` crate rejects these with "look-around, including
//              look-ahead and look-behind, is not supported"; resharp
//              accepts them.
//           3. Bare `_` outside a character class. Resharp treats `_`
//              as a universal wildcard (matches any single character),
//              while the `regex` crate treats it as a literal underscore.
//              Routing a rule like `pre_post` to the `regex` crate
//              would silently change its meaning -- the rule author
//              wrote a wildcard pattern, the matcher searched for a
//              literal seven-byte string. Escaped (`\_`) and class-
//              internal `_` ([_], [A-Z_]) stay literal in both engines
//              and do not trigger this branch.
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
            if c == b'_' {
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
//           body holds an atom that resharp 0.5.x through 0.6.x cannot handle, and
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
                            "complement body contains \\b; resharp 0.5.x through 0.6.x rewrites it to an internal lookaround which the reverse pass refuses. Replace with \\W (consumes a char on each side) or literal whitespace, or move the boundary check outside the complement. {}",
                            TROUBLESHOOT_REF
                        ));
                    }
                    b'B' => {
                        return Some(format!(
                            "complement body contains \\B; resharp 0.5.x through 0.6.x rejects it at parse time when its neighbours are unclassifiable. Restructure the rule to avoid \\B inside the complement. {}",
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
                        "complement body contains ^; resharp 0.5.x through 0.6.x rewrites it to a lookbehind in default-multiline mode, which the reverse pass refuses. Use \\A for whole-content start-anchor semantics, or move the anchor outside the complement. {}",
                        TROUBLESHOOT_REF
                    ));
                }
                if c == b'$' {
                    return Some(format!(
                        "complement body contains $; resharp 0.5.x through 0.6.x rewrites it to a lookahead in default-multiline mode, which the reverse pass refuses. Use \\z for whole-content end-anchor semantics, or move the anchor outside the complement. {}",
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

// What:     `pub fn intersection_with_lookbehind(src: &str) -> Option<String>`
//           detects rule shapes that match resharp 0.5.x through 0.6.x's
//           lookahead-vs-lookbehind intersection debug_assert at
//           `resharp/src/engine.rs:1020` (`unexpected end 0 > N`,
//           where N varies by content length: 56 in 0.5.3, 1 in 0.6.0,
//           the assertion lives behind `debug_assert!` so release
//           returns corrupted matches silently instead). The minimal
//           reproducer is
//           `(?:(?=a)&(?<=_))` driven against a content slice of
//           at least 64 bytes; the panic fires inside
//           `scan_fwd_all` during the runtime forward scan, not
//           at compile. The detector reports the shape at
//           compile time so callers get an actionable error
//           BEFORE the rule reaches the scan path.
// Why:      Catch-and-convert via `catch_unwind` in
//           `CompiledRegex::find_all` already keeps the scanner
//           process alive; this pre-validator gives the rule
//           author a clean message ("intersection involving a
//           lookbehind") instead of a generic engine-error
//           synthetic hit. Bisection (see TROUBLESHOOTING.resharp.md)
//           narrowed the trigger to "intersection (`&` outside
//           class) where at least one operand contains a
//           lookbehind `(?<=` or `(?<!`". The two-lookahead
//           variant (`(?:(?=a)&(?=b))`) does not panic; it
//           returns `Algebra(UnsupportedPattern)` -- only the
//           lookbehind path hits the assertion. Detection is
//           conservative: any presence of intersection + any
//           lookbehind anywhere outside a class triggers; we
//           accept rare false positives on contrived shapes
//           (rule authors get a friendlier "rewrite without
//           intersecting a lookbehind" message instead of the
//           opaque assertion) in exchange for not having to walk
//           operand boundaries.
// TS map:   `function intersectionWithLookbehind(src: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function intersectionWithLookbehind(src: string): string | null {
//   // walk bytes outside character classes; set hasIntersection on
//   // bare `&`; set hasLookbehind on `(?<=` or `(?<!`. Return
//   // a reason when both are seen, null otherwise.
// }
// ```
pub fn intersection_with_lookbehind(src: &str) -> Option<String> {
    // What:     Single-pass walker: track `in_class` membership;
    //           on bare `&` outside class set `has_intersection`;
    //           on `(?=` / `(?!` / `(?<=` / `(?<!` outside class
    //           set `has_lookaround` and record the kind seen.
    //           Return early as soon as both are seen.
    // Why:      The original detector covered `&` + lookbehind only
    //           (the panic the user's HANDOVER bisected to).
    //           Subsequent fuzzer findings show resharp 0.5.x through
    //           0.6.x also panics on `&` + lookahead shapes via the
    //           same `engine.rs:1020` assertion. Widening keeps the
    //           detection symmetric across lookaround direction.
    //           Avoid the cost of a second pass; rule sources are
    //           short and a single linear scan is plenty.
    // TS map:   Same shape; one for-loop with two booleans.
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    let mut has_intersection = false;
    let mut has_lookaround = false;
    // What:     `lookaround_kind: &str` records which lookaround
    //           direction triggered the flag, used in the error
    //           message so the author can find the offending
    //           assertion / lookbehind quickly. "lookbehind" or
    //           "lookahead" -- whichever was seen first.
    // Why:      Diagnostic clarity. Without it the message is
    //           generic and the rule author has to scan the source
    //           to find which lookaround direction caused the
    //           rejection.
    // TS map:   `let lookaroundKind = "";`.
    let mut lookaround_kind: &'static str = "";
    while i < bytes.len() {
        let c = bytes[i];
        // What:     Escape sequence `\X` -- skip two bytes, do
        //           not interpret the second byte as a structural
        //           character.
        // Why:      `\&` and `\(` inside the source are literal
        //           bytes the regex parser treats as the actual
        //           character, not as the metacharacter.
        // TS map:   `if (c === 0x5c) { i += 2; continue; }`.
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
                has_intersection = true;
            }
            // What:     `(?=` / `(?!` / `(?<=` / `(?<!` lookaround
            //           detection. The `(?` prefix can start many
            //           constructs:
            //             - `(?=...)` positive lookahead
            //             - `(?!...)` negative lookahead
            //             - `(?<=...)` positive lookbehind
            //             - `(?<!...)` negative lookbehind
            //             - `(?<name>...)` named capture (NOT a lookaround)
            //             - `(?:...)`, `(?i)`, `(?P<name>` etc. (also not)
            //           The discriminator is the byte after `(?`:
            //             - `=` / `!` means lookahead
            //             - `<` followed by `=` / `!` means lookbehind
            //             - any other shape is not a lookaround
            // Why:      Catch both directions of lookaround. The
            //           debug_assert at `engine.rs:1020` fires for
            //           intersection involving any lookaround, not
            //           just lookbehind specifically.
            // TS map:   `if (c === '(' && b[i+1] === '?' && (b[i+2] === '=' || b[i+2] === '!' || (b[i+2] === '<' && (b[i+3] === '=' || b[i+3] === '!'))))`.
            if c == b'(' && i + 2 < bytes.len() && bytes[i + 1] == b'?' {
                let after = bytes[i + 2];
                if after == b'=' || after == b'!' {
                    has_lookaround = true;
                    if lookaround_kind.is_empty() {
                        lookaround_kind = "lookahead";
                    }
                } else if after == b'<'
                    && i + 3 < bytes.len()
                    && (bytes[i + 3] == b'=' || bytes[i + 3] == b'!')
                {
                    has_lookaround = true;
                    if lookaround_kind.is_empty() {
                        lookaround_kind = "lookbehind";
                    }
                }
            }
            if has_intersection && has_lookaround {
                return Some(format!(
                    "intersection (`&`) involving a {} triggers a known resharp 0.5.x through 0.6.3 soundness bug: the lookbehind-stripping rewrite `strip_lb` (`resharp-algebra/src/lib.rs:2007`) leaves the lookbehind in place, so release silently returns wrong matches (debug hits a `debug_assert!`). Rewrite the rule to lift the {} outside the intersection (e.g. anchor it as a prefix), or replace it with an explicit consume of the relevant byte. {}",
                    lookaround_kind, lookaround_kind, TROUBLESHOOT_REF
                ));
            }
        }
        i += 1;
    }
    None
}

// What:     `pub fn lookaround_in_alternation_with_sibling(src: &str) -> Option<String>`
//           detects rule shapes that compile through resharp's
//           parser but trigger the `engine.rs:1020` `debug_assert!`
//           (`unexpected end 0 > N`) at scan time. The minimal
//           reproducer bisected from
//           `fuzz/artifacts/fuzz_extract_gate_soundness/crash-8cba104f0805ccb567513aff895398a4f652200c`
//           is `(a|(?![_]))(?!a)` -- a capturing alternation whose
//           branches include a negative lookahead with a single-char
//           class body, followed by ANOTHER negative lookahead. The
//           pattern compiles (because alternation provides a
//           non-lookaround branch the algebra can simplify against)
//           but scanning panics during the forward DFA pass.
//
//           Variants confirmed to trigger the same panic:
//             - `(a|(?![_]))(?![a-e-u-vaaa])` (original artifact)
//             - `(?:a|(?![_]))(?!a)` (non-capturing first group)
//             - `((?![_])|a)(?!a)` (lookaround as first alt branch)
//             - `(a|(?![X]))(?!a)` for X in `_`, `0`, `.`, `-`, `|`, `^a`
//
//           Variants that do NOT trigger:
//             - `(a|(?!a))(?!a)` (bare atom in first lookahead, not class)
//             - `(a|(?![ab]))(?!a)` (class with two chars)
//             - `(?!a)(a|(?!a))` (lookaround before alternation, not after)
//             - `(?!a)b(?!c)` (atom between two lookaheads, no alt)
// Why:      `catch_unwind` in `CompiledRegex::find_all` already
//           converts the upstream panic into `Err(())` so production
//           scanning degrades gracefully. But libFuzzer-sys's panic
//           hook calls `abort()` before `catch_unwind` can intercept
//           in the fuzz harness, so the fuzz target sees a crash on
//           every iteration that hits this shape. The pre-validator
//           rejects the shape at compile time, surfacing an
//           actionable error and skipping the input so the fuzzer
//           can continue exploring the (?u)-Unicode space the
//           soundness-by-revert phase 11 verification needs.
//
//           Detection algorithm (single-pass byte walker):
//             - Maintain a stack of `(has_alternation, has_lookaround)`
//               flags, one entry per open paren. Each `(` pushes
//               `(false, false)`; each `)` pops the top entry.
//             - On `|` outside class, set top entry's
//               `has_alternation = true` (the alternation belongs
//               to the innermost group).
//             - On `(?=` / `(?!` / `(?<=` / `(?<!`, count
//               `total_lookarounds += 1` AND mark the CURRENT top
//               of the stack (the parent group containing this
//               lookaround) `has_lookaround = true` -- this models
//               "this group's body contains a lookaround". Push
//               `(false, false)` for the lookaround's own group
//               (its body is irrelevant for our pattern).
//             - On `)` pop: if the popped frame has BOTH
//               `has_alternation && has_lookaround` AND
//               `total_lookarounds >= 2` (there is another
//               lookaround outside this group), return Some(reason).
//           Conservative: false positives are acceptable. The
//           panicking shape is virtually never authored
//           intentionally; rule authors writing intersection-of-
//           lookaround patterns are rare, and the alternative is
//           a fuzz crash on every iteration.
// TS map:   `function lookaroundInAlternationWithSibling(src: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function lookaroundInAlternationWithSibling(src: string): string | null {
//   // walk bytes; maintain paren stack of (hasAlt, hasLookaround);
//   // track totalLookarounds. On `)` pop, check the combined
//   // pattern; return reason when matched.
// }
// ```
pub fn lookaround_in_alternation_with_sibling(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    // What:     `paren_stack: Vec<(bool, bool)>` per-open-paren flags.
    //           Each entry `(has_alternation, has_lookaround)`
    //           records two facts about the open group's body so
    //           far: "did we see a `|` at this depth" and "does
    //           this group's body contain at least one lookaround".
    // Why:      The panicking shape has alt+lookaround inside one
    //           group; we need per-depth tracking because flat
    //           counters would confuse "alternation in group A,
    //           lookaround in group B" with the real pattern
    //           "alternation AND lookaround both in group A".
    // TS map:   `const parenStack: Array<[boolean, boolean]> = [];`.
    let mut paren_stack: Vec<(bool, bool)> = Vec::new();
    // What:     `total_lookarounds: usize` counts every lookaround
    //           opening in the source, regardless of depth or
    //           position. Used in the final-check to know whether
    //           the alt+la group had a sibling lookaround anywhere
    //           else in the source.
    // Why:      The panicking shape always has TWO or more
    //           lookarounds in the source; one alone (even inside
    //           alternation) doesn't trigger.
    // TS map:   `let totalLookarounds = 0;`.
    let mut total_lookarounds: usize = 0;
    // What:     `found_alt_la_group: bool` is set when ANY closed
    //           group's body had both alternation and at least one
    //           lookaround. Sticky -- once set, stays set.
    // Why:      The sibling lookaround may appear AFTER the
    //           alt+la group closes (e.g. `(a|(?![_]))(?!a)`); we
    //           can't fire at close time because we don't yet
    //           know about future siblings. Tracking the flag and
    //           checking at the end of the walk handles both
    //           "sibling before" and "sibling after" symmetrically.
    // TS map:   `let foundAltLaGroup = false;`.
    let mut found_alt_la_group = false;
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
        if in_class {
            i += 1;
            continue;
        }
        // What:     Alternation `|` outside class. Marks the
        //           innermost open group as containing alternation.
        // Why:      Belongs to the innermost group; need per-depth
        //           tracking.
        if c == b'|' {
            if let Some(top) = paren_stack.last_mut() {
                top.0 = true;
            }
            i += 1;
            continue;
        }
        // What:     Group open `(`. Two cases:
        //           - Lookaround open `(?=`/`(?!`/`(?<=`/`(?<!`:
        //             count it, mark CURRENT top-of-stack as
        //             containing a lookaround, then push a fresh
        //             frame for the lookaround's own group body.
        //           - Other `(...)` (capturing, non-capturing, named,
        //             flags, comment): push a fresh frame.
        // Why:      The lookaround's PARENT group is the one
        //           containing it; the lookaround's own body is
        //           irrelevant for the pattern we're matching.
        if c == b'(' {
            let is_lookaround = i + 2 < bytes.len()
                && bytes[i + 1] == b'?'
                && (matches!(bytes[i + 2], b'=' | b'!')
                    || (bytes[i + 2] == b'<'
                        && i + 3 < bytes.len()
                        && matches!(bytes[i + 3], b'=' | b'!')));
            if is_lookaround {
                total_lookarounds += 1;
                if let Some(top) = paren_stack.last_mut() {
                    top.1 = true;
                }
            }
            paren_stack.push((false, false));
            i += 1;
            continue;
        }
        // What:     Group close `)`. Pop the top frame. If the
        //           popped frame had BOTH alternation AND at
        //           least one lookaround in its body, set the
        //           sticky `found_alt_la_group` flag. Also bubble
        //           the popped frame's has_lookaround up to the
        //           parent (a group contains a lookaround if any
        //           nested group did).
        // Why:      We defer the final fire-decision to end of
        //           walk because the sibling lookaround may appear
        //           AFTER the alt+la group closes. The bubble
        //           preserves the per-depth invariant: an outer
        //           group's body has a lookaround iff a nested
        //           subgroup body did.
        if c == b')' {
            let popped = paren_stack.pop().unwrap_or((false, false));
            if popped.0 && popped.1 {
                found_alt_la_group = true;
            }
            if popped.1 {
                if let Some(parent) = paren_stack.last_mut() {
                    parent.1 = true;
                }
            }
            i += 1;
            continue;
        }
        i += 1;
    }
    // What:     Final check: fire when any closed group had both
    //           alternation AND a lookaround in its body. The
    //           `total_lookarounds` counter is retained for debugging
    //           but is no longer required to gate the fire decision.
    // Why:      The original detector required `total_lookarounds >= 2`
    //           on the theory that the shape always has a sibling
    //           lookaround. Bisection of
    //           `crash-c3c364eb3a03114a52015721c02cba0bf20eb496` (rendered
    //           as `(?:        4qÃ¼Vk|o\w|\s(?![_]))23o:aaaaaaaaaaaaaaa`)
    //           showed that a SINGLE lookaround inside an alternation
    //           followed by literal content can also trip
    //           `engine.rs:1020` at find-all time in resharp 0.5.x to
    //           0.6.0 (fixed upstream in 0.6.x; this guard is now
    //           belt-and-suspenders). The
    //           threshold of 2 was an over-narrow heuristic from the
    //           first crash shape; widening to "any alt+la group"
    //           accepts a small false-positive rate in exchange for
    //           defense against the broader panic class.
    let _ = total_lookarounds;
    if found_alt_la_group {
        return Some(format!(
            "alternation containing a lookaround triggered a resharp 0.5.x to 0.6.0 debug_assert in the forward scan (`engine.rs:1020`; `unexpected end 0 > N`), now fixed upstream in 0.6.x; this rule is rejected conservatively (belt-and-suspenders), not to avoid a live crash. Minimal reproducers: `(a|(?![_]))(?!a)` and `(?:literal|other|x(?![_]))trailing`. Rewrite to remove the alternation, lift the lookaround outside, replace with an explicit byte consume, or split the rule into two separate patterns. {}",
            TROUBLESHOOT_REF
        ));
    }
    None
}

// What:     `pub fn intersection_with_word_end_alternation(src: &str) -> Option<String>`
//           detects rule shapes that match resharp 0.5.x through 0.6.x's
//           algebra arithmetic-overflow panic at
//           `resharp-algebra/src/lib.rs:2479`
//           (`attempt to add with overflow` inside
//           `attempt_rw_concat_2`; the `overflow-checks = true`
//           profile setting in our Cargo.toml is load-bearing for
//           this panic to fire in release). The minimum bisected
//           reproducer is `(?:\w|$)(?:(?![1g]\_X)& a)`: an
//           alternation containing both `\w` and the end-anchor
//           `$` concatenated with an intersection whose operand
//           contains a negative lookahead enclosing a character
//           class followed by additional literal bytes. The
//           overflow happens during DFA derivative construction,
//           reached from `Regex::new`.
// Why:      Bisection (see TROUBLESHOOTING.resharp.md) showed
//           the trigger is robust to the specific lookahead
//           class contents and the surrounding scoped-flag wrap.
//           The cheapest stable signal is "intersection (`&`
//           outside class) co-occurring with both `\w`
//           shorthand and `$` end-anchor (outside class) in the
//           same rule source". Real secret-detection rules
//           rarely combine all three -- they are either pure
//           literal-prefix patterns or simple character classes
//           -- so the false-positive rate is low. The catch_unwind
//           wrap in `compile_rule_src` is the load-bearing
//           safety net; this pre-validator turns the panic into
//           an actionable message for the common shape.
// TS map:   `function intersectionWithWordEndAlternation(src: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function intersectionWithWordEndAlternation(src: string): string | null {
//   // walk bytes outside character classes; flag `&` outside class,
//   // flag `\w`, flag `$`. Return reason when all three are present.
// }
// ```
pub fn intersection_with_word_end_alternation(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    let mut has_intersection = false;
    let mut has_word_shorthand = false;
    let mut has_end_anchor = false;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'\\' && i + 1 < bytes.len() {
            // What:     Detect `\w` (and `\W`) as the word
            //           shorthand. Inside a character class the
            //           same escape compiles to the byte-set
            //           definition rather than the alternation
            //           shape; the panic correlate appears only
            //           outside a class, so we gate on
            //           `!in_class`.
            // Why:      Match the shape we bisected to a panic.
            // TS map:   `if (b[i+1] === 'w' || b[i+1] === 'W')`.
            if !in_class && (bytes[i + 1] == b'w' || bytes[i + 1] == b'W') {
                has_word_shorthand = true;
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
            if c == b'&' {
                has_intersection = true;
            }
            if c == b'$' {
                has_end_anchor = true;
            }
            if has_intersection && has_word_shorthand && has_end_anchor {
                return Some(format!(
                    "intersection (`&`) co-occurring with `\\w` shorthand and `$` end-anchor triggers a known resharp 0.5.x through 0.6.x arithmetic-overflow panic in `attempt_rw_concat_2` (`resharp-algebra/src/lib.rs:2479`). Rewrite the rule to avoid this combination -- typically by replacing `\\w` with an explicit character class (`[A-Za-z0-9_]`) or by lifting the end-anchor outside the intersection. {}",
                    TROUBLESHOOT_REF
                ));
            }
        }
        i += 1;
    }
    None
}

// What:     `pub fn stacked_quantifier(src: &str) -> Option<String>`
//           detects two regex quantifier suffixes appearing back-to-back
//           without an atom or group between them: `a**`, `\D{5,11}{5,11}`,
//           `(?:a){2}{3}`, `a*?+`, `a*??`. Returns `Some(reason)` when the
//           shape is found and `None` otherwise.
// Why:      Stacked quantifiers expand multiplicatively in NFA-based
//           regex engines. The `regex` crate parses `a{5,11}{5,11}` as
//           "5-11 reps of (5-11 reps of `a`)" -- 25-121 reps -- and
//           five-deep stacking like the fuzz-discovered slow-unit
//           `\D{5,11}{5,11}{5,11}{5,11}{5,11}\D*****aa` reaches 5^5
//           through 11^5 (~161,051 reps). With `(?u)` widening `\D`
//           to the full non-decimal-digit Unicode class, NFA size
//           exceeds the crate's 256 MB limit and `RegexBuilder::build`
//           wall-clocks at 1.4-1.5 seconds before erroring with
//           `CompiledTooBig`. The plain path tries `unicode(false)`
//           first then `unicode(true)`, so the total compile call
//           takes ~2.9s -- well past libFuzzer's `report_slow_units`
//           threshold of 10s once ASAN overhead and the fuzz-corpus
//           replay loop are accounted for. The resharp parser rejects
//           stacked quantifiers in microseconds with
//           `UnsupportedResharpRegex`, but the slow-unit shape lacks
//           any `requires_resharp` trigger (no `&`, `_`, `~(`,
//           lookaround), so it never reaches resharp.
//
//           Stacked quantifiers are virtually never a legitimate
//           authored pattern: the regex crate accepts them by treating
//           the outer as a quantifier on the inner-quantified atom,
//           but no realistic secret-detection rule needs this shape.
//           Rejecting at the pre-validator level is conservative and
//           keeps the fuzz target moving past inputs that would
//           otherwise burn the entire budget on one compile attempt.
//
//           Detection runs as a single-pass byte walker over `src`
//           and skips:
//             - escape pairs `\X` (so `\{` is a literal `{`, not a
//               quantifier-brace start);
//             - character class interiors `[...]` (where the
//               metacharacters are literal bytes);
//             - the `?` byte immediately after `(` (so `(?:`, `(?i)`,
//               `(?<=`, `(?P<name>` are not counted as a `?`
//               quantifier).
//           A quantifier is recognised as one of `*`, `+`, `?`, or
//           `{` followed by an ASCII digit (so a literal `{abc}` is
//           NOT treated as a quantifier). After a primary quantifier,
//           a single trailing `?` (lazy) or `+` (possessive) modifier
//           is consumed as part of the same quantifier; a second
//           quantifier byte after that is the stacked case we flag.
//
//           Place the call BEFORE `requires_resharp` in
//           `compile_rule_src` so the rejection reads as "this
//           pattern is structurally bad", not "the plain path
//           specifically dislikes it". Either engine would either
//           reject the shape outright (resharp) or wall-clock on it
//           (regex crate); the structural rejection is the honest
//           framing.
// TS map:   `function stackedQuantifier(src: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function stackedQuantifier(src: string): string | null {
//   // walk bytes; track in_class and just_consumed_quant;
//   // skip \X escapes and class interiors and `(?` group prefixes;
//   // when a quantifier start is seen and just_consumed_quant is true,
//   // return Some(reason); otherwise consume the quantifier and any
//   // single trailing `?`/`+` modifier, set just_consumed_quant=true.
// }
// ```
pub fn stacked_quantifier(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    // What:     `just_consumed_quant` tracks whether the previous byte
    //           span consumed a full quantifier (`*`/`+`/`?`/`{N,M}`
    //           plus optional `?`/`+` modifier). The next quantifier
    //           start while this is `true` is the stacked case.
    //           Resets to `false` on any non-quantifier byte: a literal
    //           byte starts a fresh atom; `(`, `|`, `)`, anchors all
    //           re-anchor the parse state to "atom may follow".
    // Why:      The stacked-quantifier failure is exactly two
    //           quantifier suffixes back-to-back; the state-machine
    //           pinpoints that adjacency without parsing the regex.
    // TS map:   `let justConsumedQuant = false;`.
    let mut just_consumed_quant = false;
    while i < bytes.len() {
        let c = bytes[i];
        // What:     `if c == b'\\' { i += 2; ... }` skips the escape
        //           pair. `\{`, `\}`, `\*`, `\+`, `\?` are all literal
        //           bytes, NOT quantifier starts. Resetting
        //           `just_consumed_quant = false` is correct: the
        //           escape pair represents an atom (a single
        //           literal/shorthand), so a quantifier may follow it
        //           but the escape itself is not a quantifier.
        // Why:      Without this skip, `\{` would be mis-detected as a
        //           bounded-quantifier start and the algorithm would
        //           walk past the `}` of a literal byte sequence.
        // TS map:   `if (c === 0x5c) { i += 2; justConsumedQuant = false; continue; }`.
        if c == b'\\' {
            i += 2;
            just_consumed_quant = false;
            continue;
        }
        // What:     Character class entry / exit. Inside a class,
        //           `*`/`+`/`?`/`{` are literal bytes; we don't
        //           reason about quantifiers there.
        // Why:      `[*+?{]` is a five-byte literal class, not five
        //           stacked quantifiers.
        // TS map:   `if (!inClass && c === 0x5b) { inClass = true; ... }`.
        if !in_class && c == b'[' {
            in_class = true;
            just_consumed_quant = false;
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
        // What:     `(?` group prefix. The `?` is part of the group
        //           syntax (non-capturing `(?:`, inline flags `(?i)`,
        //           lookarounds `(?=`/`(?!`/`(?<=`/`(?<!`, named
        //           captures `(?P<name>`/`(?<name>`, comments
        //           `(?#...)`). Skipping the two bytes prevents the
        //           `?` from being misread as a `?` quantifier on the
        //           preceding atom -- which it is not, because the
        //           preceding atom is `(`, which starts a new
        //           sub-expression rather than ending one.
        // Why:      Without the skip, `(?:a)*` would parse as
        //           "open-paren, lazy-quantifier-on-open-paren, ..."
        //           which is structurally wrong and would falsely flag
        //           any `(?:...){...}` shape as stacked.
        // TS map:   `if (c === 0x28 && b[i+1] === 0x3f) { i += 2; ... }`.
        if c == b'(' && i + 1 < bytes.len() && bytes[i + 1] == b'?' {
            i += 2;
            just_consumed_quant = false;
            continue;
        }
        // What:     Recognise a quantifier start. `{` is only a
        //           quantifier start if followed by an ASCII digit;
        //           otherwise it is a literal `{` (e.g. `{abc}` is
        //           treated as the four literal bytes `{abc}` by the
        //           regex crate when the contents do not parse as a
        //           repetition spec).
        // Why:      The fuzz generator never emits literal `{` outside
        //           a class, but real rules sometimes do (e.g. JSON-
        //           shaped literals like `{"key":`). Requiring the
        //           digit lookahead keeps the algorithm well-defined
        //           on real inputs.
        // TS map:   `const isQuant = c === 0x2a || c === 0x2b || c === 0x3f || (c === 0x7b && isDigit(b[i+1]));`.
        let is_quant_start = matches!(c, b'*' | b'+' | b'?')
            || (c == b'{'
                && i + 1 < bytes.len()
                && bytes[i + 1].is_ascii_digit());
        if is_quant_start {
            if just_consumed_quant {
                return Some(format!(
                    "stacked quantifier at byte offset {}: `{}` follows another quantifier suffix. Stacked quantifiers (e.g. `a**`, `\\D{{5,11}}{{5,11}}`, `(?:a){{2}}{{3}}`) cause NFA size explosion in the `regex` crate (compile reaches the 256 MB DFA limit before erroring) and are rejected outright by resharp's parser. Group the inner quantified atom and apply at most one quantifier per level, or rewrite to a single bounded-or-unbounded repetition.",
                    i, c as char
                ));
            }
            // What:     Consume the quantifier. For `{N}` / `{N,}` /
            //           `{N,M}` we walk to the matching `}`; for the
            //           single-byte `*`/`+`/`?` we just advance one.
            //           Then absorb an optional lazy `?` or possessive
            //           `+` modifier so `a*?` is NOT counted as two
            //           stacked quantifiers (it is one lazy `*`).
            // Why:      The lazy/possessive modifier is part of the
            //           same quantifier in regex syntax. Treating it
            //           as a separate quantifier would false-positive
            //           every lazy quantifier in the corpus.
            // TS map:   `if (c === 0x7b) { while (i < len && b[i] !== 0x7d) i++; if (i < len) i++; } else { i++; }`.
            if c == b'{' {
                while i < bytes.len() && bytes[i] != b'}' {
                    i += 1;
                }
                if i < bytes.len() {
                    i += 1;
                }
            } else {
                i += 1;
            }
            // What:     Optional `?` lazy modifier suffix. The regex
            //           crate does NOT support possessive `+`
            //           modifier (e.g. `a*+`, `a++`); the trailing
            //           `+` always represents a fresh quantifier on
            //           the previously-quantified atom and is
            //           therefore stacked.
            // Why:      `a*?` is a complete lazy quantifier; the `?`
            //           is part of it. A SECOND `?` (so `a*??`) is
            //           the stacked case, caught on the next
            //           iteration. `a*+` is treated as `*` followed
            //           by stacked `+`, the same way the regex crate
            //           parses it.
            if i < bytes.len() && bytes[i] == b'?' {
                i += 1;
            }
            just_consumed_quant = true;
            continue;
        }
        // What:     Any other byte (atom, anchor, `(`, `)`, `|`, ...)
        //           resets `just_consumed_quant` to `false`. A
        //           quantifier may follow this byte but the byte
        //           itself is not a quantifier suffix.
        // Why:      Re-anchor the state machine to "atom may now be
        //           quantified". `(a)*` is fine: `(` starts a group,
        //           `)` closes it (group becomes an atom), `*`
        //           quantifies the group; only ONE quantifier follows
        //           the group close.
        i += 1;
        just_consumed_quant = false;
    }
    None
}

// What:     `pub fn complement_intersection_quantified_group(src: &str) -> Option<String>`
//           detects rule shapes that cause resharp's algebra
//           simplification to hang for tens of seconds or
//           indefinitely. The name is historical -- the original
//           bisect targeted `<prefix>~(\w)&(?:aaa)*`, but a second
//           fuzz timeout
//           (`timeout-0815a95346bfa16ae0c6454162d9af0b8c05779c`,
//           shape `(?i) ###(?:\s&üü)(?:####)+#@...`) showed the
//           hang also fires WITHOUT a `~(` complement -- bare
//           intersection (`&`) co-occurring with a quantified
//           group (`)*`/`)+`/etc.) is sufficient. The detector now
//           checks only those two co-occurrence triggers; the
//           complement check is omitted. The original bisect
//           reproducer from
//           `timeout-00179d433e26fbcc3bedf2b7b38b6ce1ff9e6438` was
//           `abc~(\w)&(?:aaa)*`. The compile call to resharp's
//           `Regex::new` does not terminate within libFuzzer's
//           10s per-input timeout.
//
//           Shapes confirmed to hang (>5s each via probe bisection):
//             - `abc~(\w)&(?:aaa)*`
//             - `xyz~(\w)&(?:aaaaaaaaaaaaa)*`
//             - `[_]ñe-XM1[^42v]~(\w)&(?:aaaaaaaaaaaaa)*` (original artifact)
//             - `(?:[^a]~(\w)&(?:aaaaaaaaaaaaa)*)` (with negated-class prefix)
//
//           Shapes that compile in milliseconds:
//             - `~(\w)&(?:a)*` (no prefix)
//             - `abc~(\w)&def` (no quantified group)
//             - `(?:abc~(\w)&(?:aaa)*)` (wrapped in single outer group)
//             - `x~(\w)&(?:a)*` (1-char prefix and 1-char quantified body)
//
//           Root cause traced via gdb-attach to a hung probe plus
//           reading the cloned resharp source: the hang is in
//           `resharp::prefix::calc_prefix_sets_inner` at
//           `resharp-engine/src/prefix.rs:27`. The function walks a
//           chain of regex derivatives in a `loop { ... }` searching
//           for a fixed prefix, but its `redundant` set only ever
//           holds the original `start` node and `NodeId::BOT` --
//           freshly visited nodes are never added back. For the
//           trigger shape `<prefix>~(\w)&(?:aaa)*`, the derivative
//           chain produces a sequence of unique single-target
//           nodes indefinitely (each `der` step rotates the
//           star+intersection state but never lands back on `start`
//           or `BOT`), so the loop runs without bound. The shape
//           `(?:<prefix>~(\w)&(?:aaa)*)` wrapped in a group skips
//           the slow path because the outer non-capturing group
//           changes the simplified node form that enters
//           `select_prefix`, making the derivative chain visit
//           `BOT` early. Documented as Bug E in
//           TROUBLESHOOTING.resharp.md; prototyped and folded into the
//           merged upstream issue (`resharp-merged-issue.md`), not yet filed.
//
//           The pre-validator uses a coarse structural heuristic:
//           "source contains a complement (`~(`), intersection
//           (`&`), AND a quantified group (`)*`, `)+`, `)?`,
//           `){...}`) outside character classes". This is
//           conservative: it would flag the OK cases above too.
//           That trade-off is acceptable because:
//             1. The production rule corpus contains zero rules
//                with both `&` and `~(` (intersection requires
//                resharp set-algebra, which is virtually never
//                authored by humans; the only `&` in the example
//                betterleaks config is inside character classes or
//                as `&amp;` HTML-escape literals).
//             2. The fuzz target only authors these shapes
//                accidentally via the structured generator; it
//                never needs them to discover the real bugs.
//             3. The cost of a false positive is "skip this rule
//                and continue"; the cost of a missed hang is
//                "libFuzzer reports a timeout and halts the run",
//                which blocks progress entirely.
// Why:      catch_unwind protects against panics but not against
//           non-termination. resharp does not expose a compile
//           timeout, and we can't safely cancel a running compile
//           from outside. The pre-validator is the only safe way
//           to skip the slow shapes without modifying resharp.
//           Upstream fix would be adding `redundant.insert(node);`
//           on each loop iteration in `calc_prefix_sets_inner`
//           so the visited-set actually accumulates across the walk.
// TS map:   `function complementIntersectionQuantifiedGroup(src: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function complementIntersectionQuantifiedGroup(src: string): string | null {
//   // walk bytes outside character classes; set hasComplement on `~(`,
//   // set hasIntersection on `&`, set hasQuantifiedGroup on `)` followed
//   // by `*`/`+`/`?`/`{N`. Return reason when all three are present.
// }
// ```
pub fn complement_intersection_quantified_group(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    let mut has_intersection = false;
    let mut has_quantified_group = false;
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
                has_intersection = true;
            }
            // What:     `)` followed by `*`/`+`/`?`/`{N` is a
            //           quantified group close. Same recognition
            //           rule used by `nested_grouped_quantifier`.
            // Why:      The trigger shape needs the quantified
            //           group; bare `)` not followed by a
            //           quantifier doesn't reproduce the hang.
            if c == b')' && i + 1 < bytes.len() {
                let next = bytes[i + 1];
                if matches!(next, b'*' | b'+' | b'?')
                    || (next == b'{'
                        && i + 2 < bytes.len()
                        && bytes[i + 2].is_ascii_digit())
                {
                    has_quantified_group = true;
                }
            }
            if has_intersection && has_quantified_group {
                return Some(format!(
                    "intersection (`&`) co-occurring with a quantified group (`(...)`*/+/?/{{N}}) triggers a known resharp 0.5.x through 0.6.x prefix-loop non-termination during `Regex::new` (see TROUBLESHOOTING.resharp.md Bug E -- `calc_prefix_sets_inner` lacks a visited-set update on each iteration). The compile does not terminate within libFuzzer's per-input timeout. Reproducers: `abc~(\\w)&(?:aaa)*` and `(?i) ###(?:\\s&üü)(?:####)+...`. Rewrite the rule to inline the quantified group's body into the intersection operand, or remove one of the two operators. {}",
                    TROUBLESHOOT_REF
                ));
            }
        }
        i += 1;
    }
    None
}

// What:     `pub fn nested_lookahead_in_quantified_group(src: &str) -> Option<String>`
//           detects rule shapes that trigger a `attempt to add with
//           overflow` panic at `resharp-algebra/src/lib.rs:2479`
//           during `Regex::new`. The panicked addition is
//           `tail_rel + la_rel` where both operands are `u32`; the
//           inner `tail_rel` saturates to `u32::MAX` on the previous
//           lookahead-chain step, and the next add overflows under
//           debug assertions. cargo-fuzz keeps debug-assertions on
//           even in `--release`, so the fuzz target observes the
//           panic that production (built with debug-assertions OFF)
//           would silently wrap to 0.
//
//           Shapes confirmed to PANIC (bisected via probe binaries
//           in `/tmp/probe-slow-unit/src/bin/bisect_f*.rs`):
//             - `(?:(?:(?!\?)){1,5}){2,4}` (base case)
//             - `(?:(?:(?!\?)){1,5}){2,2}` (outer min=max=2)
//             - `(?:(?!\?){1,2}){3}` (single wrap, outer min=3)
//             - `(?:(?:(?:(?!\?)){1,5}){1,3}){2,4}` (triple nest)
//             - `(?:(?:(?:(?!\?)){1,5}){2,3}){1,4}` (middle min=2)
//             - `(?:(?=a)(?:(?!\?)){1,5}){2,4}` (sibling lookahead)
//             - positive lookahead `(?=...)` also panics
//
//           Shapes that compile OK (no panic):
//             - `(?:(?:(?!\?)){1,5}){1,5}` (outer min=1)
//             - `(?:(?!\?)){2,4}` (single wrap, no inner quant)
//             - `(?:a(?:(?!\?)){1,5}){2,4}` (literal sibling content)
//             - `(?:(?:(?!\?)){1,5}a){2,4}` (literal trailing)
//             - `(?:(?:(?!\?)){1,5}|a){2,4}` (alternation sibling)
//             - lookbehinds `(?<=...)`/`(?<!...)` -- resharp returns
//               UnsupportedPattern before reaching the overflow path
//
//           Detection criterion (single-pass byte walker with a
//           paren-frame stack):
//             - At each `)`, parse the following quantifier (if any)
//               and read its minimum repetition count. For `{n,m}` /
//               `{n}` use `n`; for `*` use 0; for `+` use 1; for `?`
//               use 0.
//             - Maintain a Frame per open group tracking:
//               (a) is_lookahead_self -- this group opened with `(?!`
//                   or `(?=`;
//               (b) has_lookahead_subtree -- a descendant frame was a
//                   lookahead (propagated up on close);
//               (c) has_inner_quant_group -- a child group was
//                   quantified (propagated up on close);
//               (d) has_non_group_atom -- a literal / escape / class /
//                   anchor byte appeared AT THIS DEPTH;
//               (e) has_alternation -- a `|` appeared at this depth.
//             - On close, fire if ALL hold:
//                 quantifier present AND min >= 2 AND
//                 (is_lookahead_self OR has_lookahead_subtree) AND
//                 has_inner_quant_group AND
//                 !has_non_group_atom AND !has_alternation.
//             - The `!has_non_group_atom` and `!has_alternation`
//               clauses prevent false positives on the literal-sibling
//               and alternation shapes that resharp handles fine: a
//               concrete sibling breaks the lookahead derivative
//               chain so the `rel` never saturates.
// Why:      Without this pre-validator the panic propagates through
//           `catch_unwind` (libfuzzer's panic hook calls `abort`
//           before our catch_unwind can intercept), libFuzzer
//           records a deadly-signal crash, and the fuzz run halts
//           before reaching the soundness-by-revert phase 11. The
//           fuzz target ran into two such crashes in the worktree:
//           `crash-06d9dd9fa1abfeec72a8154c09434b237dfc7f38` and
//           `crash-df95fcd52de76d952ee3db291f59434ece2c0b81`. Both
//           decode to a quantified group containing a lookahead
//           inside another quantified group, with the outer
//           quantifier's min >= 2. Documented as Bug F in
//           TROUBLESHOOTING.resharp.md; prototyped (shared saturating_add
//           with Bug C) and folded into the merged upstream issue
//           (`resharp-merged-issue.md`), not yet filed.
// TS map:   `function nestedLookaheadInQuantifiedGroup(src: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function nestedLookaheadInQuantifiedGroup(src: string): string | null {
//   // walk bytes; maintain a stack of frames per open paren;
//   // mark is_lookahead_self when the open is `(?!` / `(?=`;
//   // on close, parse the trailing quantifier's min;
//   // fire if quant min >= 2 and the frame had a lookahead in subtree
//   // and a quantified child group and no atoms / alternations at depth.
// }
// ```
pub fn nested_lookahead_in_quantified_group(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    // What:     `struct Frame { ... }`. One per open group; pushed at
    //           `(`, popped at `)`. Tracks the structural facts needed
    //           to decide whether the group's quantifier completes a
    //           Bug F shape.
    // Why:      Bug F requires a SPECIFIC nested structure -- a
    //           single-element body that is itself a quantified group
    //           containing a lookahead. Per-frame flags let us reject
    //           shapes that look superficially similar but have
    //           sibling literals / alternations that break the chain.
    #[derive(Default, Clone)]
    struct Frame {
        is_lookahead_self: bool,
        has_lookahead_subtree: bool,
        has_inner_quant_group: bool,
        has_non_group_atom: bool,
        has_alternation: bool,
    }
    let mut stack: Vec<Frame> = Vec::new();
    while i < bytes.len() {
        let c = bytes[i];
        // What:     Escape `\X`: skip both bytes; the escape is one atom
        //           AT THIS DEPTH so the parent frame records "has
        //           non-group atom" -- this rules out the sibling-
        //           literal false positive `(?:\a(?:(?!\?)){1,5}){2,4}`.
        // Why:      `\)` would otherwise be misread as a close;
        //           `\(` would be misread as an open; either would
        //           corrupt the frame stack.
        if c == b'\\' {
            if let Some(top) = stack.last_mut() {
                top.has_non_group_atom = true;
            }
            i += 2;
            continue;
        }
        // What:     `[`: enter character class. The class is an atom at
        //           this depth.
        // Why:      `[)]` shouldn't pop a frame; bytes inside `[...]`
        //           are literal.
        if !in_class && c == b'[' {
            if let Some(top) = stack.last_mut() {
                top.has_non_group_atom = true;
            }
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
        // What:     `(`: open a new frame. Detect `(?!` or `(?=` lookahead
        //           openers (lookbehind `(?<!` / `(?<=` are also detected
        //           but do not set is_lookahead_self -- they don't reach
        //           the overflow path; resharp returns UnsupportedPattern
        //           on lookbehind plus a quantifier). The group prefix
        //           bytes `?...` are skipped here so the body walk
        //           doesn't misread `?` as a quantifier or `:` / `=` /
        //           `!` as alternation / atom.
        if c == b'(' {
            let is_lookahead = i + 2 < bytes.len()
                && bytes[i + 1] == b'?'
                && (bytes[i + 2] == b'!' || bytes[i + 2] == b'=');
            let frame = Frame {
                is_lookahead_self: is_lookahead,
                ..Frame::default()
            };
            stack.push(frame);
            i += 1;
            if i < bytes.len() && bytes[i] == b'?' {
                i += 1;
                if i < bytes.len()
                    && matches!(bytes[i], b':' | b'!' | b'=' | b'<' | b'P' | b'i' | b'x' | b'u' | b'-' | b's' | b'm' | b'a' | b'R')
                {
                    // What:     Consume the group prefix character (e.g.
                    //           `:` in `(?:`, `!` in `(?!`, `=` in
                    //           `(?=`, `<` in `(?<!` / `(?<=` / `(?<name>`,
                    //           flag chars in `(?i)`/`(?x:`/etc., `-`
                    //           in `(?-i:`).
                    // Why:      Without this skip the body walk would
                    //           interpret these bytes as literals,
                    //           incorrectly setting has_non_group_atom.
                    i += 1;
                    // What:     Lookbehind `(?<=` / `(?<!` needs one
                    //           more byte consumed.
                    if bytes[i - 1] == b'<'
                        && i < bytes.len()
                        && (bytes[i] == b'=' || bytes[i] == b'!')
                    {
                        i += 1;
                    }
                }
            }
            continue;
        }
        // What:     `)`: close the current frame. Parse the trailing
        //           quantifier (if any); decide whether to fire; then
        //           propagate transient flags to the parent.
        // Why:      The fire check sees the COMPLETE subtree state for
        //           this group, before propagation collapses it into
        //           the parent.
        if c == b')' {
            i += 1;
            let frame = stack.pop().unwrap_or_default();
            let mut quant_min: u32 = 0;
            let mut is_quantified = false;
            if i < bytes.len() {
                match bytes[i] {
                    b'*' => {
                        quant_min = 0;
                        is_quantified = true;
                        i += 1;
                    }
                    b'+' => {
                        quant_min = 1;
                        is_quantified = true;
                        i += 1;
                    }
                    b'?' => {
                        quant_min = 0;
                        is_quantified = true;
                        i += 1;
                    }
                    b'{' => {
                        let mut j = i + 1;
                        let num_start = j;
                        while j < bytes.len() && bytes[j].is_ascii_digit() {
                            j += 1;
                        }
                        if j > num_start {
                            let num_str = std::str::from_utf8(&bytes[num_start..j]).unwrap_or("0");
                            quant_min = num_str.parse().unwrap_or(0);
                            while j < bytes.len() && bytes[j] != b'}' {
                                j += 1;
                            }
                            if j < bytes.len() {
                                is_quantified = true;
                                j += 1;
                            }
                        }
                        i = j;
                    }
                    _ => {}
                }
                if is_quantified && i < bytes.len() && bytes[i] == b'?' {
                    i += 1;
                }
            }

            let has_la_in_subtree = frame.is_lookahead_self || frame.has_lookahead_subtree;

            if is_quantified
                && quant_min >= 2
                && has_la_in_subtree
                && frame.has_inner_quant_group
                && !frame.has_non_group_atom
                && !frame.has_alternation
            {
                return Some(format!(
                    "nested lookahead inside a quantified group with outer quantifier min >= 2 (e.g. `(?:(?:(?!X)){{1,5}}){{2,4}}`) triggers a known resharp 0.5.x through 0.6.x algebra-overflow panic during `Regex::new` (see TROUBLESHOOTING.resharp.md Bug F -- `attempt to add with overflow` at `resharp-algebra/src/lib.rs:2479`; the lookahead-chain `rel` length saturates to u32::MAX and the next add overflows under debug assertions). Production builds without debug-assertions silently wrap to 0 (likely producing wrong matches). Reproducers: `(?:(?:(?!\\?)){{1,5}}){{2,4}}` and `(?:(?!\\?){{1,2}}){{3}}`. Either lower the outer quantifier's min below 2, drop the inner quantifier wrap, or insert a literal / alt sibling alongside the lookahead-bearing inner group. {}",
                    TROUBLESHOOT_REF
                ));
            }

            if let Some(parent) = stack.last_mut() {
                if has_la_in_subtree {
                    parent.has_lookahead_subtree = true;
                }
                if is_quantified || frame.has_inner_quant_group {
                    parent.has_inner_quant_group = true;
                }
            }
            continue;
        }
        // What:     `|` at this depth: top-level alternation. Marks the
        //           frame so the fire condition can rule out sibling-
        //           alt false positives like
        //           `(?:(?:(?!\?)){1,5}|a){2,4}`.
        if c == b'|' {
            if let Some(top) = stack.last_mut() {
                top.has_alternation = true;
            }
            i += 1;
            continue;
        }
        // What:     Any other byte (literal, anchor, dot, etc.) is an
        //           atom at the current depth. The flag rules out the
        //           sibling-literal false positives.
        if let Some(top) = stack.last_mut() {
            top.has_non_group_atom = true;
        }
        i += 1;
    }
    None
}

// What:     `pub fn quantified_lookahead_with_sibling_content(src: &str) -> Option<String>`
//           detects a second Bug F shape that the narrower
//           `nested_lookahead_in_quantified_group` misses: a
//           variable-bound-quantified lookahead-bearing group
//           followed by exactly 1 or 2 trailing atoms at parent
//           depth. Bisected from a fuzz crash where
//           `crash-a219859099426658d70e90bc97f560b85f2cf256` decoded
//           to `... (?:(?!ñññAtsöéaañ)){4,12}~(ññM aaaaaaaa)aaaaaa`
//           and minimised to `(?:(?!abc)){4,12}a`.
//
//           PANIC shapes (probes in
//           `/tmp/probe-slow-unit/src/bin/bisect_f{7,8}.rs`):
//             - `(?:(?!abc)){4,12}a` (variable quant + 1 trailing atom)
//             - `(?:(?!abc)){4,12}aa` (variable quant + 2 trailing atoms)
//             - `(?:(?!abc)){4,12}\?` (escape trail counts as 1 atom)
//             - `(?:(?!abc)){4,12}(?:d)` (group trail counts as 1 atom)
//             - `(?:(?!abc)){4,12}[d]` (class trail counts as 1 atom)
//             - `(?:(?!abc)){2,3}a` / `{4,5}a` / `{1,4}a` (any variable bound)
//             - `(?!abc){4,12}a` (bare lookahead, no `(?:)` wrap)
//             - `a(?:(?!abc)){4,12}a` (leading content does not save it)
//
//           OK shapes (validator does NOT fire -- they compile cleanly
//           upstream):
//             - `(?:(?!abc)){4,12}` alone (no trailing)
//             - `a(?:(?!abc)){4,12}` (leading only, no trailing)
//             - `(?:(?!abc)){4,12}aaa` and longer (3+ trailing atoms
//               break the upstream chain -- the derivative builder
//               consumes them before reaching the saturating add)
//             - `(?:(?!abc)){2}a` / `{3}a` / `{4}a` (EXACT quant `{n}`
//               -- no variable bound, no overflow accumulation)
//             - `(?:(?!abc)){4,12}\d{3,5}` (the 3+ trailing rule
//               applies if the count >= 3; trailing groups count as
//               1 atom each regardless of inner repetition)
//
//           Detection rule (precise, derived from bisect data, no
//           accepted false positives):
//             - On `)` close, parse the trailing quantifier and
//               record whether the bound is VARIABLE (`{m,n}` with m
//               < n, including `*`/`+`/`?` which are `{0,inf}` /
//               `{1,inf}` / `{0,1}`). EXACT `{n}` quants do not arm.
//             - If the closing frame had a lookahead in its subtree
//               AND the quantifier is variable, set the parent's
//               `pending_trailing_count` to 0 (armed, counting).
//             - Each subsequent atom at parent depth (literal byte,
//               escape `\X`, char class `[...]`, group `(...)`,
//               anchor) increments `pending_trailing_count`.
//             - Fire when the count is 1 or 2 AND we reach a
//               structural boundary that confirms the trailing
//               window is closed (end-of-regex, `|`, or the parent
//               `)`).
//             - If the count reaches 3 before any boundary, disarm
//               (the upstream chain breaks at 3+ atoms).
//             - `|` and the parent close also disarm if we hadn't
//               fired yet, OR fire if the trailing count is 1-2 at
//               that boundary.
//
//           This precise rule has no accepted false positives:
//           rejecting only shapes that actually panic upstream.
//           Earlier broader widening (which also rejected
//           `(?:(?!X)){n}<atom>` exact-quant and
//           `(?:(?!X)){m,n}aaa` long-trail shapes) was tightened
//           after the user flagged that production rules might
//           legitimately use those shapes. See
//           HANDOVER.forbidden-strings-fuzzing.md.
// Why:      `nested_lookahead_in_quantified_group` only catches the
//           DOUBLE-quantified nesting (`(?:(?:(?!X)){m,n}){p,q}`). The
//           SINGLE-quantified-with-1-or-2-trailing shape reaches the
//           same overflow path in `resharp-algebra/src/lib.rs:2479`
//           but through a different upstream code path -- the
//           trailing content feeds into the lookahead-chain
//           derivative without an intermediate `Quant` wrap, and the
//           `tail_rel` saturates identically. Without this
//           pre-validator the fuzz target catches the panic via
//           `catch_unwind` only on lucky builds; libfuzzer's panic
//           hook calls `abort` first on most, halting the run.
// TS map:   `function quantifiedLookaheadWithSiblingContent(src: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function quantifiedLookaheadWithSiblingContent(src: string): string | null {
//   // walk bytes; per-frame `pendingTrailingCount` -1 = unarmed,
//   // 0+ = counting; arm on close of a quantified-LA group iff the
//   // quant is variable-bound; increment per atom at parent depth;
//   // fire on boundary (eof / `|` / parent `)`) if count is 1 or 2;
//   // disarm if count reaches 3.
// }
// ```
pub fn quantified_lookahead_with_sibling_content(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    // What:     `struct Frame { ... }`. One per open group; pushed at
    //           `(`, popped at `)`. The top entry represents the
    //           implicit top-level frame so trailing content at the
    //           regex root also fires.
    // Why:      `pending_trailing_count` is the per-frame "armed and
    //           counting" cursor. `-1` means unarmed; `0+` means
    //           counting trailing atoms after a quantified-LA close.
    //           Tracking it per-frame supports nested usage like
    //           `((?:(?!X)){4,12}a)` (the outer frame counts the
    //           trailing `a` if the parent itself is armed).
    #[derive(Default, Clone)]
    struct Frame {
        is_lookahead_self: bool,
        has_lookahead_subtree: bool,
        pending_trailing_count: i32,
    }
    let mut stack: Vec<Frame> = vec![Frame {
        is_lookahead_self: false,
        has_lookahead_subtree: false,
        pending_trailing_count: -1,
    }];
    // What:     `fire_reason()` returns the diagnostic string. Wrapped
    //           in a helper because three call sites (escape, class,
    //           group-open, alternation-boundary, eof-boundary,
    //           parent-close-boundary, literal-byte) all emit the
    //           same payload.
    // Why:      Keep the rejection message centralised so a future
    //           tweak doesn't drift across call sites.
    fn fire_reason() -> String {
        format!(
            "quantified lookahead-bearing group with variable bound `{{m,n}}` and 1-2 trailing atoms at parent depth (e.g. `(?:(?!X)){{m,n}}<atom>` or `(?:(?!X)){{m,n}}<atom><atom>`) triggers a resharp 0.5.x through 0.6.x `attempt to add with overflow` panic at `resharp-algebra/src/lib.rs:2479` (see TROUBLESHOOTING.resharp.md Bug F). The lookahead-chain `rel` saturates to u32::MAX and the next add overflows under debug assertions; production builds without debug-assertions silently wrap to 0 (likely producing wrong matches). Reproducer: `(?:(?!abc)){{4,12}}a`. Workarounds: (a) extend the trailing content to 3 or more atoms (`...{{4,12}}aaa`), (b) use an EXACT quantifier `(?:(?!X)){{n}}<atom>` (single-bound), or (c) split the regex. {}",
            TROUBLESHOOT_REF
        )
    }
    while i < bytes.len() {
        let c = bytes[i];
        // What:     Inside a character class: consume literally until
        //           `]`. The class as a whole was already counted as
        //           one atom when `[` was seen.
        if in_class {
            if c == b']' {
                in_class = false;
            }
            i += 1;
            continue;
        }
        // What:     `\X`: escape. One atom at the current depth.
        if c == b'\\' {
            if let Some(top) = stack.last_mut() {
                if top.pending_trailing_count >= 0 {
                    top.pending_trailing_count += 1;
                    if top.pending_trailing_count >= 3 {
                        top.pending_trailing_count = -1;
                    }
                }
            }
            i += 2;
            continue;
        }
        // What:     `[`: character class open. One atom; the class
        //           body is consumed in the `in_class` branch.
        if c == b'[' {
            if let Some(top) = stack.last_mut() {
                if top.pending_trailing_count >= 0 {
                    top.pending_trailing_count += 1;
                    if top.pending_trailing_count >= 3 {
                        top.pending_trailing_count = -1;
                    }
                }
            }
            in_class = true;
            i += 1;
            continue;
        }
        // What:     `(`: group open. Counts as one atom at parent
        //           depth (regardless of what's inside; the group is
        //           atomic from the trailing-count perspective).
        if c == b'(' {
            if let Some(top) = stack.last_mut() {
                if top.pending_trailing_count >= 0 {
                    top.pending_trailing_count += 1;
                    if top.pending_trailing_count >= 3 {
                        top.pending_trailing_count = -1;
                    }
                }
            }
            let is_lookahead = i + 2 < bytes.len()
                && bytes[i + 1] == b'?'
                && (bytes[i + 2] == b'!' || bytes[i + 2] == b'=');
            stack.push(Frame {
                is_lookahead_self: is_lookahead,
                has_lookahead_subtree: false,
                pending_trailing_count: -1,
            });
            i += 1;
            if i < bytes.len() && bytes[i] == b'?' {
                i += 1;
                if i < bytes.len()
                    && matches!(bytes[i], b':' | b'!' | b'=' | b'<' | b'P' | b'i' | b'x' | b'u' | b'-' | b's' | b'm' | b'a' | b'R')
                {
                    i += 1;
                    if bytes[i - 1] == b'<'
                        && i < bytes.len()
                        && (bytes[i] == b'=' || bytes[i] == b'!')
                    {
                        i += 1;
                    }
                }
            }
            continue;
        }
        // What:     `)`: group close. Parse the trailing quantifier;
        //           classify it as exact `{n}`, variable `{m,n}`,
        //           `*`/`+`/`?`, or unquantified. If the closing
        //           frame had a lookahead in its subtree AND the
        //           quantifier is variable (i.e. unbounded or bound
        //           with m < n), arm the parent's
        //           `pending_trailing_count` to 0. Before doing so,
        //           check the parent's pre-existing pending count: a
        //           close at parent depth is also a structural
        //           boundary that fires if 1-2 atoms had accumulated.
        if c == b')' {
            i += 1;
            let frame = stack.pop().unwrap_or_default();
            // What:     `(is_quantified, is_variable_bound)`. The
            //           tuple captures both whether ANY quantifier
            //           follows (so we know how to arm the parent)
            //           and whether the bound is variable
            //           (only variable bounds trigger Bug F).
            let mut is_quantified = false;
            let mut is_variable_bound = false;
            if i < bytes.len() {
                match bytes[i] {
                    b'*' | b'+' | b'?' => {
                        is_quantified = true;
                        // `*` = `{0,inf}`, `+` = `{1,inf}`, `?` =
                        // `{0,1}` -- all variable bounds.
                        is_variable_bound = true;
                        i += 1;
                    }
                    b'{' => {
                        let mut j = i + 1;
                        let min_start = j;
                        while j < bytes.len() && bytes[j].is_ascii_digit() {
                            j += 1;
                        }
                        let min_end = j;
                        let min_val: u32 = if min_end > min_start {
                            std::str::from_utf8(&bytes[min_start..min_end])
                                .unwrap_or("0")
                                .parse()
                                .unwrap_or(0)
                        } else {
                            0
                        };
                        let mut max_val: u32 = min_val;
                        let mut saw_comma = false;
                        if j < bytes.len() && bytes[j] == b',' {
                            saw_comma = true;
                            j += 1;
                            let max_start = j;
                            while j < bytes.len() && bytes[j].is_ascii_digit() {
                                j += 1;
                            }
                            if j > max_start {
                                max_val = std::str::from_utf8(&bytes[max_start..j])
                                    .unwrap_or("0")
                                    .parse()
                                    .unwrap_or(min_val);
                            } else {
                                // `{m,}` = open upper bound = variable.
                                max_val = u32::MAX;
                            }
                        }
                        if j < bytes.len() && bytes[j] == b'}' {
                            is_quantified = true;
                            // Variable iff `{m,...}` with m < max OR `{m,}`.
                            is_variable_bound = saw_comma && (max_val > min_val);
                            j += 1;
                        }
                        i = j;
                    }
                    _ => {}
                }
                if is_quantified && i < bytes.len() && bytes[i] == b'?' {
                    i += 1;
                }
            }
            let has_la_in_subtree = frame.is_lookahead_self || frame.has_lookahead_subtree;
            // What:     A close at parent depth is a structural
            //           boundary. If the parent was already armed and
            //           accumulated 1-2 trailing atoms (this group
            //           being one of them, already counted via `(`),
            //           fire now.
            // Why:      `(?:(?!abc)){4,12}(?:d)` -- the `(?:d)` open
            //           already incremented the count to 1; the
            //           matching close is the boundary at which we
            //           can confirm the trailing window. But here we
            //           want to keep counting -- the close is at
            //           parent depth and only ends THIS sibling
            //           group's contribution, not the trailing
            //           window. So no firing at close-only.
            if let Some(parent) = stack.last_mut() {
                if has_la_in_subtree {
                    parent.has_lookahead_subtree = true;
                }
                if is_quantified && is_variable_bound && has_la_in_subtree {
                    // What:     Arm the parent. Set count to 0 (zero
                    //           trailing atoms seen yet).
                    parent.pending_trailing_count = 0;
                }
            }
            continue;
        }
        // What:     `|`: alternation. Structural boundary for the
        //           current frame. If we have a pending count of 1-2,
        //           fire; otherwise disarm.
        if c == b'|' {
            if let Some(top) = stack.last_mut() {
                if (1..=2).contains(&top.pending_trailing_count) {
                    return Some(fire_reason());
                }
                top.pending_trailing_count = -1;
            }
            i += 1;
            continue;
        }
        // What:     Stray `*`/`+`/`?`/`{` outside the close-quantifier
        //           handler: malformed input, treat as no-op (not a
        //           trailing atom). Skip without incrementing.
        if matches!(c, b'*' | b'+' | b'?' | b'{') {
            i += 1;
            continue;
        }
        // What:     Any other byte: literal, anchor, dot, etc. One
        //           atom at the current depth.
        if let Some(top) = stack.last_mut() {
            if top.pending_trailing_count >= 0 {
                top.pending_trailing_count += 1;
                if top.pending_trailing_count >= 3 {
                    top.pending_trailing_count = -1;
                }
            }
        }
        i += 1;
    }
    // What:     End-of-regex boundary. Check the top-level (and any
    //           remaining open frames) for pending 1-2 counts.
    // Why:      `(?:(?!abc)){4,12}a` at the top level -- the
    //           top-level frame was armed by the close, the trailing
    //           `a` brought count to 1, and there's no further
    //           boundary; eof is the boundary that fires.
    for frame in stack.iter().rev() {
        if (1..=2).contains(&frame.pending_trailing_count) {
            return Some(fire_reason());
        }
    }
    None
}

// What:     `pub fn nested_grouped_quantifier(src: &str) -> Option<String>`
//           detects regex source containing four or more consecutive
//           `)`+quantifier adjacencies. The shape the fuzz target
//           actually emits looks like
//           `(?:(?:(?:(?:(?:\d){5,11}){5,11}){5,11}){5,11}){5,11}` --
//           five `(?:` opens, an inner atom, then five `){5,11}`
//           close+quantifier pairs back-to-back. Sibling shape
//           `(?:(?:(?:(?:(?:\d)*)*)*)*)*` is the same with `*`
//           instead of `{5,11}`. The `Node::Quant` renderer at
//           `fuzz/src/generators.rs:1292` ALWAYS wraps a quantified
//           atom in `(?:...)`, so the fuzz generator can never emit
//           the bare-stacked shape `stacked_quantifier` was written
//           for -- the grouped form is the actual blowup vector.
// Why:      Each `{N,M}` (or `*`/`+`/`?`) on a group multiplies the
//           inner NFA's state count by up to M (or by a large but
//           bounded factor for `*`/`+`). Five-deep multiplication
//           reaches `11^5 = 161051` repetitions of the inner atom;
//           combined with `(?u)` widening `\d` to the full Unicode
//           decimal-digit class (~700 codepoint sub-states), the
//           regex crate's NFA construction exceeds the 256 MB
//           DFA size limit and takes ~3 s of wall to error with
//           `CompiledTooBig`. Under ASAN in the fuzz target, the
//           single iteration crosses libFuzzer's `report_slow_units`
//           threshold of 10 s and halts the run before the
//           interesting (?u)-Unicode shapes for the e49d8694
//           case-fold soundness bug can be discovered. Rejecting
//           depth-4 chains at the pre-validator level rejects the
//           shape in microseconds with a clear message, keeping
//           the fuzz target moving.
//
//           Threshold: depth 4 (= chain of four `){quant}` pairs).
//           Empirically depth 3 still compiles in milliseconds even
//           under Unicode `\D`/`\d`; depth 4 starts to noticeably
//           bloat NFA construction; depth 5+ reliably wall-clocks.
//           Catching at 4 is conservative enough to spare any
//           plausibly-authored rule (real secret-detection rules
//           seldom nest beyond 2 levels of quantified groups) while
//           covering both halves of the slow-unit source (chain=5
//           for each half; flags as soon as chain reaches 4).
//
//           Detection runs as a single-pass byte walker over `src`:
//             - Escape pairs `\X` and class interiors `[...]` are
//               skipped (escapes are atoms; class bytes are literal
//               and quantifiers don't apply structurally there).
//             - Any `(` resets the chain (a new group opening breaks
//               a `)`+quant chain). The optional `?` after `(` for
//               `(?...)` group prefixes (non-capturing `(?:`, flag
//               groups `(?i)`, lookarounds `(?=`/`(?!`/`(?<=`/`(?<!`,
//               named captures `(?P<...>`/`(?<...>`, comments `(?#...)`)
//               is skipped so it isn't misread as a `?` quantifier.
//             - On `)`, peek the next byte: if it is a quantifier
//               start (`*`/`+`/`?`/`{` followed by a digit), consume
//               the quantifier and an optional `?` lazy modifier;
//               increment the chain counter. If the chain reaches
//               THRESHOLD, return Some(reason).
//             - On `)` with no quantifier following, reset the chain
//               (a close that is not quantified breaks the pattern).
//             - Any other byte (atom, anchor, `|`, literal) resets
//               the chain.
//
//           Place the call alongside `stacked_quantifier` in
//           `compile_rule_src` -- both are structural pre-validators
//           that apply regardless of engine routing, and both
//           rejection messages read as "this source shape is
//           structurally bad" rather than "the plain path
//           specifically dislikes it". Either engine would either
//           reject the shape outright or wall-clock on it.
// TS map:   `function nestedGroupedQuantifier(src: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function nestedGroupedQuantifier(src: string): string | null {
//   // walk bytes; skip \X escapes and class interiors;
//   // on `(` reset chain (and skip optional `?` after);
//   // on `)` peek next byte: if quantifier start, consume it
//   // (plus optional lazy `?`) and chain++; if chain >= 4 return reason;
//   // otherwise reset chain. Any other byte resets chain.
// }
// ```
pub fn nested_grouped_quantifier(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    // What:     `chain: usize` counts consecutive `){quant}` adjacencies.
    //           Resets to 0 on anything that interrupts the pattern
    //           (a new `(`, an atom byte, an alternation, an escape,
    //           a class boundary, or a `)` not followed by a quantifier).
    // Why:      The fuzz blowup shape is exactly a chain of these; the
    //           single integer captures the state without paren-depth
    //           tracking. We don't need to know HOW deep the groups
    //           nest, only that there are CHAIN consecutive
    //           close+quantifier pairs back-to-back.
    // TS map:   `let chain = 0;`.
    let mut chain: usize = 0;
    // What:     `const THRESHOLD: usize = 4;` is the flag-at chain
    //           length. Empirically 3 still compiles in milliseconds
    //           even on Unicode classes; 4 is the inflection point
    //           where NFA size starts to bloat noticeably; 5 is the
    //           slow-unit shape. Catching at 4 gives one level of
    //           safety margin under Unicode widening.
    // Why:      The cutoff is conservative enough to spare plausibly-
    //           authored rules (real secret-detection patterns rarely
    //           nest beyond 2 quantifier levels). Tune downward only
    //           if production rules trip it.
    // TS map:   `const THRESHOLD = 4;`.
    const THRESHOLD: usize = 4;
    while i < bytes.len() {
        let c = bytes[i];
        // What:     Escape pair `\X` is two literal bytes representing
        //           one atom. Skip both bytes and reset chain (the atom
        //           breaks any pending chain of `){quant}` pairs --
        //           e.g. `){5,11}\d){5,11}` is not a chain).
        // Why:      Without skipping, `\)` would be mis-detected as a
        //           group close, and `\{` would be mis-detected as a
        //           quantifier start.
        // TS map:   `if (c === 0x5c) { i += 2; chain = 0; continue; }`.
        if c == b'\\' {
            i += 2;
            chain = 0;
            continue;
        }
        // What:     Character class entry / exit. Inside `[...]` the
        //           metacharacters `(`, `)`, `*`, `+`, `?`, `{`, `}`
        //           are literal bytes; we skip the entire class body.
        //           The class itself is an atom so entry resets chain.
        // Why:      `[)]*` is a one-byte class then a quantifier on
        //           that atom, NOT a `)`+quantifier chain link.
        // TS map:   `if (!inClass && c === 0x5b) { inClass = true; chain = 0; ... }`.
        if !in_class && c == b'[' {
            in_class = true;
            chain = 0;
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
        // What:     Group open `(`. Opens a fresh group; any pending
        //           `){quant}` chain is broken (the chain demands
        //           BACK-TO-BACK close+quant pairs with nothing
        //           between, and a new open is "something between").
        //           Skip an optional `?` after `(` so the `?` in
        //           `(?:`, `(?i)`, `(?P<name>`, `(?<name>`, `(?=`,
        //           `(?!`, `(?<=`, `(?<!`, `(?#...)` is not later
        //           misread as a `?` quantifier.
        // Why:      Without the `?` skip, `(?:a)*` would peek `?`
        //           after the open and may misinterpret subsequent
        //           parsing. The skip keeps the walker structurally
        //           agnostic to group flavor.
        // TS map:   `if (c === 0x28) { chain = 0; i += 1; if (b[i] === 0x3f) i += 1; continue; }`.
        if c == b'(' {
            chain = 0;
            i += 1;
            if i < bytes.len() && bytes[i] == b'?' {
                i += 1;
            }
            continue;
        }
        // What:     Group close `)`. Peek the next byte; if it is a
        //           quantifier start, consume the quantifier (`*`/`+`/
        //           `?` is one byte; `{N}`/`{N,}`/`{N,M}` runs to the
        //           matching `}`) plus an optional `?` lazy modifier,
        //           and increment chain. The `+` possessive is NOT a
        //           modifier in the regex crate -- treat it as a
        //           fresh stacked quantifier on the next iteration
        //           (which will hit "any other byte" and reset chain).
        //           If chain reaches THRESHOLD, return the reason.
        //           If the close is not followed by a quantifier
        //           (close that re-enters a parent expression, etc.),
        //           reset chain -- the pattern is broken.
        // Why:      This is the single state transition that detects
        //           the blowup shape. Every chain increment requires a
        //           `)` IMMEDIATELY followed by a `*`/`+`/`?`/`{N`;
        //           any deviation resets the chain.
        // TS map:   `if (c === 0x29) { i += 1; const isQuant = ...; if (isQuant) { ...consume...; chain += 1; if (chain >= THRESHOLD) return reason; } else { chain = 0; } continue; }`.
        if c == b')' {
            i += 1;
            let is_quant = i < bytes.len()
                && (matches!(bytes[i], b'*' | b'+' | b'?')
                    || (bytes[i] == b'{'
                        && i + 1 < bytes.len()
                        && bytes[i + 1].is_ascii_digit()));
            if is_quant {
                if bytes[i] == b'{' {
                    while i < bytes.len() && bytes[i] != b'}' {
                        i += 1;
                    }
                    if i < bytes.len() {
                        i += 1;
                    }
                } else {
                    i += 1;
                }
                if i < bytes.len() && bytes[i] == b'?' {
                    i += 1;
                }
                chain += 1;
                if chain >= THRESHOLD {
                    return Some(format!(
                        "nested grouped quantifier at byte offset {}: chain of {} consecutive `)`+quantifier pairs detected. Deeply nested quantified groups (e.g. `(?:(?:(?:(?:a){{5,11}}){{5,11}}){{5,11}}){{5,11}}`) expand multiplicatively in NFA construction; depth 4+ reaches the `regex` crate's 256 MB size limit during compile and takes seconds to error. Flatten the nesting or apply at most a few quantifier levels per group.",
                        i, chain
                    ));
                }
            } else {
                chain = 0;
            }
            continue;
        }
        // What:     Any other byte (atom, anchor, `|`, literal) breaks
        //           the chain.
        // Why:      Chain requires BACK-TO-BACK close+quant; an atom
        //           between two `){quant}` pairs means they are not
        //           chained.
        chain = 0;
        i += 1;
    }
    None
}

// What:     `pub fn nested_quantifier_after_wildcard(src: &str) -> Option<String>`
//           detects rule shapes where a bare `_` wildcard (the
//           scanner's `_` triad atom, expanded to wildcard during
//           resharp dispatch) is immediately followed by three or
//           more consecutive `)`+quantifier adjacencies. The shape
//           the fuzz target emits is `(?:(?:(?:(?:_){5,6}){5,12})+`
//           and similar, decoded from artifacts
//           `slow-unit-8c4172d7d381b5c64c5aba568217c38c5ce94945`
//           (compile 409ms + scan 1.16s) and
//           `slow-unit-709cb39b5255ddf0721c435159191d03aa0498ea`
//           (compile 4.33s).
// Why:      Each `){N,M}` on a group multiplies the inner atom's NFA
//           state count by up to M. `_` is the largest atom in the
//           dispatch surface (matches every byte / Unicode code
//           point), so depth-3 nesting on `_` produces hundreds of
//           thousands of effective inner repetitions and resharp's
//           NFA construction takes from hundreds of milliseconds to
//           several seconds. libFuzzer's `report_slow_units` flag
//           records these as slow-unit artifacts; the fuzz target
//           burns budget re-running them. The existing
//           `nested_grouped_quantifier` detector (threshold 4)
//           passes these depth-3 shapes through to resharp because
//           depth-3 with literal innermost atom (e.g. `(?:(?:(?:a)*)*)*`)
//           does compile in milliseconds. Distinguishing on the
//           innermost atom kind without rewriting the existing
//           walker is cleanest as a separate, targeted pre-validator
//           that fires only when the chain follows `_` directly.
//
//           Detection criterion (single-pass byte walker):
//             - Walk `src`, skipping escape pairs `\X` and class
//               interiors `[...]` (the `_` inside a class is a
//               literal underscore byte, not the wildcard triad).
//             - At every bare `_` byte outside a class, count the
//               immediately-following chain of `)`+quantifier pairs.
//             - If the chain length reaches 3, return Some(reason).
//
//           Threshold: chain >= 3 (one less than
//           `nested_grouped_quantifier`'s threshold of 4). Empirical
//           timings (probed against resharp 0.6.0 with
//           overflow-checks=on): depth-3 on `_` ranges 400ms-4.3s;
//           depth-2 on `_` (chain 2) compiles in <50ms. Catching at
//           chain=3 is the precise inflection point and keeps the
//           false-positive risk at zero against the production
//           ruleset (max chain in `forbidden-strings.local.txt` is
//           1; max chain in any production rule is 1).
//
//           Place the call in `compile_rule_src`'s resharp branch:
//           bare `_` outside a class is a `requires_resharp` trigger,
//           so the validator only fires for rules that would route
//           to resharp anyway. The plain-regex path never sees the
//           `_` wildcard triad and the validator would be dead code
//           on that branch.
// TS map:   `function nestedQuantifierAfterWildcard(src: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function nestedQuantifierAfterWildcard(src: string): string | null {
//   // walk bytes; skip \X escapes and [class] bodies;
//   // at every bare `_` outside a class, count consecutive `)`+quant
//   // pairs that follow; if >= 3, return reason.
// }
// ```
pub fn nested_quantifier_after_wildcard(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    while i < bytes.len() {
        let c = bytes[i];
        // What:     Escape pair `\X` is two bytes representing one atom.
        // Why:      `\_` is an escaped underscore literal, not the
        //           wildcard triad; `\(` / `\)` would corrupt the
        //           class-tracking state.
        // TS map:   `if (c === 0x5c) { i += 2; continue; }`.
        if c == b'\\' {
            i += 2;
            continue;
        }
        // What:     Character class entry / exit. Inside `[...]`, `_`
        //           is a literal underscore byte, NOT the wildcard
        //           triad.
        // Why:      `[_]` matches the single byte `_`; only bare `_`
        //           outside a class expands to wildcard in this
        //           scanner's dispatch.
        // TS map:   `if (!inClass && c === 0x5b) { inClass = true; i++; continue; }`.
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
        // What:     At every bare `_` outside a class, count the
        //           immediately-following chain of `)`+quantifier
        //           pairs. If >= 3, return reason.
        // Why:      The 8c41 / 709c slow-unit shape is exactly this:
        //           a `_` followed by three or more close+quantifier
        //           adjacencies.
        // TS map:   `if (c === 0x5f) { const chain = countCloseQuantChain(bytes, i+1); if (chain >= 3) return reason; }`.
        if c == b'_' {
            let chain = count_close_quant_chain_after(bytes, i + 1);
            if chain >= 3 {
                return Some(format!(
                    "nested quantifier on bare wildcard `_` at byte offset {}: chain of {} consecutive `)`+quantifier pairs immediately follows the `_`. The `_` triad expands to a wildcard atom (matches every char); nesting quantifiers depth 3+ on a wildcard explodes resharp's NFA construction, taking hundreds of milliseconds to several seconds to compile. Flatten the nesting or replace `_` with a more restrictive atom.",
                    i, chain
                ));
            }
        }
        i += 1;
    }
    None
}

// What:     `pub fn nested_chain_in_lookaround_body(src: &str) -> Option<String>`
//           detects rule shapes containing a chain of three or more
//           consecutive `)`+quantifier adjacencies anywhere INSIDE
//           an open lookaround body (`(?!...)`, `(?=...)`,
//           `(?<!...)`, `(?<=...)`). Decoded from artifact
//           `slow-unit-4eabfd5c52969dcc20c2170cd30947eccf8ae62f`
//           which compiles in 1.9s before resharp returns
//           `Algebra(UnsupportedPattern)`.
// Why:      Even with a literal innermost atom (`nested_quantifier_after_wildcard`
//           does not fire), resharp's algebra simplifier struggles
//           to canonicalise the derivative of a chain-3 quantifier
//           nest that sits inside an open lookaround context. The
//           lookaround forces the simplifier to walk derivative
//           shapes per-prefix per-suffix, multiplying the work
//           proportionally to the chain's NFA size. The compile
//           wall-clocks past libFuzzer's slow-unit threshold even
//           though the eventual outcome is a clean `Err`.
//
//           Detection criterion (single-pass byte walker with a
//           lookaround-depth stack):
//             - Walk `src`, skipping escape pairs `\X` and class
//               interiors `[...]`.
//             - On `(`, push a frame: `true` if the opener is
//               `(?!` / `(?=` / `(?<!` / `(?<=`, else `false`.
//             - On `)`, pop the frame.
//             - Maintain a running `chain` counter of consecutive
//               `)`+quantifier pairs; reset on `(`, alternation `|`,
//               escape, class entry, or any other literal byte.
//             - Increment chain only when `)` is immediately followed
//               by a quantifier (`*`/`+`/`?`/`{N`). Consume the
//               quantifier and an optional lazy `?`.
//             - If chain >= 3 AND any frame currently on the stack
//               is a lookaround, return Some(reason).
//
//           The lookaround-stack is intentionally counter-style
//           (any lookaround anywhere up the stack triggers) rather
//           than nearest-lookaround: 4eab nests the chain inside
//           the OUTER `(?!...)` lookahead with an INNER `(?!...)`
//           in between; both are open during the chain. A nearest-
//           lookaround check would miss the case where the chain
//           sits two levels deep inside the outer lookaround.
//
//           Place the call in `compile_rule_src`'s resharp branch:
//           lookarounds are `requires_resharp` triggers, so the
//           validator only fires for rules that would route to
//           resharp anyway.
// TS map:   `function nestedChainInLookaroundBody(src: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function nestedChainInLookaroundBody(src: string): string | null {
//   // walk bytes; maintain a stack of bool (true=lookaround frame);
//   // skip \X escapes and [class] bodies;
//   // on `(` push frame (true if `(?!`/`(?=`/`(?<!`/`(?<=`);
//   // on `)` pop frame, then if next is quantifier, consume and
//   //   chain++; if chain >= 3 and any open frame is lookaround,
//   //   return reason;
//   // any other byte resets chain.
// }
// ```
pub fn nested_chain_in_lookaround_body(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    let mut chain: usize = 0;
    // What:     `stack: Vec<bool>`. One entry per open group; `true`
    //           if the opener is a lookaround (`(?!`/`(?=`/`(?<!`/
    //           `(?<=`), `false` otherwise (`(`, `(?:`, `(?P<...>`,
    //           `(?i)`, etc.).
    // Why:      Knowing whether ANY currently-open frame is a
    //           lookaround is enough to gate the chain trigger.
    //           Storing the booleans in order lets us pop on `)`
    //           and check the stack with one pass.
    let mut stack: Vec<bool> = Vec::new();
    while i < bytes.len() {
        let c = bytes[i];
        // What:     Escape pair `\X`. Two bytes, one atom; breaks any
        //           pending close+quant chain.
        // Why:      `\)` would mis-pop a frame; `\(` would push a
        //           bogus frame.
        // TS map:   `if (c === 0x5c) { i += 2; chain = 0; continue; }`.
        if c == b'\\' {
            i += 2;
            chain = 0;
            continue;
        }
        // What:     Character class entry / exit. Inside `[...]`,
        //           parens / quantifiers / `|` are literal bytes.
        // Why:      `[)]` shouldn't pop a frame; `[*]` shouldn't be
        //           read as a quantifier.
        // TS map:   `if (!inClass && c === 0x5b) { inClass = true; chain = 0; i++; continue; }`.
        if !in_class && c == b'[' {
            in_class = true;
            chain = 0;
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
        // What:     `(`: detect lookaround opener, push frame, reset
        //           chain. Skip the `?` after `(` so the body walk
        //           doesn't misread the group prefix.
        // Why:      Lookaround openers are `(?!` / `(?=` / `(?<!` /
        //           `(?<=`. Detecting at open time means the inner
        //           body walk can check `stack.iter().any(|&b| b)`
        //           in O(depth) without re-parsing.
        // TS map:   `if (c === 0x28) { stack.push(isLookaroundOpen(bytes, i)); chain = 0; i++; if (bytes[i] === 0x3f) i++; continue; }`.
        if c == b'(' {
            let is_lookaround = is_lookaround_opener(bytes, i);
            stack.push(is_lookaround);
            chain = 0;
            i += 1;
            if i < bytes.len() && bytes[i] == b'?' {
                i += 1;
            }
            continue;
        }
        // What:     `)`: pop the frame. Check the following byte for
        //           a quantifier; if present, consume it (plus lazy
        //           `?`) and increment chain. If chain >= 3 AND any
        //           STILL-OPEN frame is a lookaround, return reason.
        // Why:      Popping before the chain check is critical: the
        //           lookaround that wraps the chain must remain on
        //           the stack at trigger time. The wrap is OUTER, so
        //           it stays open until its own matching `)`.
        // TS map:   `if (c === 0x29) { stack.pop(); ...quant consume...; chain++; if (chain >= 3 && stack.some(b => b)) return reason; }`.
        if c == b')' {
            stack.pop();
            i += 1;
            let is_quant = i < bytes.len()
                && (matches!(bytes[i], b'*' | b'+' | b'?')
                    || (bytes[i] == b'{'
                        && i + 1 < bytes.len()
                        && bytes[i + 1].is_ascii_digit()));
            if is_quant {
                if bytes[i] == b'{' {
                    while i < bytes.len() && bytes[i] != b'}' {
                        i += 1;
                    }
                    if i < bytes.len() {
                        i += 1;
                    }
                } else {
                    i += 1;
                }
                if i < bytes.len() && bytes[i] == b'?' {
                    i += 1;
                }
                chain += 1;
                if chain >= 3 && stack.iter().any(|&b| b) {
                    return Some(format!(
                        "nested grouped quantifier inside lookaround body at byte offset {}: chain of {} consecutive `)`+quantifier pairs while an open lookaround frame remains higher up the stack. Resharp's algebra simplifier walks derivative shapes per-prefix per-suffix inside lookarounds, multiplying the chain's NFA cost by the lookaround context size; the compile wall-clocks past libFuzzer's slow-unit threshold even when the eventual outcome is `Err(UnsupportedPattern)`. Flatten the nesting or move the chain outside the lookaround body.",
                        i, chain
                    ));
                }
            } else {
                chain = 0;
            }
            continue;
        }
        // What:     Any other byte (atom, anchor, `|`, literal) breaks
        //           the chain.
        // Why:      Chain requires BACK-TO-BACK close+quant.
        chain = 0;
        i += 1;
    }
    None
}

// What:     `fn count_close_quant_chain_after(bytes: &[u8], start: usize) -> usize`
//           returns the number of consecutive `)`+quantifier pairs
//           starting at `start`. Used by `nested_quantifier_after_wildcard`
//           to count the chain after a `_`.
// Why:      Sharing the chain-counting logic via a helper avoids
//           duplicating the quantifier-parsing rules across the two
//           detectors.
// TS map:   `function countCloseQuantChainAfter(bytes: Uint8Array, start: number): number`.
fn count_close_quant_chain_after(bytes: &[u8], start: usize) -> usize {
    let mut i = start;
    let mut chain = 0usize;
    while i < bytes.len() && bytes[i] == b')' {
        i += 1;
        let is_quant = i < bytes.len()
            && (matches!(bytes[i], b'*' | b'+' | b'?')
                || (bytes[i] == b'{'
                    && i + 1 < bytes.len()
                    && bytes[i + 1].is_ascii_digit()));
        if !is_quant {
            break;
        }
        if bytes[i] == b'{' {
            while i < bytes.len() && bytes[i] != b'}' {
                i += 1;
            }
            if i < bytes.len() {
                i += 1;
            }
        } else {
            i += 1;
        }
        if i < bytes.len() && bytes[i] == b'?' {
            i += 1;
        }
        chain += 1;
    }
    chain
}

// What:     `pub fn nested_complement(src: &str) -> Option<String>`
//           detects rule shapes containing one resharp complement
//           `~(...)` whose body contains another `~(...)` complement
//           (back-to-back `~(~(...))` or transparent-group-separated
//           `~((?:~(...)))`). Decoded from artifact
//           `timeout-95f5e661c596e4b5a12e9841cda2e3ba242ecf7a` after
//           the bias commit's generator now produces such shapes.
// Why:      Resharp's algebra simplifier computes a complement via
//           DFA derivative; computing the complement of a complement
//           does not short-circuit to identity in 0.6.x and instead
//           walks both derivative chains. Probed compile time:
//             - `~(~(quantified_ws_chain))` -- 916 ms
//             - `~((?:~(quantified_ws_chain)))` -- 913 ms
//             - `~(quantified_ws_chain)` (single) -- 1.84 ms
//           Under cargo-fuzz's ASAN build the 900 ms compile
//           amplifies past libFuzzer's 10 s per-input timeout (the
//           timeout artifact reproduced in 31 s through the fuzz
//           binary). Source-shape rejection avoids the wall-clock
//           burn.
//
//           Detection criterion (single-pass byte walker with a
//           per-paren is-complement-frame stack):
//             - Walk `src`, skipping escape pairs `\X` and class
//               interiors `[...]`.
//             - On `~(`, FIRST check whether any open frame is a
//               complement; if so, return Some(reason). Then push
//               a "complement" frame onto the stack.
//             - On `(` (without preceding `~`), push a "non-
//               complement" frame; skip the `?` after `(` so the
//               body walk doesn't misread group prefixes.
//             - On `)`, pop the top frame.
//
//           The check-before-push order is critical: it ensures the
//           OUTER complement is still on the stack when the INNER
//           complement is detected. Reversing the order would miss
//           the back-to-back case (the outer's frame would be
//           pushed, then immediately the inner's, with no
//           opportunity to detect that the inner is INSIDE the
//           outer's body).
//
//           Sibling complements (`~(...)&~(...)` shape used by the
//           production rule
//           `RELEASE_TAG_[a-f0-9]{32}&~(RELEASE_TAG_(00){16})&~(...)`)
//           do NOT trigger this detector: the first complement
//           closes (popping its frame) before the second opens, so
//           the second `~(` sees a stack with no complement frames.
//
//           Place the call in `compile_rule_src`'s resharp branch:
//           `~(` is itself a `requires_resharp` trigger, so the
//           validator only fires for rules that would route to
//           resharp anyway.
// TS map:   `function nestedComplement(src: string): string | null`.
//
// In TS you'd write (pseudocode):
// ```ts
// function nestedComplement(src: string): string | null {
//   // walk bytes; maintain stack of bool (true=complement frame);
//   // skip \X escapes and [class] bodies;
//   // on `~(`: check `stack.some(b => b)` first (return if true);
//   //   then push true; skip 2 bytes;
//   // on `(`: push false; skip 1 byte; skip `?` after `(`;
//   // on `)`: pop.
// }
// ```
pub fn nested_complement(src: &str) -> Option<String> {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    let mut stack: Vec<bool> = Vec::new();
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
        if in_class {
            if c == b']' {
                in_class = false;
            }
            i += 1;
            continue;
        }
        // What:     `~(` opens a complement. Check first whether we
        //           are inside another complement; if so, fire.
        //           Otherwise push a "complement" frame and skip
        //           past `~(`.
        // Why:      Resharp's complement-of-complement evaluation
        //           walks both derivative chains and takes
        //           hundreds of milliseconds; under ASAN that
        //           amplifies past libFuzzer's timeout.
        // TS map:   `if (c === 0x7e && bytes[i+1] === 0x28) { if (stack.some(b => b)) return reason; stack.push(true); i += 2; continue; }`.
        if c == b'~' && bytes.get(i + 1).copied() == Some(b'(') {
            if stack.iter().any(|&b| b) {
                return Some(format!(
                    "nested complement `~(~(...))` at byte offset {}: a complement appears inside another complement's body. Resharp's algebra simplifier computes complements via DFA derivative; complement-of-complement walks both derivative chains without identity short-circuit, taking hundreds of milliseconds to compile. Under ASAN the cost amplifies past libFuzzer's 10s per-input timeout. Flatten the nesting (one complement at a time, joined via `&` if combining), or eliminate the outer complement.",
                    i
                ));
            }
            stack.push(true);
            i += 2;
            continue;
        }
        if c == b'(' {
            stack.push(false);
            i += 1;
            if i < bytes.len() && bytes[i] == b'?' {
                i += 1;
            }
            continue;
        }
        if c == b')' {
            stack.pop();
            i += 1;
            continue;
        }
        i += 1;
    }
    None
}

// What:     `fn is_lookaround_opener(bytes: &[u8], i: usize) -> bool`
//           returns true if `bytes[i..]` starts with `(?!`/`(?=`/
//           `(?<!`/`(?<=`.
// Why:      Detect lookaround openers without committing to a full
//           regex parser. Used by `nested_chain_in_lookaround_body`.
// TS map:   `function isLookaroundOpener(bytes: Uint8Array, i: number): boolean`.
fn is_lookaround_opener(bytes: &[u8], i: usize) -> bool {
    if bytes.get(i).copied() != Some(b'(') {
        return false;
    }
    if bytes.get(i + 1).copied() != Some(b'?') {
        return false;
    }
    match bytes.get(i + 2).copied() {
        Some(b'!') | Some(b'=') => true,
        Some(b'<') => matches!(bytes.get(i + 3).copied(), Some(b'!') | Some(b'=')),
        _ => false,
    }
}
