// What:     `generators.rs` defines bounded structured `Arbitrary`
//           types that produce regex source strings plus matching
//           content bytes for every fuzz target. The two top-level
//           types are `RuleSrc` (which renders to the `(?flags)body`
//           form `compile_rule_src` expects) and `RuleAndContent`
//           (which pairs a `RuleSrc` with a content slice seeded
//           from the rule's rendered literal bytes so the
//           extract-gate soundness target actually exercises the
//           invariant instead of rejecting empty matches).
// Why:      Plan §6 caps the search space (literals ≤16 B, concats
//           ≤4, alternations ≤3, depth ≤6, set-algebra nodes ≤2,
//           content ≤4 KiB). Coverage-guided fuzzing needs those
//           bounds: an unbounded `derive(Arbitrary)` would burn all
//           libFuzzer's input bytes on tree depth and never expose
//           coverage in the scan path. The bounds turn the byte
//           stream into a deterministic AST whose small mutations
//           libFuzzer can still propagate through to scan coverage.
//
// In TS you'd write (pseudocode):
// ```ts
// // type RuleAndContent = { rule: RuleSrc; content: Uint8Array };
// // type RuleSrc = { flags: FlagSet | null; body: Node };
// // function genRuleAndContent(rng): RuleAndContent { ... }
// ```

// What:     `use arbitrary::{Arbitrary, Result, Unstructured};` brings
//           in the `Arbitrary` trait (the entry point libFuzzer calls
//           per input), the crate's own `Result<T> = Result<T, Error>`
//           type alias, and `Unstructured` (the cursor over the raw
//           fuzzer-supplied byte slice). Siblings the reader might
//           expect: `arbitrary::Error` (returned as `Err` when the
//           byte stream runs out) -- we don't import it directly
//           because we only ever return `Result<...>` already mapped.
// Why:      Every type with `impl<'a> Arbitrary<'a> for T` needs
//           these three names in scope; `derive(Arbitrary)` does too
//           via macro expansion.
//
// In TS you'd write (pseudocode):
// ```ts
// import type { Arbitrary, Result, Unstructured } from "arbitrary";
// ```
use arbitrary::{Arbitrary, Result, Unstructured};

//region Bounds (plan §6 caps)

// What:     `pub const MAX_DEPTH: u8 = 6;` declares a compile-time
//           constant of type `u8` (8-bit unsigned integer, range
//           0..=255). Siblings: `u16`, `u32`, `u64`, `usize`. `pub`
//           lets fuzz targets reference the bound in assertions /
//           seed sizing.
// Why:      Plan §6 sets the depth cap at 6. Past this depth the
//           generator returns only leaf nodes so byte budget gets
//           spent on construct variety, not tree depth.
//
// In TS you'd write (pseudocode):
// ```ts
// export const MAX_DEPTH = 6;
// ```
pub const MAX_DEPTH: u8 = 6;

// What:     `pub const MAX_CONCAT: usize = 4;`. `usize` is the
//           platform-width unsigned integer used for collection
//           lengths (siblings: `u32`, `u64`); `Vec::len` returns
//           `usize`.
// Why:      Plan §6: concatenations capped at 4 elements.
//
// In TS you'd write (pseudocode):
// ```ts
// export const MAX_CONCAT = 4;
// ```
pub const MAX_CONCAT: usize = 4;

// What:     `pub const MAX_ALT: usize = 3;`. Alternation branches
//           cap. `|` separates branches in regex; 3 branches means
//           up to 2 `|` characters at one level.
// Why:      Plan §6 caps alternation breadth at 3.
//
// In TS you'd write (pseudocode):
// ```ts
// export const MAX_ALT = 3;
// ```
pub const MAX_ALT: usize = 3;

// What:     `pub const MAX_ALGEBRA_NODES: u8 = 2;`. Counts resharp
//           set-algebra operators (`A&B`, `~(A)`) produced in one
//           rule. Tracked separately from depth because algebra
//           costs more parser work per node.
// Why:      Plan §6 caps set-algebra nodes at 2.
//
// In TS you'd write (pseudocode):
// ```ts
// export const MAX_ALGEBRA_NODES = 2;
// ```
pub const MAX_ALGEBRA_NODES: u8 = 2;

// What:     `pub const MAX_LITERAL_BYTES: usize = 16;`. Upper bound
//           on a single `Literal` node's byte width before
//           rendering.
// Why:      Plan §6: literal atoms ≤16 B. Keeps short patterns
//           short so the byte budget reaches more constructs.
//
// In TS you'd write (pseudocode):
// ```ts
// export const MAX_LITERAL_BYTES = 16;
// ```
pub const MAX_LITERAL_BYTES: usize = 16;

// What:     `pub const MAX_CONTENT_BYTES: usize = 4096;`. Upper
//           bound on the haystack passed to `scan_content` /
//           regex matchers / AC gates.
// Why:      Plan §6: content capped at 4 KiB so scans stay fast
//           enough for libFuzzer's tight iteration loop.
//
// In TS you'd write (pseudocode):
// ```ts
// export const MAX_CONTENT_BYTES = 4096;
// ```
pub const MAX_CONTENT_BYTES: usize = 4096;

//endregion Bounds

//region Top-level pair: RuleAndContent

// What:     `#[derive(Debug)] pub struct RuleAndContent { ... }`
//           bundles a generated rule source with a content slice.
//           `#[derive(Debug)]` auto-generates a `Debug` impl so
//           libFuzzer can print the value on a crash; we don't
//           derive `Arbitrary` because the content needs to be
//           derived FROM the rule (see correlation note below),
//           not independently.
// Why:      The extract-gate soundness invariant only fires when
//           content contains the rule's literal bytes -- random
//           independent content almost never matches a random
//           pattern. Coupling rule and content during generation
//           guarantees most inputs are "match-able", so the gate
//           soundness check runs on every iteration.
//
// In TS you'd write (pseudocode):
// ```ts
// type RuleAndContent = { rule: RuleSrc; content: Uint8Array };
// ```
#[derive(Debug)]
pub struct RuleAndContent {
    pub rule: RuleSrc,
    pub content: Vec<u8>,
}

// What:     `impl<'a> Arbitrary<'a> for RuleAndContent { ... }`. The
//           `<'a>` is a lifetime parameter -- it ties the byte
//           buffer the fuzzer hands `Unstructured` to the slices the
//           impl reads from it. Siblings: `<'static>` (lives for
//           the whole program), `<'b>` (any other generic
//           lifetime); we use `'a` because the same lifetime gets
//           plumbed through every nested `Arbitrary` call.
// Why:      Manual impl (not derive) so the content can be built
//           AFTER the rule renders, biased toward the rule's
//           literal bytes.
//
// In TS you'd write (pseudocode):
// ```ts
// // class RuleAndContent {
// //   static arbitrary(u: Unstructured) {
// //     const rule = RuleSrc.arbitrary(u);
// //     const content = synthContent(rule, u);
// //     return new RuleAndContent(rule, content);
// //   }
// // }
// ```
impl<'a> Arbitrary<'a> for RuleAndContent {
    fn arbitrary(u: &mut Unstructured<'a>) -> Result<Self> {
        // What:     `let rule = RuleSrc::arbitrary(u)?;`. Generates
        //           the rule first. `?` is the propagation
        //           operator: on `Err`, return that error from the
        //           enclosing function; on `Ok`, unwrap the inner
        //           value.
        // Why:      Content synthesis depends on what literals the
        //           rule contains. Generating the rule first lets
        //           us extract its rendered literals and weave them
        //           through the content.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const rule = RuleSrc.arbitrary(u);
        // ```
        let rule = RuleSrc::arbitrary(u)?;

        // What:     `let content = synth_content(&rule, u)?;`. `&rule`
        //           borrows the rule immutably; the helper inspects
        //           it but does not move ownership.
        // Why:      Content is bytes that try to MATCH the rule
        //           (and sometimes diverge by one byte to exercise
        //           AC-gate edge cases).
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const content = synthContent(rule, u);
        // ```
        let content = synth_content(&rule, u)?;

        // What:     `Ok(RuleAndContent { rule, content })`. Tail
        //           expression: constructs the success variant of
        //           `Result`, wraps a struct literal that uses field
        //           init shorthand (`rule` and `content` already
        //           match the field names).
        // Why:      Hand the bundle back to libFuzzer.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { rule, content };
        // ```
        Ok(RuleAndContent { rule, content })
    }
}

//endregion Top-level pair

//region Top-level multi-rule pair

// What:     `pub const MAX_RULES: usize = 8;`. Cap on rules per
//           ruleset for the multi-rule fuzz inputs.
// Why:      Plan §7.2 / §7.6 use a "bounded ruleset". 8 rules is
//           plenty to exercise rule-order invariance without
//           blowing libFuzzer's byte budget per iteration.
pub const MAX_RULES: usize = 8;

// What:     `#[derive(Debug)] pub struct RulesetAndContent { ... }`.
//           Bundles a bounded collection of `RuleSrc` values
//           (each renderable to a file-form `/body/flags` line)
//           with a content slice seeded from the rules' literals.
// Why:      `fuzz_ruleset_scan_invariants` and `fuzz_residual_shards`
//           need many rules at once; one-shot
//           `load_ruleset_from_source` makes the input shape match
//           production.
//
// In TS you'd write (pseudocode):
// ```ts
// type RulesetAndContent = { rules: RuleSrc[]; content: Uint8Array };
// ```
#[derive(Debug)]
pub struct RulesetAndContent {
    pub rules: Vec<RuleSrc>,
    pub content: Vec<u8>,
}

impl<'a> Arbitrary<'a> for RulesetAndContent {
    fn arbitrary(u: &mut Unstructured<'a>) -> Result<Self> {
        // What:     `let n = u.int_in_range(1usize..=MAX_RULES)?;`. At
        //           least one rule, at most MAX_RULES. Reading the
        //           count up-front keeps libFuzzer mutations on the
        //           ruleset shape stable.
        // Why:      Empty rulesets are uninteresting (no scan work);
        //           start at 1.
        let n = u.int_in_range(1usize..=MAX_RULES)?;
        let mut rules: Vec<RuleSrc> = Vec::with_capacity(n);
        for _ in 0..n {
            rules.push(RuleSrc::arbitrary(u)?);
        }
        // What:     Synth content: walk each rule, collect literals,
        //           interleave with random filler, apply few-byte
        //           mutations. Implementation reuses `Node::collect_literals`
        //           via per-rule iteration.
        // Why:      Plan correlation rule: independent content rarely
        //           matches; bias toward the rules' rendered literals.
        let mut literals: Vec<Vec<u8>> = Vec::new();
        for r in &rules {
            r.body.collect_literals(&mut literals);
        }
        let content = synth_content_from_literals(&literals, u)?;
        Ok(RulesetAndContent { rules, content })
    }
}

// What:     `fn synth_content_from_literals(literals, u) -> Result<Vec<u8>>`.
//           Same shape as `synth_content` but takes a pre-collected
//           literal pool instead of a single rule.
// Why:      Shared bytes-generation helper for the multi-rule case.
fn synth_content_from_literals(
    literals: &[Vec<u8>],
    u: &mut Unstructured<'_>,
) -> Result<Vec<u8>> {
    let mut out: Vec<u8> = Vec::with_capacity(256);
    let prefix_len = u.int_in_range(0usize..=64)?;
    for _ in 0..prefix_len {
        out.push(u.int_in_range(b'a'..=b'z')?);
    }
    if !literals.is_empty() {
        for lit in literals {
            if out.len() + lit.len() > MAX_CONTENT_BYTES {
                break;
            }
            out.extend_from_slice(lit);
            let gap = u.int_in_range(0usize..=4)?;
            for _ in 0..gap {
                if out.len() >= MAX_CONTENT_BYTES {
                    break;
                }
                out.push(u.int_in_range(b'a'..=b'z')?);
            }
        }
    }
    let trailing = u.int_in_range(0usize..=64)?;
    for _ in 0..trailing {
        if out.len() >= MAX_CONTENT_BYTES {
            break;
        }
        out.push(u.int_in_range(b'a'..=b'z')?);
    }
    let mutations = u.int_in_range(0u8..=4)?;
    for _ in 0..mutations {
        if out.is_empty() {
            break;
        }
        let idx = u.int_in_range(0usize..=(out.len() - 1))?;
        out[idx] = u.int_in_range(0u8..=255)?;
    }
    out.truncate(MAX_CONTENT_BYTES);
    Ok(out)
}

// What:     `impl RulesetAndContent { pub fn file_source(&self) -> String }`.
//           Renders the rules into a multi-line rules-file string
//           that `load_ruleset_from_source` can consume directly.
//           Rules whose flags include negation (no file-form
//           expression) or whose body contains `/` (which would
//           confuse the parser) are dropped.
// Why:      Drop-not-error keeps the fuzz iteration alive even when
//           a particular rule shape isn't expressible in file form;
//           we still get useful coverage on the surviving rules.
//
// In TS you'd write (pseudocode):
// ```ts
// function fileSource(rs) {
//   return rs.rules.map(fileFormLine).filter(Boolean).join("\n");
// }
// ```
impl RulesetAndContent {
    pub fn file_source(&self) -> String {
        let mut out = String::new();
        for r in &self.rules {
            if let Some(line) = r.file_form_line() {
                out.push_str(&line);
                out.push('\n');
            }
        }
        out
    }
}

//endregion Top-level multi-rule pair

//region RuleSrc + flags

// What:     `#[derive(Debug)] pub struct RuleSrc { ... }`. A regex
//           source: optional inline-flag prefix plus a pattern
//           body. `to_string()` (see below) renders to the
//           `(?flags)body` form `compile_rule_src` consumes directly.
// Why:      The plan distinguishes the file-form `/body/flags`
//           (parsed by `parse_rule_source`) from the internal form
//           `(?flags)body` (compiled by `compile_rule_src`). Fuzz
//           targets call `compile_rule_src` directly, so we render
//           internal form.
//
// In TS you'd write (pseudocode):
// ```ts
// type RuleSrc = { flags: FlagSet | null; body: Node };
// ```
#[derive(Debug)]
pub struct RuleSrc {
    pub flags: Option<FlagSet>,
    pub body: Node,
}

// What:     `#[derive(Debug, Arbitrary)] pub struct FlagSet { ... }`.
//           Three optional inline flags the parser supports: `i`
//           (case-insensitive), `u` (unicode-mode), and an
//           explicit negation (`-i`). `derive(Arbitrary)` is safe
//           because the type is a fixed-size POD with no recursion;
//           the derived impl reads four bytes total. Siblings the
//           reader might expect: a richer set (e.g. `x`, `s`, `m`)
//           -- we restrict to the three the loader currently
//           accepts to keep the byte budget useful.
// Why:      Flag combinations are part of plan §6's "inline flag
//           groups" requirement. The combination matrix is small
//           enough that fixed booleans + derive suffices; no need
//           for `int_in_range` here.
//
// In TS you'd write (pseudocode):
// ```ts
// type FlagSet = { i: boolean; u: boolean; negateI: boolean };
// ```
#[derive(Debug)]
pub struct FlagSet {
    pub include_i: bool,
    pub include_u: bool,
    pub negate_i: bool,
}

// What:     `impl<'a> Arbitrary<'a> for FlagSet`. Manual impl that
//           biases toward `(?iu)` (i=true, u=true, negate_i=false).
//           The uniform-random derive made `(?iu)` ~12.5%; biasing
//           to ~50% concentrates fuzz effort on the case-fold
//           soundness shape that requires both flags.
// Why:      The soundness panic (target's reason for existing)
//           requires a rule with `(?iu)` PLUS a Unicode literal in
//           the body PLUS case-flipped content. Random flag
//           generation diluted the relevant combo too much; 90k
//           iterations against the biased generator (plus
//           case-flipped content) failed to fire the soundness
//           assertion. Biasing flag generation is the cheapest
//           lever (no body/content changes needed) to concentrate
//           fuzz cycles on the bug class.
impl<'a> Arbitrary<'a> for FlagSet {
    fn arbitrary(u: &mut Unstructured<'a>) -> Result<Self> {
        // What:     `u.int_in_range(0u8..=3)?`. Two-bit tag picks
        //           one of four pre-defined flag shapes; reads 1
        //           byte instead of the 3 the derive would.
        // Why:      Concentrate 50% of fuzz iterations on the
        //           soundness-relevant `(?iu)` shape; leave a
        //           quarter for `(?i)` alone, an eighth for `(?u)`
        //           alone, and the remaining eighth for `(?-i)`
        //           (negate). The original uniform random reached
        //           `(?iu)` only ~12.5% of the time and other
        //           combos (e.g. `(?iu)` with `negate_i=true`)
        //           rendered confusingly; this pruned set is more
        //           productive for the target's bug class.
        let tag = u.int_in_range(0u8..=7)?;
        let (include_i, include_u, negate_i) = match tag {
            // 4/8 of cases land on the soundness shape `(?iu)`.
            0..=3 => (true, true, false),
            // 2/8 stay on `(?i)` alone (existing case-fold coverage).
            4..=5 => (true, false, false),
            // 1/8 emits `(?u)` alone.
            6 => (false, true, false),
            // 1/8 emits `(?-i)` (negate).
            _ => (false, false, true),
        };
        Ok(Self {
            include_i,
            include_u,
            negate_i,
        })
    }
}

// What:     `impl FlagSet { fn render(...) }`. Renders the struct
//           into the `(?flags)` source fragment, e.g. `(?iu)`,
//           `(?-i)`, `(?i)`, or the empty string when no flags are
//           set. Pushes onto a borrowed `&mut String` buffer.
// Why:      Building the source via `push_str` avoids intermediate
//           allocations; the caller owns the output `String`.
//
// In TS you'd write (pseudocode):
// ```ts
// function renderFlags(flags: FlagSet, out: string[]) {
//   const adds = [flags.include_i && "i", flags.include_u && "u"].filter(Boolean).join("");
//   const negs = flags.negate_i ? "i" : "";
//   if (!adds && !negs) return;
//   out.push("(?", adds, negs ? "-" : "", negs, ")");
// }
// ```
impl FlagSet {
    fn render(&self, out: &mut String) {
        // What:     `let adds = ...` builds the positive-flag prefix.
        //           `String::new()` allocates an empty owned
        //           buffer (sibling: `String::with_capacity(n)` if
        //           we knew the size up front; here we don't).
        // Why:      Concatenate the user's chosen positive flags
        //           into one string segment.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // let adds = "";
        // if (this.include_i && !this.negate_i) adds += "i";
        // if (this.include_u) adds += "u";
        // ```
        let mut adds = String::new();
        if self.include_i && !self.negate_i {
            adds.push('i');
        }
        if self.include_u {
            adds.push('u');
        }
        // What:     `let has_neg = self.negate_i;`. Plain `bool`
        //           copy; no concept-introducing punctuation.
        // Why:      Renaming for readability below.
        let has_neg = self.negate_i;
        if adds.is_empty() && !has_neg {
            // Empty flag prefix means we render nothing. The body
            // alone is the regex source.
            return;
        }
        // What:     `out.push_str("(?");`. Appends a borrowed `&str`
            //       slice to the owned `String`. `push_str` grows
            //       the buffer if needed (no overflow path); sibling
            //       `push(c)` appends a single `char`.
        // Why:      Begin the inline-flag group syntax.
        out.push_str("(?");
        out.push_str(&adds);
        if has_neg {
            out.push('-');
            out.push('i');
        }
        out.push(')');
    }
}

// What:     `impl<'a> Arbitrary<'a> for RuleSrc { ... }`. Manual
//           impl so the body is generated through the depth-tracking
//           `gen_node` helper instead of `derive(Arbitrary)`'s
//           unbounded recursion.
// Why:      `derive(Arbitrary)` on `Node` (a recursive enum) would
//           read a fresh variant choice for every recursive payload,
//           so the tree depth is bounded only by remaining bytes --
//           plenty for a stack overflow.
//
// In TS you'd write (pseudocode):
// ```ts
// // class RuleSrc { static arbitrary(u) { ... } }
// ```
impl<'a> Arbitrary<'a> for RuleSrc {
    fn arbitrary(u: &mut Unstructured<'a>) -> Result<Self> {
        // What:     `let flags = Option::<FlagSet>::arbitrary(u)?;`.
        //           Option<T> has its own derived `Arbitrary` impl:
        //           reads one byte to decide Some/None, then
        //           recurses into T on Some. The turbofish `::<FlagSet>`
        //           pins the type parameter when the compiler can't
        //           infer it. `?` propagates `Err` (out-of-bytes).
        // Why:      Half the rules carry inline flags, half don't.
        //           One byte of decision is cheap.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const flags = u.option(() => FlagSet.arbitrary(u));
        // ```
        let flags = Option::<FlagSet>::arbitrary(u)?;

        // What:     `let mut budgets = Budgets::new();`. Stack-
        //           allocated mutable struct that tracks the
        //           algebra-node counter as `gen_node` recurses.
        //           Sibling: passing `&mut u8` directly works too
        //           but reads worse at call sites.
        // Why:      Plan §6 caps algebra-node count at 2 across
        //           the whole tree; we must thread a counter
        //           through nested calls.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const budgets = { algebra: 0 };
        // ```
        let mut budgets = Budgets::new();

        // What:     `let body = gen_node(u, 0, &mut budgets)?;`.
        //           Depth starts at 0; `&mut budgets` lends the
        //           counter struct exclusively to the recursive
        //           helper for the duration of the call.
        // Why:      Generate a bounded `Node` tree.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const body = genNode(u, 0, budgets);
        // ```
        let body = gen_node(u, 0, &mut budgets)?;

        // What:     `Ok(RuleSrc { flags, body })`. Tail expression
        //           wrapping the struct in the success variant.
        // Why:      Hand back the assembled rule.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { flags, body };
        // ```
        Ok(RuleSrc { flags, body })
    }
}

// What:     `impl RuleSrc { pub fn render(&self) -> String { ... } }`.
//           Renders the rule into the `(?flags)body` form. `&self`
//           borrows immutably; the result is a newly-allocated
//           owned `String`.
// Why:      Fuzz targets pass the result straight to
//           `compile_rule_src`. Keeping the render close to the
//           struct lets every target produce the same shape.
//
// In TS you'd write (pseudocode):
// ```ts
// function renderRule(rule: RuleSrc): string { ... }
// ```
impl RuleSrc {
    pub fn render(&self) -> String {
        let mut out = String::new();
        // What:     `if let Some(flags) = &self.flags { ... }`. The
        //           one-arm pattern matches `Some(...)` and binds
        //           the inner ref `flags: &FlagSet`. `&self.flags`
        //           is the borrowed field; we don't move out of the
        //           struct.
        // Why:      Only emit a flag group when one is set.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (this.flags) renderFlags(this.flags, out);
        // ```
        if let Some(flags) = &self.flags {
            flags.render(&mut out);
        }
        // What:     `self.body.render(&mut out);`. Method call on
        //           the owned `Node`, passing the buffer through.
        // Why:      Append the pattern body after the flag prefix.
        self.body.render(&mut out);
        out
    }

    // What:     `pub fn file_form_line(&self) -> Option<String>`.
    //           Renders into the file-form `/body/flags` shape
    //           `parse_rule_source` recognises, returning `None`
    //           when the flags include negation (no file-form
    //           expression for `(?-i)`) or when the body would
    //           contain a `/` byte (the file-form parser anchors
    //           on the LAST `/`, so a body `/` would mis-parse).
    //           Sibling: `render()` (internal form for
    //           `compile_rule_src`).
    // Why:      Targets that drive the full ruleset loader need a
    //           multi-line file-form source. Internal form
    //           `(?flags)body` isn't accepted by
    //           `parse_rule_source`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // function fileFormLine(rule: RuleSrc): string | null {
    //   if (rule.flags?.negate_i) return null;
    //   const body = renderBody(rule.body);
    //   if (body.includes("/")) return null;
    //   const flags = (rule.flags?.include_i ? "i" : "") + (rule.flags?.include_u ? "u" : "");
    //   return `/${body}/${flags}`;
    // }
    // ```
    pub fn file_form_line(&self) -> Option<String> {
        if let Some(flags) = &self.flags {
            if flags.negate_i {
                return None;
            }
        }
        let mut body = String::new();
        self.body.render(&mut body);
        if body.contains('/') {
            return None;
        }
        if body.is_empty() {
            return None;
        }
        let mut flag_str = String::new();
        if let Some(flags) = &self.flags {
            if flags.include_i {
                flag_str.push('i');
            }
            if flags.include_u {
                flag_str.push('u');
            }
        }
        // What:     `let mut out = String::new();` and build
        //           `/body/flags`.
        let mut out = String::with_capacity(body.len() + flag_str.len() + 2);
        out.push('/');
        out.push_str(&body);
        out.push('/');
        out.push_str(&flag_str);
        // What:     `Some(out)`. Wrap the assembled line in Some.
        // Why:      Hand the caller a usable rules-file line.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return out;
        // ```
        Some(out)
    }
}

//endregion RuleSrc + flags

//region Budgets

// What:     `struct Budgets { algebra: u8 }`. Private bookkeeping
//           passed by `&mut` down the recursion so independent
//           subtrees collectively respect the algebra-node cap.
// Why:      Separate counter from depth lets a deep but
//           algebra-free tree explore freely while bounding
//           algebra to two nodes.
struct Budgets {
    algebra: u8,
}

impl Budgets {
    fn new() -> Self {
        Budgets { algebra: 0 }
    }
    fn can_spend_algebra(&self) -> bool {
        self.algebra < MAX_ALGEBRA_NODES
    }
    fn spend_algebra(&mut self) {
        self.algebra = self.algebra.saturating_add(1);
    }
}

//endregion Budgets

//region Node tree

// What:     `#[derive(Debug)] pub enum Node { ... }`. The pattern
//           tree. Recursive variants own their children via `Box<Node>`
//           (heap-allocated owning pointer; siblings `Rc<Node>` for
//           shared ownership, `Arc<Node>` for cross-thread shared
//           ownership -- we want neither). Each variant maps to one
//           regex construct from plan §6.
// Why:      Coverage-guided fuzzers reach more constructs faster
//           when the generator produces well-formed groups by
//           construction rather than raw `(?=` bytes the parser
//           rejects 99% of the time.
//
// In TS you'd write (pseudocode):
// ```ts
// type Node =
//   | { kind: "literal"; bytes: number[] }
//   | { kind: "concat"; parts: Node[] }
//   | { kind: "alt"; branches: Node[] }
//   | { kind: "noncap"; body: Node }
//   | { kind: "scopedFlag"; flag: "i" | "u" | "x"; body: Node }
//   | { kind: "class"; klass: ClassNode }
//   | { kind: "negClass"; klass: ClassNode }
//   | { kind: "quant"; body: Node; kind2: QuantKind }
//   | { kind: "lookaround"; dir: LookaroundDir; body: Node }
//   | { kind: "intersect"; left: Node; right: Node }
//   | { kind: "complement"; body: Node }
//   | { kind: "bareUnderscore" }
//   | { kind: "escapedUnderscore" }
//   | { kind: "underscoreClass" }
//   | { kind: "escapedLookalike"; byte: number }
//   | { kind: "unicodeWs" }
//   | { kind: "shorthand"; sym: "s" | "w" | "d" }
//   | { kind: "anchor"; sym: "^" | "$" | "\\b" }
// ;
// ```
#[derive(Debug)]
pub enum Node {
    Literal(Vec<u8>),
    Concat(Vec<Node>),
    Alt(Vec<Node>),
    NonCap(Box<Node>),
    ScopedFlag(ScopedFlagKind, Box<Node>),
    Class(ClassNode),
    NegClass(ClassNode),
    Quant(Box<Node>, QuantKind),
    Lookaround(LookaroundKind, Box<Node>),
    Intersect(Box<Node>, Box<Node>),
    Complement(Box<Node>),
    BareUnderscore,
    EscapedUnderscore,
    UnderscoreClass,
    EscapedLookalike(LookalikeByte),
    UnicodeWs(UnicodeWsByte),
    Shorthand(ShorthandKind),
    Anchor(AnchorKind),
}

// What:     `#[derive(Debug, Arbitrary)] pub enum ScopedFlagKind`.
//           Closed three-variant enum: `I`, `U`, `X` cover the
//           three scoped-flag forms `(?i:body)`, `(?u:body)`,
//           `(?x:body)` exercised by the e49d8694 / 1463c59b
//           bug-fix class.
// Why:      Plan §6 calls out scoped flags explicitly.
//           `derive(Arbitrary)` works because the type is finite
//           and non-recursive.
#[derive(Debug, Arbitrary)]
pub enum ScopedFlagKind {
    I,
    U,
    X,
}

impl ScopedFlagKind {
    fn label(&self) -> &'static str {
        match self {
            ScopedFlagKind::I => "i",
            ScopedFlagKind::U => "u",
            ScopedFlagKind::X => "x",
        }
    }
}

// What:     `#[derive(Debug, Arbitrary)] pub enum LookaroundKind`.
//           The four lookaround variants exposed in `requires_resharp`
//           (`(?=`, `(?!`, `(?<=`, `(?<!`).
// Why:      Plan §6 requires all four reachable.
#[derive(Debug, Arbitrary)]
pub enum LookaroundKind {
    Ahead,
    NotAhead,
    Behind,
    NotBehind,
}

impl LookaroundKind {
    fn open(&self) -> &'static str {
        match self {
            LookaroundKind::Ahead => "(?=",
            LookaroundKind::NotAhead => "(?!",
            LookaroundKind::Behind => "(?<=",
            LookaroundKind::NotBehind => "(?<!",
        }
    }
}

// What:     `#[derive(Debug)] pub enum QuantKind`. Quantifier
//           variants: `?` `*` `+` and the bounded `{n,m}` form.
//           `Bounded(u8, u8)` is a tuple variant: two non-negative
//           bytes; we cap the upper at u8::MAX // 4 to keep
//           generated patterns short.
// Why:      Plan §6 lists "quantifiers including bounded `{n,m}`".
#[derive(Debug)]
pub enum QuantKind {
    Star,
    Plus,
    Question,
    Bounded(u8, u8),
}

impl QuantKind {
    fn render(&self, out: &mut String) {
        match self {
            QuantKind::Star => out.push('*'),
            QuantKind::Plus => out.push('+'),
            QuantKind::Question => out.push('?'),
            QuantKind::Bounded(lo, hi) => {
                let lo_v = (*lo) as u32;
                let hi_cap = (lo_v + (*hi as u32)).min(50);
                out.push('{');
                out.push_str(&lo_v.to_string());
                out.push(',');
                out.push_str(&hi_cap.to_string());
                out.push('}');
            }
        }
    }
}

// What:     `#[derive(Debug, Arbitrary)] pub enum AnchorKind`. The
//           three anchors used in tests: start `^`, end `$`, word
//           boundary `\b`.
// Why:      Anchors influence the leading-literal extractor's
//           bypass logic.
#[derive(Debug, Arbitrary)]
pub enum AnchorKind {
    Start,
    End,
    WordBoundary,
}

// What:     `#[derive(Debug, Arbitrary)] pub enum ShorthandKind`.
//           `\s`, `\w`, `\d` shorthands. The Unicode-mode rewriter
//           (commits 0479371a, 4289cdb3) lives behind this surface.
// Why:      Plan §6: exercise unicode-shorthand handling.
#[derive(Debug, Arbitrary)]
pub enum ShorthandKind {
    S,
    W,
    D,
}

// What:     `#[derive(Debug, Arbitrary)] pub enum LookalikeByte`.
//           Closed set of "looks like a metachar but escaped" bytes
//           the walker has to handle: `\.`, `\*`, `\+`, `\?`, `\(`,
//           `\)`, `\[`, `\]`, `\|`. The walker treats them as
//           literal bytes after the backslash; the extractor must
//           survive any of them appearing in the pattern.
// Why:      Plan §6: escaped lookalikes inside and outside classes.
#[derive(Debug, Arbitrary)]
pub enum LookalikeByte {
    Dot,
    Star,
    Plus,
    Question,
    OpenParen,
    CloseParen,
    OpenBracket,
    CloseBracket,
    Pipe,
}

impl LookalikeByte {
    fn byte(&self) -> u8 {
        match self {
            LookalikeByte::Dot => b'.',
            LookalikeByte::Star => b'*',
            LookalikeByte::Plus => b'+',
            LookalikeByte::Question => b'?',
            LookalikeByte::OpenParen => b'(',
            LookalikeByte::CloseParen => b')',
            LookalikeByte::OpenBracket => b'[',
            LookalikeByte::CloseBracket => b']',
            LookalikeByte::Pipe => b'|',
        }
    }
}

// What:     `#[derive(Debug, Arbitrary)] pub enum UnicodeWsByte`.
//           A closed set of code points that `expand_unicode_whitespace`
//           rewrites. We render them as their literal UTF-8 bytes so
//           the rewriter's branches all see real input. Siblings the
//           reader might expect: other whitespace points like FF
//           (U+000C) -- excluded because the rewriter rewrites them
//           via `\s` already, not via literal byte handling.
// Why:      Plan §6: emit Unicode whitespace bytes literally so the
//           rewrite branches all fire.
#[derive(Debug, Arbitrary)]
pub enum UnicodeWsByte {
    Nbsp,
    EmSpace,
    IdeographicSpace,
}

impl UnicodeWsByte {
    fn utf8(&self) -> &'static [u8] {
        match self {
            // U+00A0 NO-BREAK SPACE -> 0xC2 0xA0
            UnicodeWsByte::Nbsp => b"\xC2\xA0",
            // U+2003 EM SPACE -> 0xE2 0x80 0x83
            UnicodeWsByte::EmSpace => b"\xE2\x80\x83",
            // U+3000 IDEOGRAPHIC SPACE -> 0xE3 0x80 0x80
            UnicodeWsByte::IdeographicSpace => b"\xE3\x80\x80",
        }
    }
}

// What:     `#[derive(Debug)] pub struct ClassNode { bytes: Vec<u8> }`.
//           Body of a `[...]` class. We emit only printable ASCII +
//           a few sentinels (`_`, `-`) so the class parser stays
//           in well-formed territory while still exercising negated
//           and nested forms (the `NegClass` variant flips the
//           leading `^`).
// Why:      Random binary bytes inside a class produce parse errors
//           99% of the time; printable ASCII + the wildcard tokens
//           gives the extractor real work without burning budget.
#[derive(Debug)]
pub struct ClassNode {
    pub bytes: Vec<u8>,
}

impl<'a> Arbitrary<'a> for ClassNode {
    fn arbitrary(u: &mut Unstructured<'a>) -> Result<Self> {
        // What:     `let n = u.int_in_range(1usize..=6)?;`. Reads a
        //           bounded count from the byte stream. `1usize`
        //           pins the type to `usize` (sibling: `u32`); the
        //           range `1..=6` is inclusive on both ends.
        // Why:      Keep class body short so quantifier / nesting
        //           coverage gets more of the budget.
        let n = u.int_in_range(1usize..=6)?;
        // What:     `let mut bytes: Vec<u8> = Vec::with_capacity(n);`.
        //           Pre-allocates `n` bytes' worth of capacity in
        //           one heap allocation. Sibling: `Vec::new()` (no
        //           up-front capacity).
        // Why:      We know how many bytes we want; avoid the
        //           grow-and-reallocate cycle.
        let mut bytes: Vec<u8> = Vec::with_capacity(n);
        // What:     `for _ in 0..n { ... }`. Counted loop using a
        //           range expression. The `_` ignores the iteration
        //           variable.
        // Why:      Build `n` printable bytes for the class body.
        for _ in 0..n {
            // What:     `let pick = u.int_in_range(0u8..=4)?;`. Five
            //           variant choices: lowercase letter, digit,
            //           range syntax `a-z`, underscore, hyphen
            //           literal.
            // Why:      Bias toward the byte families the extractor
            //           cares about.
            let pick = u.int_in_range(0u8..=4)?;
            match pick {
                0 => bytes.push(b'a' + u.int_in_range(0u8..=25)?),
                1 => bytes.push(b'0' + u.int_in_range(0u8..=9)?),
                2 => {
                    let lo = b'a' + u.int_in_range(0u8..=20)?;
                    let span = u.int_in_range(1u8..=5)?;
                    bytes.push(lo);
                    bytes.push(b'-');
                    bytes.push(lo + span);
                }
                3 => bytes.push(b'_'),
                _ => bytes.push(b'-'),
            }
        }
        // What:     `Ok(ClassNode { bytes })`. Tail expression.
        // Why:      Hand the class back to the caller.
        Ok(ClassNode { bytes })
    }
}

//endregion Node tree

//region Node Arbitrary + render

// What:     `fn gen_node(u, depth, budgets) -> Result<Node>`. Picks
//           one variant per call. Variant selection reads ONE byte
//           up front (`u.int_in_range`) so libFuzzer's single-byte
//           mutations land on variant choices, not payloads. At max
//           depth only leaf variants are reachable.
// Why:      Bounded recursion; libFuzzer mutation stability.
//
// In TS you'd write (pseudocode):
// ```ts
// function genNode(u, depth, budgets) {
//   if (depth >= MAX_DEPTH) return genLeaf(u);
//   const tag = u.intInRange(0, 16);
//   // ... switch on tag ...
// }
// ```
fn gen_node(u: &mut Unstructured<'_>, depth: u8, budgets: &mut Budgets) -> Result<Node> {
    if depth >= MAX_DEPTH {
        return gen_leaf(u);
    }
    // What:     `let tag = u.int_in_range(0u8..=15)?;`. 16 variants
    //           in the choice space below; one byte picks among
    //           them.
    // Why:      Stable byte->AST mapping.
    let tag = u.int_in_range(0u8..=15)?;
    let next_depth = depth + 1;
    match tag {
        0 => gen_leaf(u),
        1 => {
            // Concat: 2..=MAX_CONCAT children.
            let n = u.int_in_range(2usize..=MAX_CONCAT)?;
            let mut parts: Vec<Node> = Vec::with_capacity(n);
            for _ in 0..n {
                parts.push(gen_node(u, next_depth, budgets)?);
            }
            Ok(Node::Concat(parts))
        }
        2 => {
            // Alt: 2..=MAX_ALT branches.
            let n = u.int_in_range(2usize..=MAX_ALT)?;
            let mut parts: Vec<Node> = Vec::with_capacity(n);
            for _ in 0..n {
                parts.push(gen_node(u, next_depth, budgets)?);
            }
            Ok(Node::Alt(parts))
        }
        3 => Ok(Node::NonCap(Box::new(gen_node(u, next_depth, budgets)?))),
        4 => {
            let kind = ScopedFlagKind::arbitrary(u)?;
            let body = gen_node(u, next_depth, budgets)?;
            Ok(Node::ScopedFlag(kind, Box::new(body)))
        }
        5 => Ok(Node::Class(ClassNode::arbitrary(u)?)),
        6 => Ok(Node::NegClass(ClassNode::arbitrary(u)?)),
        7 => {
            let body = gen_node(u, next_depth, budgets)?;
            let kind = gen_quant(u)?;
            Ok(Node::Quant(Box::new(body), kind))
        }
        8 => {
            let kind = LookaroundKind::arbitrary(u)?;
            let body = gen_node(u, next_depth, budgets)?;
            Ok(Node::Lookaround(kind, Box::new(body)))
        }
        9 if budgets.can_spend_algebra() => {
            budgets.spend_algebra();
            let lhs = gen_node(u, next_depth, budgets)?;
            let rhs = gen_node(u, next_depth, budgets)?;
            Ok(Node::Intersect(Box::new(lhs), Box::new(rhs)))
        }
        10 if budgets.can_spend_algebra() => {
            budgets.spend_algebra();
            let body = gen_node(u, next_depth, budgets)?;
            Ok(Node::Complement(Box::new(body)))
        }
        // The remaining tags (and the "algebra over budget" fallthrough)
        // produce leaves so the byte budget gets spent on construct
        // variety instead of unbounded depth re-entry.
        _ => gen_leaf(u),
    }
}

// What:     `fn gen_leaf(u) -> Result<Node>`. Picks among the leaf
//           variants without recursing.
// Why:      Called both at max depth and as part of `gen_node`'s
//           variant space; centralising leaf selection keeps both
//           paths consistent.
fn gen_leaf(u: &mut Unstructured<'_>) -> Result<Node> {
    let tag = u.int_in_range(0u8..=10)?;
    match tag {
        0 => Ok(Node::Literal(gen_literal_bytes(u)?)),
        1 => Ok(Node::BareUnderscore),
        2 => Ok(Node::EscapedUnderscore),
        3 => Ok(Node::UnderscoreClass),
        4 => Ok(Node::EscapedLookalike(LookalikeByte::arbitrary(u)?)),
        5 => Ok(Node::UnicodeWs(UnicodeWsByte::arbitrary(u)?)),
        6 => Ok(Node::Shorthand(ShorthandKind::arbitrary(u)?)),
        7 => Ok(Node::Anchor(AnchorKind::arbitrary(u)?)),
        // Fallback variants bias toward literals so the AC gate
        // actually has something to match.
        _ => Ok(Node::Literal(gen_literal_bytes(u)?)),
    }
}

// What:     `fn gen_literal_bytes(u) -> Result<Vec<u8>>`. Reads a
//           short slice (≤MAX_LITERAL_BYTES) and filters it to a
//           safe alphabet so the renderer doesn't have to escape
//           every byte. Six picks: lowercase ASCII, uppercase
//           ASCII, digit, symbol, space, and a Unicode lowercase
//           letter pair (`é`/`ñ`/`ü`/`ö`/`ç`). The Unicode pick
//           writes BOTH UTF-8 bytes of the chosen letter so the
//           resulting literal stays valid UTF-8 even when the
//           surrounding bytes are ASCII.
// Why:      The case-fold extraction soundness bug fixed by
//           commit `e49d8694` requires a regex literal containing
//           a non-ASCII letter whose Unicode-cased variant lives
//           outside aho-corasick's ASCII-only case-fold (e.g.
//           `é` <-> `É`). Without a non-ASCII source in the
//           alphabet, the fuzz target `fuzz_extract_gate_soundness`
//           cannot construct an input that triggers the bug class,
//           and the soundness-by-revert phase 11 validation cannot
//           panic. The Unicode pick is one of six (~17% per
//           byte position) so the bulk of generated patterns
//           stay ASCII; the rare non-ASCII literal exercises the
//           Unicode case-fold path. Five letters cover the
//           common Latin extended range; the small set keeps
//           libFuzzer's mutation surface small while still
//           providing enough variety for the dictionary plus
//           CrossOver mutations to reach the case-flipped
//           content shape `synth_content` produces.
fn gen_literal_bytes(u: &mut Unstructured<'_>) -> Result<Vec<u8>> {
    // What:     UTF-8 byte pairs for five Unicode lowercase Latin
    //           letters with distinct uppercase forms under
    //           Unicode case-fold. `synth_content` runs random
    //           single-byte mutations after embedding the
    //           literal, so libFuzzer can evolve content from
    //           `é` (0xC3 0xA9) toward `É` (0xC3 0x89) by
    //           flipping the second byte at the right index.
    // Why:      A static slice avoids re-deriving the bytes per
    //           call. Each entry is exactly the 2-byte UTF-8
    //           encoding of the lowercase letter:
    //             é  -> U+00E9 -> 0xC3 0xA9 (uppercase É 0xC3 0x89)
    //             ñ  -> U+00F1 -> 0xC3 0xB1 (uppercase Ñ 0xC3 0x91)
    //             ü  -> U+00FC -> 0xC3 0xBC (uppercase Ü 0xC3 0x9C)
    //             ö  -> U+00F6 -> 0xC3 0xB6 (uppercase Ö 0xC3 0x96)
    //             ç  -> U+00E7 -> 0xC3 0xA7 (uppercase Ç 0xC3 0x87)
    const UNICODE_LETTERS: &[&[u8]] = &[
        b"\xC3\xA9", // é
        b"\xC3\xB1", // ñ
        b"\xC3\xBC", // ü
        b"\xC3\xB6", // ö
        b"\xC3\xA7", // ç
    ];
    // What:     With ~25% probability emit a pre-shaped "soundness
    //           seed" literal: ASCII prefix + Unicode lowercase
    //           letter + ASCII suffix. Shapes like `abécret`, `café`,
    //           `secñred`. These are exactly the literal pattern the
    //           gate extractor needs to produce a gate substring
    //           that contains a Unicode letter; the case-flipped
    //           content then fires the soundness mismatch when the
    //           rule has `(?iu)` flags.
    // Why:      Random byte-pick reaches such shapes with very low
    //           probability (need 3+ random picks landing on
    //           ASCII-Unicode-ASCII in order; each has ~1/6 chance
    //           for Unicode). After 90k iterations the fuzz still
    //           hadn't found the soundness shape; this targeted
    //           pre-shape brings it to the top of the bias.
    let soundness_pick = u.int_in_range(0u8..=3)?;
    if soundness_pick == 0 {
        // Emit one of a few short ASCII-Unicode-ASCII shapes.
        const SHAPES: &[&[u8]] = &[
            b"caf\xC3\xA9",       // café
            b"a\xC3\xA9c",         // aéc
            b"sec\xC3\xB1ret",     // secñret
            b"\xC3\xB6ber",        // öber
            b"se\xC3\xA7ret",      // seçret
            b"ab\xC3\xA9cret",     // abécret
            b"r\xC3\xBCmm",        // rümm
            b"k\xC3\xB6ln",        // köln
        ];
        let idx = u.int_in_range(0usize..=(SHAPES.len() - 1))?;
        return Ok(SHAPES[idx].to_vec());
    }
    let n = u.int_in_range(1usize..=MAX_LITERAL_BYTES)?;
    let mut out: Vec<u8> = Vec::with_capacity(n);
    for _ in 0..n {
        // Reserve a small "safe" alphabet: lowercase, uppercase,
        // digits, plus a handful of symbol bytes that aren't regex
        // metacharacters; the new pick=5 branch emits a 2-byte
        // Unicode lowercase letter (BOTH bytes written together to
        // keep UTF-8 valid).
        let pick = u.int_in_range(0u8..=5)?;
        match pick {
            0 => out.push(b'a' + u.int_in_range(0u8..=25)?),
            1 => out.push(b'A' + u.int_in_range(0u8..=25)?),
            2 => out.push(b'0' + u.int_in_range(0u8..=9)?),
            3 => {
                let sym = match u.int_in_range(0u8..=4)? {
                    0 => b'-',
                    1 => b':',
                    2 => b'@',
                    3 => b'#',
                    _ => b'!',
                };
                out.push(sym);
            }
            4 => out.push(b' '),
            // What:     `_ => { let pair = ...; out.extend_from_slice(pair); }`.
            //           The pick=5 (and any future numeric drift)
            //           branch emits a multi-byte Unicode letter.
            //           Using `extend_from_slice` keeps the two
            //           UTF-8 bytes adjacent; this matters because
            //           `synth_content`'s mutation step picks a
            //           single byte index to overwrite, and the
            //           soundness violation requires both bytes
            //           to remain together in the literal source.
            // Why:      Without the adjacent-byte guarantee, a
            //           split between the 0xC3 lead and the 0xA9
            //           continuation would produce an invalid
            //           UTF-8 source string and the regex parser
            //           would reject it early -- defeating the
            //           coverage purpose.
            _ => {
                let idx = u.int_in_range(0usize..=(UNICODE_LETTERS.len() - 1))?;
                out.extend_from_slice(UNICODE_LETTERS[idx]);
            }
        }
    }
    Ok(out)
}

// What:     `fn gen_quant(u) -> Result<QuantKind>`. Picks among
//           the four quantifier shapes; the bounded variant reads
//           two extra bytes.
// Why:      `QuantKind` doesn't `derive(Arbitrary)` because the
//           bounded variant needs custom byte-range clamping.
fn gen_quant(u: &mut Unstructured<'_>) -> Result<QuantKind> {
    let tag = u.int_in_range(0u8..=3)?;
    match tag {
        0 => Ok(QuantKind::Star),
        1 => Ok(QuantKind::Plus),
        2 => Ok(QuantKind::Question),
        _ => {
            let lo = u.int_in_range(0u8..=5)?;
            let extra = u.int_in_range(0u8..=10)?;
            Ok(QuantKind::Bounded(lo, extra))
        }
    }
}

// What:     `impl Node { pub fn render(&self, out: &mut String) }`.
//           Recursively appends the regex-source rendering of the
//           node to a string buffer.
// Why:      Building output via a single shared buffer avoids
//           intermediate allocations; the buffer ends up holding
//           the complete `(?flags)body` source.
//
// In TS you'd write (pseudocode):
// ```ts
// function renderNode(node, out) {
//   switch (node.kind) { ... }
// }
// ```
// What:     `fn append_bytes_as_utf8(out: &mut String, bytes: &[u8])`
//           appends `bytes` to `out` interpreting them as a UTF-8
//           byte sequence (the literal byte stream the generator
//           produced). The previous implementation looped
//           `out.push(b as char)`, which converts each byte to its
//           Latin-1 codepoint; for multi-byte UTF-8 sequences like
//           `é` (0xC3 0xA9) the result was the mojibake
//           `Ã©` (chars U+00C3 + U+00A9, re-encoded in the String's
//           UTF-8 storage as bytes 0xC3 0x83 0xC2 0xA9). That broke
//           the round-trip from `gen_literal_bytes` (which emits
//           UTF-8 byte pairs for Unicode letters) to the rendered
//           regex source -- the compiled regex saw a different byte
//           sequence than `synth_content` embedded in the content,
//           so `find_all` returned zero matches on every Unicode
//           literal. This rendered the (?iu)+Unicode-letter
//           soundness shape unreachable through the fuzz target,
//           and was the load-bearing reason Phase 11 fuzz runs
//           never observed the soundness panic.
// Why:      `String` is UTF-8 internally; arbitrary bytes cannot
//           be appended directly. The generator's literal byte
//           streams are valid UTF-8 by construction
//           (`gen_literal_bytes` emits ASCII or full UTF-8 letter
//           pairs together), so `std::str::from_utf8` succeeds.
//           If the bytes are ever malformed (shouldn't happen),
//           fall back to lossy replacement so the renderer never
//           panics; lossy substitution preserves the round-trip
//           when the input is already valid UTF-8.
fn append_bytes_as_utf8(out: &mut String, bytes: &[u8]) {
    match std::str::from_utf8(bytes) {
        Ok(s) => out.push_str(s),
        Err(_) => out.push_str(&String::from_utf8_lossy(bytes)),
    }
}

impl Node {
    pub fn render(&self, out: &mut String) {
        match self {
            Node::Literal(bytes) => {
                append_bytes_as_utf8(out, bytes);
            }
            Node::Concat(parts) => {
                for p in parts {
                    p.render(out);
                }
            }
            Node::Alt(parts) => {
                out.push_str("(?:");
                for (i, p) in parts.iter().enumerate() {
                    if i > 0 {
                        out.push('|');
                    }
                    p.render(out);
                }
                out.push(')');
            }
            Node::NonCap(body) => {
                out.push_str("(?:");
                body.render(out);
                out.push(')');
            }
            Node::ScopedFlag(kind, body) => {
                out.push_str("(?");
                out.push_str(kind.label());
                out.push(':');
                body.render(out);
                out.push(')');
            }
            Node::Class(class) => {
                out.push('[');
                append_bytes_as_utf8(out, &class.bytes);
                out.push(']');
            }
            Node::NegClass(class) => {
                out.push_str("[^");
                append_bytes_as_utf8(out, &class.bytes);
                out.push(']');
            }
            Node::Quant(body, kind) => {
                // Wrap the operand in a non-capturing group so the
                // quantifier binds to the whole subpattern, not
                // just the last atom of a concat.
                out.push_str("(?:");
                body.render(out);
                out.push(')');
                kind.render(out);
            }
            Node::Lookaround(kind, body) => {
                out.push_str(kind.open());
                body.render(out);
                out.push(')');
            }
            Node::Intersect(lhs, rhs) => {
                out.push_str("(?:");
                lhs.render(out);
                out.push('&');
                rhs.render(out);
                out.push(')');
            }
            Node::Complement(body) => {
                out.push_str("~(");
                body.render(out);
                out.push(')');
            }
            Node::BareUnderscore => out.push('_'),
            Node::EscapedUnderscore => out.push_str("\\_"),
            Node::UnderscoreClass => out.push_str("[_]"),
            Node::EscapedLookalike(byte) => {
                out.push('\\');
                out.push(byte.byte() as char);
            }
            Node::UnicodeWs(ws) => {
                // What:     `out.push_str(std::str::from_utf8(ws.utf8()).unwrap());`.
                //           The bytes are hard-coded valid UTF-8;
                //           `unwrap()` is sound because we control
                //           the inputs in `UnicodeWsByte::utf8`.
                // Why:      Append the multibyte WS character into
                //           the source.
                out.push_str(std::str::from_utf8(ws.utf8()).expect("ws bytes are valid utf-8"));
            }
            Node::Shorthand(s) => match s {
                ShorthandKind::S => out.push_str("\\s"),
                ShorthandKind::W => out.push_str("\\w"),
                ShorthandKind::D => out.push_str("\\d"),
            },
            Node::Anchor(a) => match a {
                AnchorKind::Start => out.push('^'),
                AnchorKind::End => out.push('$'),
                AnchorKind::WordBoundary => out.push_str("\\b"),
            },
        }
    }

    // What:     `pub fn has_resharp_features(&self) -> bool`. Walks
    //           the tree looking for nodes that `requires_resharp`
    //           classifies as resharp-only: set-algebra (Intersect,
    //           Complement), lookarounds, and bare underscore. The
    //           generator produces these AST shapes; production's
    //           string-walking classifier needs to agree.
    // Why:      `fuzz_regex_engine_dispatch` compares the routing
    //           decision against the AST-level truth. AST is the
    //           ground truth here: WE choose to emit `&`, we KNOW
    //           the source has algebra.
    pub fn has_resharp_features(&self) -> bool {
        match self {
            Node::Intersect(_, _)
            | Node::Complement(_)
            | Node::Lookaround(_, _)
            | Node::BareUnderscore => true,
            Node::Literal(_)
            | Node::Class(_)
            | Node::NegClass(_)
            | Node::EscapedUnderscore
            | Node::UnderscoreClass
            | Node::EscapedLookalike(_)
            | Node::UnicodeWs(_)
            | Node::Shorthand(_)
            | Node::Anchor(_) => false,
            Node::Concat(parts) | Node::Alt(parts) => {
                parts.iter().any(|p| p.has_resharp_features())
            }
            Node::NonCap(body)
            | Node::ScopedFlag(_, body)
            | Node::Quant(body, _) => body.has_resharp_features(),
        }
    }

    // What:     `pub fn collect_literals(&self, out: &mut Vec<Vec<u8>>)`.
    //           Walks the tree and records every `Literal` payload
    //           plus the Unicode-WS bytes, NBSP, etc. into the
    //           output bucket.
    // Why:      `synth_content` uses these to bias content toward
    //           bytes that will actually match the rule.
    pub fn collect_literals(&self, out: &mut Vec<Vec<u8>>) {
        match self {
            Node::Literal(bytes) => {
                if !bytes.is_empty() {
                    out.push(bytes.clone());
                }
            }
            Node::UnicodeWs(ws) => out.push(ws.utf8().to_vec()),
            Node::Concat(parts) | Node::Alt(parts) => {
                for p in parts {
                    p.collect_literals(out);
                }
            }
            Node::NonCap(body)
            | Node::ScopedFlag(_, body)
            | Node::Quant(body, _)
            | Node::Lookaround(_, body)
            | Node::Complement(body) => body.collect_literals(out),
            Node::Intersect(lhs, rhs) => {
                lhs.collect_literals(out);
                rhs.collect_literals(out);
            }
            Node::Class(_)
            | Node::NegClass(_)
            | Node::BareUnderscore
            | Node::EscapedUnderscore
            | Node::UnderscoreClass
            | Node::EscapedLookalike(_)
            | Node::Shorthand(_)
            | Node::Anchor(_) => {}
        }
    }
}

//endregion Node Arbitrary + render

//region Content synthesis

// What:     `fn synth_content(rule, u) -> Result<Vec<u8>>`. Builds
//           a content buffer (≤MAX_CONTENT_BYTES) that begins by
//           interleaving the rule's literal bytes with filler so
//           the AC gate fires often; then applies a small number
//           of 1..=4 byte mutations to exercise edge cases (boundary
//           splits, near-misses).
// Why:      Independent random content matches the rule almost
//           never; coupling content to rule literals makes the
//           extract-gate soundness target productive on every
//           iteration.
//
// In TS you'd write (pseudocode):
// ```ts
// function synthContent(rule, u) {
//   const lits: Uint8Array[] = [];
//   collectLiterals(rule.body, lits);
//   // Interleave literals with arbitrary filler up to MAX_CONTENT_BYTES.
//   // Apply 0..=4 random single-byte mutations.
// }
// ```
fn synth_content(rule: &RuleSrc, u: &mut Unstructured<'_>) -> Result<Vec<u8>> {
    let mut literals: Vec<Vec<u8>> = Vec::new();
    rule.body.collect_literals(&mut literals);

    let mut out: Vec<u8> = Vec::with_capacity(256);

    // What:     `let prefix_len = u.int_in_range(0usize..=64)?;`.
    //           Random leading filler.
    // Why:      Forces the AC gate / regex to walk past content
    //           before finding the literal -- not all matches
    //           start at byte 0.
    let prefix_len = u.int_in_range(0usize..=64)?;
    for _ in 0..prefix_len {
        out.push(u.int_in_range(b'a'..=b'z')?);
    }

    // What:     `if !literals.is_empty() { ... }`. Embed each
    //           literal once, separated by short random filler.
    // Why:      Maximises the chance that the AC gate has reason
    //           to fire; libFuzzer can then explore what happens
    //           when the regex either matches or rejects.
    if !literals.is_empty() {
        for lit in &literals {
            if out.len() + lit.len() > MAX_CONTENT_BYTES {
                break;
            }
            out.extend_from_slice(lit);
            let gap = u.int_in_range(0usize..=4)?;
            for _ in 0..gap {
                if out.len() >= MAX_CONTENT_BYTES {
                    break;
                }
                out.push(u.int_in_range(b'a'..=b'z')?);
            }
        }
    }

    // What:     `let trailing = u.int_in_range(...)`. Append a final
    //           random tail so the matcher's end-of-input logic
    //           sees varied positions.
    // Why:      Some bugs only fire when the match is not anchored
    //           to either end.
    let trailing = u.int_in_range(0usize..=64)?;
    for _ in 0..trailing {
        if out.len() >= MAX_CONTENT_BYTES {
            break;
        }
        out.push(u.int_in_range(b'a'..=b'z')?);
    }

    // What:     Unicode case-flip bias. When the rule has BOTH `(?i)`
    //           AND `(?u)` flags (effective unicode case-insensitive
    //           matching), with ~50% probability flip every embedded
    //           Unicode lowercase letter in `out` to its uppercase form.
    //           This drives the soundness-by-revert phase 11 trigger:
    //             - Rule `(?iu)cafésecret` registers `cafésecret` in
    //               the AC-CI bucket (after the e49d8694 revert).
    //             - File content `CAFÉSECRET` doesn't fire the gate
    //               (AC uses aho-corasick's ASCII-only case-fold;
    //               É <-> é is outside that fold).
    //             - regex's find_all DOES match (under (?iu) the regex
    //               engine uses Unicode-aware case-fold).
    //             - SOUNDNESS VIOLATION: rule matched, but no gate
    //               substring is present in content.
    //           Without this bias, `synth_content` embeds the literal
    //           bytes verbatim and the gate substring is always
    //           present in content, so the soundness contract holds
    //           trivially. Random single-byte mutations almost never
    //           land on the right index AND write the right byte
    //           (specifically 0xA9 -> 0x89 for the 'é' continuation),
    //           so libFuzzer cannot evolve the case-flip without
    //           help. The bias keeps non-flipped iterations productive
    //           too (the regex still matches when content has the
    //           original literal).
    // Why:      Soundness-by-revert phase 11 was completing 120s runs
    //           clean without ever discovering the panic. The fuzz
    //           generator is the only knob; adding a targeted bias
    //           closes the gap.
    if let Some(flags) = rule.flags.as_ref() {
        if flags.include_i && flags.include_u {
            // What:     `u.int_in_range(0u8..=1)? == 0` is the 50%
            //           coin flip controlled by libFuzzer's mutator.
            // Why:      Not 100% so the non-flipped path stays
            //           exercised too (extract returns gate; regex
            //           matches; gate appears; no panic; iteration
            //           is still useful for coverage).
            let flip = u.int_in_range(0u8..=1)? == 0;
            if flip {
                let mut idx = 0;
                while idx + 1 < out.len() {
                    if out[idx] == 0xC3 {
                        match out[idx + 1] {
                            0xA9 => out[idx + 1] = 0x89, // é -> É
                            0xB1 => out[idx + 1] = 0x91, // ñ -> Ñ
                            0xBC => out[idx + 1] = 0x9C, // ü -> Ü
                            0xB6 => out[idx + 1] = 0x96, // ö -> Ö
                            0xA7 => out[idx + 1] = 0x87, // ç -> Ç
                            _ => {}
                        }
                        idx += 2;
                    } else {
                        idx += 1;
                    }
                }
            }
        }
    }

    // What:     Single-byte mutations. Plan §6 final bullet: bias
    //           toward rendered literals plus single-byte mutations.
    let mutations = u.int_in_range(0u8..=4)?;
    for _ in 0..mutations {
        if out.is_empty() {
            break;
        }
        let idx = u.int_in_range(0usize..=(out.len() - 1))?;
        let new_byte = u.int_in_range(0u8..=255)?;
        out[idx] = new_byte;
    }

    // What:     `out.truncate(MAX_CONTENT_BYTES);`. Hard cap on the
    //           returned buffer.
    out.truncate(MAX_CONTENT_BYTES);
    Ok(out)
}

//endregion Content synthesis

// What:     `#[cfg(test)] #[path = "generators_tests.rs"] mod tests;`
//           declares a test-only submodule whose code lives in the sibling
//           file `generators_tests.rs`. `#[cfg(test)]` gates it to test
//           builds; `#[path = "..."]` aims the module at a flat sibling file
//           instead of the default `generators/tests.rs` subdirectory
//           lookup. The file stays the `tests` CHILD of `generators`, so its
//           `use super::*` reaches the generator types unchanged.
// Why:      Keep `generators.rs` to the generator itself; the renderer
//           regression tests live beside it. The `test` mise task runs them
//           via `cargo nextest run --lib`.
//
// In TS you'd write (pseudocode):
// ```ts
// // generators.unit.test.ts, run only by the test runner
// ```
#[cfg(test)]
#[path = "generators_tests.rs"]
mod tests;
