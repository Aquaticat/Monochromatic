// What:     `use super::nesting::nesting_depth;` pulls the pre-validator
//           under test into scope. `super` is the parent module
//           (`crate::rules`), `nesting` its child module, `nesting_depth`
//           the function. No runtime cost; a name-resolution directive.
// Why:      The tests below call `nesting_depth` directly to exercise the
//           depth scan without going through the whole compile pipeline.
//
// In TS you'd write (pseudocode):
// ```ts
// import { nestingDepth } from "./nesting";
// ```
use super::nesting::nesting_depth;

// What:     `fn nesting_depth_fires_above_cap()` is a `#[test]` function:
//           the attribute marks it for the test runner. It builds a rule
//           nested 1,001 groups deep and asserts the validator flags it.
// Why:      The 1,001-deep shape is one past the 1,000 cap, the smallest
//           input that must be rejected; below the resharp overflow floor
//           but the case Bug G's defense exists for.
//
// In TS you'd write (pseudocode):
// ```ts
// it("nesting_depth fires above the cap", () => {
//   const src = "(".repeat(1001) + "a" + ")".repeat(1001);
//   expect(nestingDepth(src)).not.toBeNull();
// });
// ```
#[test]
fn nesting_depth_fires_above_cap() {
    // What:     `"(".repeat(1001)` allocates an owned `String` of 1,001
    //           open parens; `+ "a" +` appends a literal atom; `&")"...`
    //           borrows the closing-paren `String` so `+` can append it.
    //           The `&` is a read-only borrow, not a move.
    // Why:      Construct a balanced 1,001-deep nesting so `max_depth`
    //           reaches 1,001, one over the cap.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const src = "(".repeat(1001) + "a" + ")".repeat(1001);
    // ```
    let src = "(".repeat(1001) + "a" + &")".repeat(1001);
    // What:     `.is_some()` returns `true` when the `Option` is the
    //           present (`Some`) variant. `assert!(cond, msg)` panics
    //           (fails the test) when `cond` is false.
    // Why:      A rule deeper than the cap must produce a rejection reason.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(nestingDepth(src)).not.toBeNull();
    // ```
    assert!(
        nesting_depth(&src).is_some(),
        "expected nesting_depth to fire on a 1,001-deep rule",
    );
}

// What:     `fn nesting_depth_passes_at_cap()` builds a rule nested
//           exactly 1,000 deep and asserts the validator does NOT fire.
// Why:      The cap is inclusive on the passing side (`> cap` fires), so
//           1,000 must be accepted; this pins the exact boundary.
//
// In TS you'd write (pseudocode):
// ```ts
// it("nesting_depth passes at the cap", () => {
//   const src = "(".repeat(1000) + "a" + ")".repeat(1000);
//   expect(nestingDepth(src)).toBeNull();
// });
// ```
#[test]
fn nesting_depth_passes_at_cap() {
    let src = "(".repeat(1000) + "a" + &")".repeat(1000);
    // What:     `.is_none()` is `true` for the absent (`None`) variant.
    // Why:      Exactly-at-cap nesting is within the limit and must pass.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(nestingDepth(src)).toBeNull();
    // ```
    assert!(
        nesting_depth(&src).is_none(),
        "expected nesting_depth to pass a 1,000-deep rule (cap is inclusive)",
    );
}

// What:     `fn nesting_depth_skips_shallow_real_rules()` asserts the
//           validator passes the real, shallow rule shapes the scanner
//           actually uses.
// Why:      Over-rejection is safe but pointless if it hits production
//           rules; these must stay accepted.
//
// In TS you'd write (pseudocode):
// ```ts
// it("nesting_depth skips shallow real rules", () => {
//   for (const src of [...]) expect(nestingDepth(src)).toBeNull();
// });
// ```
#[test]
fn nesting_depth_skips_shallow_real_rules() {
    // What:     A fixed-size array `[&str; 3]` of borrowed string literals.
    //           `&str` is a borrowed view; sibling `String` would own.
    // Why:      Representative production-shaped rules: a complement, a
    //           lookahead, and the literal-whitespace exclusion workaround.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const cases = ["~(.*foo.*)", "(?=bar)baz", "em&~(.* (npm|git) .*)"];
    // ```
    let cases = ["~(.*foo.*)", "(?=bar)baz", "em&~(.* (npm|git) .*)"];
    // What:     `for case in cases` iterates the array by value (each
    //           `case` is a `&str`). `case` is the loop binding.
    // Why:      Check every representative rule passes the validator.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const c of cases) { expect(nestingDepth(c)).toBeNull(); }
    // ```
    for case in cases {
        assert!(
            nesting_depth(case).is_none(),
            "expected nesting_depth to skip shallow rule {case:?}",
        );
    }
}

// What:     `fn nesting_depth_ignores_escaped_and_class_parens()` asserts
//           parens that are escaped or inside a `[...]` character class do
//           NOT count toward depth.
// Why:      Those parens are literal content, not groups; counting them
//           would over-reject ordinary literal rules.
//
// In TS you'd write (pseudocode):
// ```ts
// it("nesting_depth ignores escaped and class parens", () => {
//   expect(nestingDepth("\\(".repeat(2000))).toBeNull();
//   expect(nestingDepth("[" + "(".repeat(2000) + "]")).toBeNull();
// });
// ```
#[test]
fn nesting_depth_ignores_escaped_and_class_parens() {
    // What:     `r"\("` is a raw string literal (the `r` prefix disables
    //           backslash escaping), so it is the two bytes backslash and
    //           open-paren. `.repeat(2000)` builds 2,000 escaped parens.
    // Why:      2,000 escaped `\(` would exceed the cap if miscounted;
    //           since each is escaped, depth must stay 0.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const escaped = "\\(".repeat(2000);
    // ```
    let escaped = r"\(".repeat(2000);
    assert!(
        nesting_depth(&escaped).is_none(),
        "escaped parens must not count toward nesting depth",
    );
    // What:     Build `[` + 2,000 `(` + `]`: a single character class whose
    //           body is parens. `+ &"...".repeat(...)` borrows the repeated
    //           string to append it.
    // Why:      Parens inside a class are literal members; depth must stay 0.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const inClass = "[" + "(".repeat(2000) + "]";
    // ```
    let in_class = "[".to_string() + &"(".repeat(2000) + "]";
    assert!(
        nesting_depth(&in_class).is_none(),
        "parens inside a character class must not count toward nesting depth",
    );
}

// What:     `fn compile_rule_src_rejects_deeply_nested_complement()`
//           drives the full pipeline and asserts a deeply nested
//           complement rule is rejected before resharp's `Regex::new`.
// Why:      End-to-end proof that the pre-validator is wired into
//           `compile_rule_src` on the resharp path, so the production
//           scanner never hands the overflowing shape to resharp.
//
// In TS you'd write (pseudocode):
// ```ts
// it("compile_rule_src rejects deeply nested complement", () => {
//   const src = "~(".repeat(1001) + "a" + ")".repeat(1001);
//   const r = compileRuleSrc(src);
//   expect(r.kind).toBe("err");
// });
// ```
#[test]
fn compile_rule_src_rejects_deeply_nested_complement() {
    // What:     `use crate::rule::compile_rule_src;` brings the pipeline
    //           entry point into this function's scope (absolute path from
    //           the crate root).
    // Why:      Exercise the real routing: `~(` makes the rule require
    //           resharp, so it enters the branch the validator guards.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // import { compileRuleSrc } from "../rules";
    // ```
    use crate::rule::compile_rule_src;
    // What:     `"~(".repeat(1001)` builds 1,001 complement-group opens
    //           (`~(`), each contributing one `(`, so depth reaches 1,001.
    // Why:      A complement-nested shape both requires resharp and exceeds
    //           the cap, the exact Bug G danger case.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const src = "~(".repeat(1001) + "a" + ")".repeat(1001);
    // ```
    let src = "~(".repeat(1001) + "a" + &")".repeat(1001);
    // What:     `compile_rule_src(&src)` returns `Result<CompiledRegex,
    //           String>`. `match` extracts the variant: `Ok(_)` is success
    //           (must not happen here), `Err(reason)` is the rejection.
    // Why:      Assert the pipeline rejects with a `(resharp):`-prefixed
    //           reason rather than compiling and risking the abort.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { compileRuleSrc(src); fail("expected rejection"); }
    // catch (e) { expect(String(e)).toContain("(resharp):"); }
    // ```
    match compile_rule_src(&src) {
        Ok(_) => panic!("expected deeply nested complement to be rejected"),
        Err(reason) => assert!(
            reason.to_string().contains("(resharp):") && reason.to_string().contains("nests groups"),
            "expected a nesting-depth rejection, got {reason:?}",
        ),
    }
}
