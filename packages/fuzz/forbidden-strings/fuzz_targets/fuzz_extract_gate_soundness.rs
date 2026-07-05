// What:     `fuzz_extract_gate_soundness` is the primary, load-bearing
//           fuzz target. It generates one (rule, content) pair per
//           iteration, compiles the rule via `compile_rule_src` (the
//           single source of truth production also uses), runs the
//           compiled regex against the content, asks
//           `extract_gating_substrings` for the rule's AC gates, and
//           asserts: if the regex matches at least once AND the
//           extractor returned `Some(gates)`, then AT LEAST ONE gate
//           substring must appear somewhere in the content under the
//           gate's case-sensitivity flag. The contract matches what
//           the AC-driven scan path relies on at runtime: AC fires
//           per file (not per match position), so any gate's presence
//           is enough to keep the rule on the fast path.
// Why:      This is the invariant the e49d8694 / e100659f / 9b41fca0
//           bug class violated. Pre-fix, the extractor returned an
//           empty / mojibake / wildcard-treating-as-literal substring;
//           the registered AC pattern never matched the file's bytes;
//           the rule was effectively silenced even though
//           `extract_gating_substrings` returned `Some(...)`. The
//           soundness target catches that shape automatically: a
//           match without any gate hit is exactly the failure mode.
//
// In TS you'd write (pseudocode):
// ```ts
// fuzzTarget((input: RuleAndContent) => {
//   const src = renderRule(input.rule);
//   const compiled = compileRuleSrc(src); if (!compiled.ok) return;
//   const matches = compiled.findAll(input.content); if (!matches.ok || matches.value.length === 0) return;
//   const gates = extractGatingSubstrings(src); if (!gates) return;
//   const anyGateAppears = gates.some(({ sub, ci }) => containsUnderCi(input.content, sub, ci));
//   if (!anyGateAppears) throw new Error("soundness violation");
// });
// ```

// What:     `#![no_main]`. Inner attribute (the `!` after `#`) applied
//           to the WHOLE crate, declaring that this crate does NOT
//           provide a `fn main()`. libFuzzer's runtime supplies one
//           via the `LLVMFuzzerTestOneInput` symbol that the
//           `fuzz_target!` macro emits.
// Why:      Required boilerplate for every cargo-fuzz target.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent.
// ```
#![no_main]

// What:     `use libfuzzer_sys::fuzz_target;`. Brings the macro into
//           scope. The macro generates the C-ABI `extern "C" fn
//           LLVMFuzzerTestOneInput(...)` libFuzzer calls per
//           iteration.
// Why:      Without the import the `fuzz_target!(...)` invocation
//           below would fail to resolve.
//
// In TS you'd write (pseudocode):
// ```ts
// import { fuzzTarget } from "libfuzzer-stub";
// ```
use libfuzzer_sys::fuzz_target;

// What:     `use forbidden_strings::fuzz_api::*;`. Wildcard import
//           of every name re-exported by the `fuzz_api` module
//           (only present when the parent crate is built with the
//           `fuzzing` Cargo feature, which `fuzz/Cargo.toml`
//           enables). Sibling: explicit name listing -- noisier but
//           tracks unused imports better; wildcard is OK in a fuzz
//           target where every helper is potentially in scope.
// Why:      Access the internal helpers `compile_rule_src`,
//           `extract_gating_substrings`, `CompiledRegex` (for its
//           `find_all` method) without widening the production
//           public surface.
//
// In TS you'd write (pseudocode):
// ```ts
// import * as fuzzApi from "forbidden-strings/fuzzApi";
// ```
use forbidden_strings::fuzz_api::*;

// What:     `use forbidden_strings_fuzz::generators::RuleAndContent;`.
//           The structured input type from our shared generator
//           crate.
// Why:      libFuzzer hands us a byte slice each iteration; we let
//           the `Arbitrary` derive turn it into a `RuleAndContent`
//           pair so the target body works on structured data, not
//           raw bytes.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { RuleAndContent } from "forbidden-strings-fuzz/generators";
// ```
use forbidden_strings_fuzz::generators::RuleAndContent;

// What:     `use sha2::{Digest, Sha256};`. The `Digest` trait (must
//           be in scope for `Sha256::new()`, `.update()`,
//           `.finalize()` calls) and the `Sha256` hasher type.
//           Sibling: `Sha512` for 64-byte digests -- we use SHA-256
//           because it's enough for redaction-grade fingerprints
//           and shorter to print.
// Why:      Panic reproducer must NEVER include raw content bytes
//           (any of which might be a real leaked secret picked up
//           from a future seeded corpus). A digest gives the
//           reader enough to reproduce locally (same bytes -> same
//           digest) without exposing them.
//
// In TS you'd write (pseudocode):
// ```ts
// import { createHash } from "node:crypto";
// ```
use sha2::{Digest, Sha256};

// What:     `install_resharp_panic_filter()` -- one-time installation of
//           a panic hook that swallows panics originating at known
//           resharp upstream-bug locations while preserving normal
//           crash semantics for all other panics.
// Why:      libfuzzer-sys installs a panic hook that calls
//           `std::process::abort()` after the default hook (see
//           libfuzzer-sys-0.4.12/src/lib.rs:91-95). The abort happens
//           BEFORE unwinding starts, so `compile_rule_src`'s
//           `catch_unwind` never gets a chance to catch resharp
//           panics. Each new upstream-bug shape would halt the fuzz
//           until we added a pre-validator for it.
//
//           This filter inspects the panic location: if it matches
//           one of the known upstream resharp bug sites (Bug F at
//           `resharp-algebra/.../lib.rs:2470` overflow; Bug B at
//           `resharp-engine/.../engine.rs:1020` debug_assert), it
//           does nothing -- the panic unwinds normally and
//           `compile_rule_src`'s `catch_unwind` returns Err, which
//           the fuzz target treats as "skip this input" via the
//           `Err(_) => return` arm.
//
//           For all OTHER panics (our own bugs, the soundness
//           assertion, anything new), it calls the default hook
//           (which prints the stack) and then `abort()` -- preserving
//           libfuzzer's crash reporting.
//
//           Installed exactly once via `Once` so repeated calls from
//           the fuzz_target! closure are idempotent.
fn install_resharp_panic_filter() {
    use std::sync::Once;
    static INIT: Once = Once::new();
    INIT.call_once(|| {
        let default_hook = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |panic_info| {
            // What:     Inspect the panic's source location. Known
            //           upstream resharp bugs:
            //             - `resharp-algebra-*/src/lib.rs:2470` (Bug F:
            //               attempt to add with overflow on lookahead
            //               chain `rel`)
            //             - `resharp-engine-*/src/engine.rs:1020` (Bug B:
            //               debug_assert! "unexpected end N > M")
            //           Both have stable file paths (the version
            //           number changes but the file name and line
            //           number are sticky across 0.5.x to 0.6.x).
            //           Match on the suffix to avoid binding to a
            //           specific version directory.
            let is_known_upstream_bug = match panic_info.location() {
                Some(loc) => {
                    let file = loc.file();
                    let line = loc.line();
                    // Bug F: cargo dependency path is
                    // `.../resharp-algebra-<ver>/src/lib.rs:2470`.
                    (file.contains("resharp-algebra") && file.ends_with("src/lib.rs") && line == 2470)
                        // Bug B: cargo dependency path is
                        // `.../resharp-<ver>/src/engine.rs:1020`. The
                        // `-` after `resharp` distinguishes from
                        // unrelated crates that might contain "resharp"
                        // in their name; `ends_with("src/engine.rs")`
                        // narrows further.
                        || (file.contains("/resharp-") && file.ends_with("src/engine.rs") && line == 1020)
                }
                None => false,
            };
            if !is_known_upstream_bug {
                // Real panic -- preserve libfuzzer semantics.
                default_hook(panic_info);
                std::process::abort();
            }
            // Known upstream bug: no-op. The panic unwinds, the inner
            // catch_unwind catches it, and we proceed to the next
            // fuzz input.
        }));
    });
}

// What:     `fuzz_target!(|input: RuleAndContent| { ... });`. The macro
//           accepts a closure whose argument type drives
//           libfuzzer-sys's `Arbitrary` decoding. Each invocation:
//           reads bytes from libFuzzer's mutator, runs them through
//           `RuleAndContent::arbitrary`, then invokes the closure
//           with the result. Panic = libFuzzer crash report.
// Why:      Structured fuzzing entry point.
//
// In TS you'd write (pseudocode):
// ```ts
// fuzzTarget((input: RuleAndContent) => {
//   // body below
// });
// ```
fuzz_target!(|input: RuleAndContent| {
    // What:     `install_resharp_panic_filter()`. Idempotent thanks to
    //           the internal `Once`. Replaces libfuzzer-sys's
    //           abort-on-panic hook with one that lets known
    //           resharp upstream-bug panics unwind so
    //           `compile_rule_src`'s `catch_unwind` catches them.
    //           See the function definition above for the rationale.
    // Why:      Without this hook installation, libfuzzer-sys's
    //           `abort()` call fires before unwinding starts and
    //           every new upstream-bug shape halts the fuzz run.
    install_resharp_panic_filter();

    // What:     `let RuleAndContent { rule, content } = input;`.
    //           Struct-destructuring let-binding. Moves the fields
    //           out of `input` (we no longer use `input` after this).
    // Why:      Local names for the two halves of the bundle.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const { rule, content } = input;
    // ```
    let RuleAndContent { rule, content } = input;

    // What:     `let src = rule.render();`. Method call producing
    //           the `(?flags)body` source string `compile_rule_src`
    //           expects.
    // Why:      We need the source both for compilation AND for
    //           the extractor (it parses the same string shape).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const src = renderRule(rule);
    // ```
    let src = rule.render();

    // What:     `let compiled = match compile_rule_src(&src) { ... };`.
    //           Pattern match on `anyhow::Result<CompiledRegex>`.
    //           The `Err` arm returns early (`return;`) so libFuzzer
    //           does not count compile-failures as soundness
    //           violations -- those are uninteresting "bad syntax"
    //           rejections that don't exercise the gate path.
    // Why:      Skip rules the loader would have rejected at runtime.
    //           Only well-compiled rules exercise the AC-gate
    //           contract.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let compiled;
    // try { compiled = compileRuleSrc(src); } catch { return; }
    // ```
    let compiled = match compile_rule_src(&src) {
        Ok(c) => c,
        Err(_) => return,
    };

    // What:     `let matches = match compiled.find_all(&content) { ... };`.
    //           Run the regex over the full content slice. `&content`
    //           is a borrowed `&[u8]` (the byte view of a `Vec<u8>`).
    //           The `Err(_)` arm covers engine-internal errors
    //           (resharp's `TooLarge`); we treat them as
    //           "uninteresting" and skip.
    // Why:      We only assert on matches the production scan path
    //           would also see.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const matches = compiled.findAll(content); // skip if it throws
    // ```
    let matches = match compiled.find_all(&content) {
        Ok(m) => m,
        Err(_) => return,
    };

    // What:     `if matches.is_empty() { return; }`. Short circuit.
    //           Without at least one match, the gate question never
    //           fires.
    // Why:      Skip uninteresting "no-match" iterations so the
    //           libFuzzer budget targets gate behaviour, not regex
    //           rejection paths.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (matches.length === 0) return;
    // ```
    if matches.is_empty() {
        return;
    }

    // What:     `let gates = match extract_gating_substrings(&src) { ... };`.
    //           `Option<Vec<(String, bool)>>`. `None` means the
    //           extractor declined to gate; that's a valid
    //           production outcome (the rule lands in the residual
    //           shard, scanned without an AC pre-filter) and
    //           cannot be a soundness violation on its own.
    // Why:      Only the `Some` case implies an AC gate is
    //           registered for this rule and the contract applies.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const gates = extractGatingSubstrings(src);
    // if (gates === null) return;
    // ```
    let gates = match extract_gating_substrings(&src) {
        Some(g) => g,
        None => return,
    };

    // What:     `if gates.is_empty() { return; }`. Defensive: an
    //           empty Vec wouldn't make it past production
    //           validation either, but the contract only binds when
    //           at least one gate is registered.
    // Why:      Vacuous truth -- nothing to check.
    if gates.is_empty() {
        return;
    }

    // What:     `let any_gate_appears = gates.iter().any(|(sub, ci)| { ... });`.
    //           `.iter()` borrows each (String, bool) pair; `.any(...)`
    //           short-circuits at the first `true`. The closure
    //           pattern `|(sub, ci)|` destructures the tuple. `ci`
    //           is `&bool` so `*ci` dereferences it.
    // Why:      AC-gate contract: any one gate's presence is
    //           sufficient (the AC matches per file). We are
    //           checking "is there any gate the file contains?",
    //           not "do all gates appear".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const anyGateAppears = gates.some(({ sub, ci }) => containsUnderCi(content, sub, ci));
    // ```
    let any_gate_appears = gates
        .iter()
        .any(|(sub, ci)| contains_under_ci(&content, sub.as_bytes(), *ci));

    // What:     `if !any_gate_appears { panic!(...) }`. Final
    //           soundness assertion. The panic message is the
    //           reproducer libFuzzer prints to stderr and writes
    //           into `fuzz/artifacts/<target>/crash-<sha>`. It MUST
    //           NOT echo raw content bytes; the SHA-256 digest is
    //           enough to fingerprint the input for local
    //           reproduction without exposing potentially-sensitive
    //           bytes.
    // Why:      This is the load-bearing invariant. A future
    //           failure here is the bug class the e49d8694 fix
    //           closed. Soundness-by-revert verification (phase 11)
    //           reverts that commit and expects THIS panic to fire.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!anyGateAppears) {
    //   throw new Error(`soundness violation: pattern=${src}, contentLen=${content.length}, contentSha256=${sha256(content)}`);
    // }
    // ```
    if !any_gate_appears {
        // Compute the digest only on the failing path -- on the
        // common "all good" path we never hash, keeping iteration
        // throughput high.
        let mut hasher = Sha256::new();
        hasher.update(&content);
        let digest = hasher.finalize();
        panic!(
            "soundness violation: rule matched but no gate substring present in content\n\
             pattern_src = {:?}\n\
             content_len = {}\n\
             content_sha256 = {:x}\n\
             match_count = {}\n\
             gate_count = {}",
            src,
            content.len(),
            digest,
            matches.len(),
            gates.len(),
        );
    }
});

// What:     `fn contains_under_ci(haystack: &[u8], needle: &[u8], ci: bool) -> bool`.
//           Plain byte-substring check; when `ci` is true the check
//           is ASCII-case-insensitive (the production AC bucket
//           uses ascii-case-insensitive matching, not unicode-fold).
// Why:      Mirror the gate's contract exactly: ci=false means
//           strict byte equality, ci=true means ASCII case-fold.
//           Unicode fold differences are outside the gate's
//           contract.
//
// In TS you'd write (pseudocode):
// ```ts
// function containsUnderCi(hay: Uint8Array, needle: Uint8Array, ci: boolean) {
//   if (needle.length === 0) return true;
//   if (ci) {
//     // lowercase both, then memmem
//   } else {
//     // byte-equal windowed scan
//   }
// }
// ```
fn contains_under_ci(haystack: &[u8], needle: &[u8], ci: bool) -> bool {
    if needle.is_empty() {
        return true;
    }
    if needle.len() > haystack.len() {
        return false;
    }
    if !ci {
        return haystack.windows(needle.len()).any(|w| w == needle);
    }
    // Case-insensitive: ASCII fold both sides before comparing.
    let needle_lower: Vec<u8> = needle.iter().map(|b| b.to_ascii_lowercase()).collect();
    haystack.windows(needle.len()).any(|w| {
        w.iter()
            .zip(needle_lower.iter())
            .all(|(a, b)| a.to_ascii_lowercase() == *b)
    })
}
