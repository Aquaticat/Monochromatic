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
    //           on `(?<=` or `(?<!` outside class set
    //           `has_lookbehind`. Return early as soon as both
    //           are seen (no need to finish the walk).
    // Why:      Avoid the cost of a second pass; the source
    //           strings we process are short (rule lines) and
    //           a single linear scan is plenty.
    // TS map:   Same shape; one for-loop with two booleans.
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    let mut has_intersection = false;
    let mut has_lookbehind = false;
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
            // What:     `(?<=` or `(?<!` lookbehind detection.
            //           The `?<` prefix can also start a named
            //           capture `(?<name>...)`; the discriminator
            //           is the byte after `<` -- `=` or `!`
            //           means lookbehind, any other byte means
            //           named capture (which the regex / resharp
            //           parsers both accept without panic).
            // Why:      Match the same shape `lookaround_in_complement`
            //           uses; keeps detection rules consistent
            //           across pre-validators.
            // TS map:   `if (c === '(' && b[i+1] === '?' && b[i+2] === '<' && (b[i+3] === '=' || b[i+3] === '!'))`.
            if c == b'(' && i + 3 < bytes.len() && bytes[i + 1] == b'?' && bytes[i + 2] == b'<' {
                let kind = bytes[i + 3];
                if kind == b'=' || kind == b'!' {
                    has_lookbehind = true;
                }
            }
            if has_intersection && has_lookbehind {
                return Some(format!(
                    "intersection (`&`) involving a lookbehind triggers a known resharp 0.5.x through 0.6.x debug_assert in `scan_fwd_all` (`engine.rs:1020`); behind a `debug_assert!` so release silently returns wrong matches. Rewrite the rule to lift the lookbehind outside the intersection (e.g. anchor it as a prefix), or replace the lookbehind with an explicit consume of the preceding byte. {}",
                    TROUBLESHOOT_REF
                ));
            }
        }
        i += 1;
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
