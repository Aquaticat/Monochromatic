//! rules engine compiled support for the forbidden-strings scanner.
/// Imports dependencies used by this module.
// What:     `use resharp::Regex;` imports the resharp regex type.
//           Resharp's `Regex` holds a `Mutex<RegexInner>` for lazy DFA
//           growth, so calling `is_match`/`find_all` on a SHARED Regex
//           from multiple threads serializes through that lock. Each
//           rule gets its own Regex, so per-rule parallelism still
//           works (different mutexes).
// Why:      We use resharp only for the (smaller) regex bucket --
//           literals go through AC. The combined-over-regex-bucket
//           Regex acts as a fast "any regex rule might match?" gate.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Regex } from "resharp";
// ```
use resharp::Regex;

/// Imports dependencies used by this module.
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
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent. Rust requires catch_unwind + AssertUnwindSafe to
// // intercept panics across a closure boundary.
// ```
use std::panic::{catch_unwind, AssertUnwindSafe};

/// Imports dependencies used by this module.
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
//
// In TS you'd write (pseudocode):
// ```ts
// // No 1:1; pretend `import { Regex as PlainRegex } from "regex-bytes";`
// ```
use regex::bytes::Regex as PlainRegex;

/// Enumerates `CompiledRegex` variants.
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
    /// Regex compiled by the resharp engine.
    Resharp(
        /// Owned resharp regex instance.
        Regex,
    ),
    /// Regex compiled by the fallback `regex` crate engine.
    Plain(
        /// Owned byte-regex instance.
        PlainRegex,
    ),
}

/// Groups fields for `ScanMatch`.
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
//
// In TS you'd write (pseudocode):
// ```ts
// type ScanMatch = { start: number; end: number };
// ```
#[derive(Debug, Clone, Copy)]
pub struct ScanMatch {
/// Stores `start`.
    pub start: usize,
/// Stores `end`.
    pub end: usize,
}

/// Provides methods for this type.
impl CompiledRegex {
/// Implements `find_all`.
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

/// Implements `is_match`.
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
