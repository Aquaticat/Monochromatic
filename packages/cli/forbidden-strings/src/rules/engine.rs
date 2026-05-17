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
//           overflow at `resharp-algebra/src/lib.rs:2470`), one during
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
                    "intersection (`&`) involving a {} triggers a known resharp 0.5.x through 0.6.x debug_assert in `scan_fwd_all` (`engine.rs:1020`); behind a `debug_assert!` so release silently returns wrong matches. Rewrite the rule to lift the {} outside the intersection (e.g. anchor it as a prefix), or replace it with an explicit consume of the relevant byte. {}",
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
    // What:     Final check: if any closed group had alt+lookaround
    //           in its body AND the source has 2+ lookarounds total,
    //           the shape matches the panic pattern.
    // Why:      Defers the sibling-existence check to here so
    //           "sibling before" and "sibling after" both work.
    if found_alt_la_group && total_lookarounds >= 2 {
        return Some(format!(
            "alternation containing a lookaround with a sibling lookaround triggers a known resharp 0.5.x through 0.6.x debug_assert in `scan_fwd_all` (`engine.rs:1020`; `unexpected end 0 > N`). Minimal reproducer: `(a|(?![_]))(?!a)`. The shape compiles through the resharp parser because the non-lookaround alt branch lets the algebra simplify, but the forward DFA scan trips the assertion. Rewrite to remove the alternation, or lift one of the lookarounds outside the alternation, or replace with an explicit byte consume. {}",
            TROUBLESHOOT_REF
        ));
    }
    None
}

// What:     `pub fn intersection_with_word_end_alternation(src: &str) -> Option<String>`
//           detects rule shapes that match resharp 0.5.x through 0.6.x's
//           algebra arithmetic-overflow panic at
//           `resharp-algebra/src/lib.rs:2470`
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
                    "intersection (`&`) co-occurring with `\\w` shorthand and `$` end-anchor triggers a known resharp 0.5.x through 0.6.x arithmetic-overflow panic in `attempt_rw_concat_2` (`resharp-algebra/src/lib.rs:2470`). Rewrite the rule to avoid this combination -- typically by replacing `\\w` with an explicit character class (`[A-Za-z0-9_]`) or by lifting the end-anchor outside the intersection. {}",
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
//           `BOT` early. Filed upstream: see TROUBLESHOOTING.resharp.md
//           for the issue link.
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
