// What:     `fuzz_regex_engine_dispatch` verifies the
//           `compile_rule_src` routing decision matches the
//           AST-level truth. We control the AST: if the generator
//           emitted `&`, `~(...)`, lookaround, or bare `_`, the
//           production string-walking classifier
//           (`requires_resharp`) must agree, and `compile_rule_src`
//           must return the `Resharp` variant. Conversely, a tree
//           with NO such constructs must route to `Plain`.
// Why:      Routing mis-classifications are a silent-correctness
//           bug class: a rule meant for resharp routed to regex
//           crashes with "lookbehind not supported" at compile
//           time (caught); a rule meant for regex routed to
//           resharp is far slower but still produces correct
//           matches (uncaught, performance-only). The opposite
//           failure -- bare `_` routed to regex -- silently
//           changes meaning (wildcard becomes literal underscore)
//           and was the bug class commit 9b41fca0 closed.

#![no_main]

use libfuzzer_sys::fuzz_target;

use forbidden_strings::fuzz_api::*;
use forbidden_strings_fuzz::generators::RuleAndContent;
use sha2::{Digest, Sha256};

fuzz_target!(|input: RuleAndContent| {
    let src = input.rule.render();

    // What:     `let expected_resharp = input.rule.body.has_resharp_features();`.
    //           AST-level truth: we generated the tree, we know
    //           whether it contains algebra/lookaround/bare-underscore.
    // Why:      Compare against `requires_resharp(src)` and
    //           `compile_rule_src`'s variant.
    let expected_resharp = input.rule.body.has_resharp_features();

    // What:     `let classifier_says_resharp = requires_resharp(&src);`.
    //           The production string-walking classifier.
    // Why:      One end of the invariant.
    let classifier_says_resharp = requires_resharp(&src);

    // What:     `if expected_resharp && !classifier_says_resharp { panic!(...); }`.
    //           Asymmetric assertion: if the AST has a resharp-only
    //           construct, the classifier MUST route to resharp.
    //           The converse (classifier says resharp but AST does
    //           not) is allowed because `requires_resharp` is
    //           conservative -- it can over-route (e.g. it currently
    //           triggers on a bare `_` even inside a `(?:_)` group
    //           where it might be argued to be safe; over-routing
    //           is a perf hit, not a soundness bug).
    // Why:      Under-routing IS a soundness bug: bare `_` routed
    //           to regex silently changes meaning. We only assert
    //           the safe direction.
    if expected_resharp && !classifier_says_resharp {
        let mut hasher = Sha256::new();
        hasher.update(&src);
        let digest = hasher.finalize();
        panic!(
            "routing under-classification: AST has resharp-only feature \
             but requires_resharp returned false\n\
             pattern_src = {:?}\n\
             pattern_sha256 = {:x}",
            src,
            digest,
        );
    }

    // What:     `if src.contains('&') && src.contains('|') { return; }`.
    //           Skip the compile-dispatch comparison below (but NOT the
    //           under-classification assert above) for any rule that
    //           combines intersection (`&`) with alternation (`|`).
    // Why:      resharp 0.6.x can fall into UNBOUNDED mutual recursion in
    //           its algebra distribution when intersection meets a nested,
    //           flagged/anchored alternation operand. The cycle is
    //           mk_union -> iter_union(attempt_rw_inter_2) -> mk_inter ->
    //           attempt_rw_union_2 -> mk_union, distributing `A & (B|C)`
    //           into `(A&B)|(A&C)` without reaching a fixpoint, so
    //           `Regex::new` overflows the stack (ASAN: stack-overflow)
    //           and aborts. It is uncatchable (SIGABRT, not absorbed by a
    //           1 GB stack) and has no safe consumer-side pre-validator: a
    //           guard broad enough to catch it also rejects real rules
    //           like the AWS-key line `(?:A3T...|AKIA|...)&~(AKIA2{16})`,
    //           which use a positive alternation under intersection and
    //           compile fine. See doc/troubleshooting/resharp.md
    //           ("intersection over alternation"). The check is crude
    //           (it counts `&`/`|` even inside classes); over-skipping is
    //           safe here because it only drops the dispatch comparison
    //           for some `&`+`|` rules, never the soundness assert above.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (src.includes("&") && src.includes("|")) return;
    // ```
    if src.contains('&') && src.contains('|') {
        return;
    }
    // What:     `let compiled = match compile_rule_src(&src) { ... };`.
    //           Compile and skip rejections. Routing comparison
    //           only fires on successful compiles.
    let compiled = match compile_rule_src(&src) {
        Ok(c) => c,
        Err(_) => return,
    };

    // What:     `let dispatch_is_resharp = matches!(compiled, CompiledRegex::Resharp(_));`.
    //           `matches!` is a macro that returns `bool` for
    //           whether the value matches the pattern -- terser
    //           than `match compiled { CompiledRegex::Resharp(_) => true, _ => false }`.
    // Why:      Final invariant: compile_rule_src's dispatch must
    //           agree with the classifier.
    let dispatch_is_resharp = matches!(compiled, CompiledRegex::Resharp(_));

    if dispatch_is_resharp != classifier_says_resharp {
        let mut hasher = Sha256::new();
        hasher.update(&src);
        let digest = hasher.finalize();
        panic!(
            "dispatch disagrees with classifier:\n\
             requires_resharp = {}\n\
             compiled_variant_is_resharp = {}\n\
             pattern_src = {:?}\n\
             pattern_sha256 = {:x}",
            classifier_says_resharp,
            dispatch_is_resharp,
            src,
            digest,
        );
    }

    // What:     Smoke-run `find_all` against the synthesized content
    //           on the chosen engine. The plan-level cross-engine
    //           comparison would require exposing both engine
    //           compile entry points through `fuzz_api`; we defer
    //           that until a measurable need arises. For now the
    //           panic-freedom check on the routed engine catches
    //           shape regressions either side could introduce.
    // Why:      Cheap; ensures the engine actually accepts the
    //           rule the routing classifier sent it.
    let _ = compiled.find_all(&input.content);
});
