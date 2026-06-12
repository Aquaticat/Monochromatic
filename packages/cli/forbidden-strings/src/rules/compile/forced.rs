// FS_FORCE_ENGINE benchmark machinery, split out of `compile.rs` to keep
// that file inside the 300-code-line budget. Everything here serves the
// A/B/C benchmark variants only; production routing never enters this
// module beyond the cheap `forced_engine()` check in `compile_rule_src`.

// What:     `use resharp::Regex;` imports the resharp regex type.
// Why:      `compile_forced_resharp` constructs resharp engines directly
//           when the C-variant pins resharp as the sole engine.
// TS map:   `import { Regex } from "resharp";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Regex } from "resharp";
// ```
use resharp::Regex;

// What:     `use std::panic::{catch_unwind, AssertUnwindSafe};` brings
//           the panic-recovery primitives into scope for the
//           compile-time wrap on `Regex::new`. Full primer at the same
//           import in `src/rules/engine.rs`: `catch_unwind(closure)`
//           runs the closure with an unwind barrier so an inner
//           `panic!` becomes the outer `Err` arm; `AssertUnwindSafe`
//           asserts the captures are sound across that boundary.
// Why:      Resharp 0.5.x through 0.6.x `Regex::new` panics on some
//           rule shapes; without the barrier one bad rule would abort
//           the whole parallel compile phase.
// TS map:   `try { ... } catch (e) { ... }`.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent. Rust requires catch_unwind + AssertUnwindSafe to
// // intercept panics across a closure boundary.
// ```
use std::panic::{catch_unwind, AssertUnwindSafe};

// What:     `use super::{...};` imports from the parent `compile` module:
//           the `CompiledRegex` output type, the `requires_resharp`
//           routing classifier, the `expand_unicode_whitespace` source
//           rewrite, and the production plain-rule compiler that the
//           forced-regex path falls back to for ordinary rules. `super`
//           means "the module above this one"; a child module may use
//           the parent's private items, so no visibility changes were
//           needed in `compile.rs` for this split.
// Why:      The forced paths must compile through the exact same
//           building blocks as production so the benchmark measures
//           engine cost, not pipeline differences.
// TS map:   `import { compilePlainRuleToCompiled, expandUnicodeWhitespace, CompiledRegex, requiresResharp } from "../compile";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import {
//   compilePlainRuleToCompiled,
//   expandUnicodeWhitespace,
//   CompiledRegex,
//   requiresResharp,
// } from "../compile";
// ```
use super::{compile_plain_rule_to_compiled, expand_unicode_whitespace, CompiledRegex, requires_resharp};

// What:     `FS_FORCE_ENGINE` overrides the per-rule engine routing for
//           the A/B/C benchmark variants. Unset (production): each rule
//           routes by `requires_resharp` (regex crate unless it needs
//           set-algebra/lookaround). `regex`: force every rule through the
//           regex crate; rules that genuinely need resharp features fail
//           closed (the consumer must decompose them in user space, the
//           "B" variant). `resharp`: force every rule through resharp's
//           engine (the "C" variant), so the regex crate is never used.
//           `pub(super)` makes the function visible to the parent
//           `compile` module only (siblings of `pub`: `pub` everywhere,
//           `pub(crate)` whole crate); the dispatch in
//           `compile_rule_src` is its only intended caller.
// Why:      Lets one binary measure resharp-as-sole-engine vs
//           regex-as-sole-engine over real file trees without forking the
//           whole pipeline. Read once per process via a `OnceLock`.
// TS map:   `const FORCE = process.env.FS_FORCE_ENGINE;`
pub(super) fn forced_engine() -> Option<&'static str> {
    use std::sync::OnceLock;
    static FORCE: OnceLock<Option<String>> = OnceLock::new();
    // Baked default for the "C" worktree variant: this binary pins the
    // resharp engine (UnicodeMode::Default) unless FS_FORCE_ENGINE
    // overrides it at runtime (resharp-ascii selects UnicodeMode::Ascii).
    //
    // What:     `.unwrap_or_else(|_| "resharp".to_string())` substitutes
    //           the baked engine name when the env var is absent; the
    //           closure form defers the `String` allocation to the miss
    //           path. `Some(...)` wraps it because the production
    //           signature models "no override" as `None`, which this
    //           variant never reports.
    // Why:      The C benchmark binary must behave as all-resharp without
    //           any environment setup.
    // TS map:   `const FORCE = process.env.FS_FORCE_ENGINE ?? "resharp";`
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const FORCE = process.env.FS_FORCE_ENGINE ?? "resharp";
    // ```
    FORCE
        .get_or_init(|| Some(std::env::var("FS_FORCE_ENGINE").unwrap_or_else(|_| "resharp".to_string())))
        .as_deref()
}

// What:     Whether a single engine is pinned (env override, or a baked
//           default in the B/C worktree variants). Drives the load path's
//           skip-and-count behavior in `rules.rs`. `pub` (not
//           `pub(super)`) because `rules.rs`, two modules up, imports it
//           through `compile`'s re-export.
// Why:      The skip-and-count gate must agree with `forced_engine()`, not
//           read the env var independently, so a baked default still gets
//           the coverage-gap-tolerant load instead of fail-fast.
pub fn engine_is_forced() -> bool {
    forced_engine().is_some()
}

// What:     Compile one rule with resharp as the pinned engine.
//           `pub(super)` limits visibility to the parent `compile`
//           module, whose `compile_rule_src` dispatch is the only
//           caller.
// Why:      The C benchmark variant must route every rule through
//           resharp, including ones production would send to the regex
//           crate.
// TS map:   `function compileForcedResharp(src: string): CompiledRegex`.
pub(super) fn compile_forced_resharp(src: &str) -> Result<CompiledRegex, String> {
    // `resharp` / `resharp-default` use Regex::new (UnicodeMode::Default,
    // 2-byte `\w`). `resharp-ascii` pins UnicodeMode::Ascii so `\w`/`\d`/`\s`
    // are 1-byte, isolating the engine's cost from the Unicode-mode cost: the
    // betterleaks secret rules are ASCII tokens, so Ascii mode is the
    // semantically correct sole-engine config to compare against the regex
    // crate's ASCII-first path.
    let ascii = forced_engine() == Some("resharp-ascii");
    let caught = catch_unwind(AssertUnwindSafe(|| {
        if ascii {
            resharp::Regex::with_options(
                src,
                resharp::RegexOptions::default().unicode(resharp::UnicodeMode::Ascii),
            )
        } else {
            Regex::new(src)
        }
    }));
    match caught {
        Ok(Ok(re)) => Ok(CompiledRegex::Resharp(re)),
        Ok(Err(e)) => Err(format!("(resharp-forced): {:?}", e)),
        Err(_) => Err("(resharp-forced): panic during compile".to_string()),
    }
}

// What:     Split a top-level `BASE&~(E1)&~(E2)...` rule into its base
//           pattern and the list of complement-excluded shapes, scanning
//           outside character classes and respecting `\` escapes and
//           paren depth. Returns None when the rule is not exactly that
//           shape (any other resharp feature: bare `&` without `~(`, a
//           leading `~(`, lookaround, bare `_`), so the caller can report
//           it as "the regex crate cannot express this rule".
// Why:      The only resharp feature the shipped ruleset uses is
//           intersection-with-complement for placeholder exclusion; this
//           is the user-space decomposition of exactly that shape.
fn split_intersection_complement(src: &str) -> Option<(String, Vec<String>)> {
    let bytes = src.as_bytes();
    let mut base_end = None;
    let mut exclusions: Vec<String> = Vec::new();
    let mut i = 0usize;
    let mut in_class = false;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'\\' {
            i += 2;
            continue;
        }
        if c == b'[' && !in_class {
            in_class = true;
        } else if c == b']' && in_class {
            in_class = false;
        } else if c == b'&' && !in_class {
            // Must be `&~(` and everything after this point is exclusions.
            if bytes.get(i + 1) != Some(&b'~') || bytes.get(i + 2) != Some(&b'(') {
                return None;
            }
            if base_end.is_none() {
                base_end = Some(i);
            }
            // Capture the balanced `(...)` body following `~`.
            let mut depth = 0usize;
            let mut j = i + 2;
            let body_start = i + 3;
            let mut local_class = false;
            while j < bytes.len() {
                let d = bytes[j];
                if d == b'\\' {
                    j += 2;
                    continue;
                }
                if d == b'[' && !local_class {
                    local_class = true;
                } else if d == b']' && local_class {
                    local_class = false;
                } else if !local_class && d == b'(' {
                    depth += 1;
                } else if !local_class && d == b')' {
                    depth -= 1;
                    if depth == 0 {
                        break;
                    }
                }
                j += 1;
            }
            if depth != 0 {
                return None;
            }
            exclusions.push(src[body_start..j].to_string());
            i = j + 1;
            continue;
        }
        i += 1;
    }
    match base_end {
        Some(end) if !exclusions.is_empty() => Some((src[..end].to_string(), exclusions)),
        _ => None,
    }
}

// What:     Compile one rule with the regex crate as the pinned engine,
//           decomposing the one supported resharp-only shape
//           (`BASE&~(E)`) into base-find plus host-side exclusion.
//           `pub(super)` limits visibility to the parent `compile`
//           module, whose `compile_rule_src` dispatch is the only
//           caller.
// Why:      The B benchmark variant must express every rule it can in
//           regex-crate user space, and fail closed (with a countable
//           error) on the rest.
// TS map:   `function compileForcedRegex(src: string): CompiledRegex`.
pub(super) fn compile_forced_regex(src: &str) -> Result<CompiledRegex, String> {
    if requires_resharp(src) {
        // The rule uses a resharp-only feature; express it under the regex
        // crate if it is the supported intersection-with-complement shape,
        // otherwise report it as inexpressible (the B-variant coverage gap).
        if let Some((base, exclusions)) = split_intersection_complement(src) {
            let base_re = regex::bytes::RegexBuilder::new(&expand_unicode_whitespace(&base))
                .unicode(true)
                .size_limit(256 * 1024 * 1024)
                .dfa_size_limit(256 * 1024 * 1024)
                .build()
                .map_err(|e| format!("(regex-decomposed base): {:?}", e))?;
            let ex_res: Result<Vec<_>, String> = exclusions
                .iter()
                .map(|ex| {
                    regex::bytes::RegexBuilder::new(&format!("^(?:{})$", expand_unicode_whitespace(ex)))
                        .unicode(true)
                        .size_limit(256 * 1024 * 1024)
                        .build()
                        .map_err(|e| format!("(regex-decomposed exclusion): {:?}", e))
                })
                .collect();
            return Ok(CompiledRegex::Decomposed {
                base: base_re,
                exclusions: ex_res?,
            });
        }
        return Err(format!(
            "(regex-forced): rule uses a resharp-only feature the regex crate cannot express: {:?}",
            src
        ));
    }
    compile_plain_rule_to_compiled(src)
}
