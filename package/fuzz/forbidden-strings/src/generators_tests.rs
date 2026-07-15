// What:     Unit tests for the structured generator's renderer (`Node`,
//           `ClassNode`, `RuleSrc`). This sidecar file is pulled in by
//           `#[cfg(test)] #[path = "generators_tests.rs"] mod tests;` at the
//           bottom of `generators.rs`, so it compiles only under
//           `cargo nextest run --lib` / `cargo test` and reaches the
//           generator types via `use super::*` (super == `generators`).
// Why:      Pin the Unicode-literal render round-trip: a regression that
//           re-encodes bytes as Latin-1 chars produces mojibake source that
//           silently stops matching its own content, blinding the
//           soundness-by-revert fuzz harness.

use super::*;

// What:     Regression test for the Unicode-literal render bug.
//           `Node::Literal(b"caf\xc3\xa9")` must render to a
//           String whose UTF-8 byte representation equals
//           the original byte slice -- NOT mojibake re-encoding.
// Why:      The bug (pre-fix) pushed each byte as a Latin-1
//           char, so byte 0xC3 became char U+00C3 (UTF-8
//           bytes 0xC3 0x83). The rendered source had
//           mojibake bytes that didn't match the content's
//           real UTF-8 bytes, so `find_all` returned 0 matches
//           on every Unicode-letter rule and the
//           soundness-by-revert fuzz never observed the panic.
//           This test fails the moment the renderer regresses.
#[test]
fn literal_render_preserves_utf8() {
    let bytes = b"caf\xc3\xa9";
    let node = Node::Literal(bytes.to_vec());
    let mut out = String::new();
    node.render(&mut out);
    assert_eq!(
        out.as_bytes(),
        bytes,
        "Node::Literal render must preserve UTF-8 byte stream exactly"
    );
}

// What:     Regression test for `Node::Class` and `Node::NegClass`
//           (same `b as char` shape as Literal). Class bodies
//           currently only contain ASCII bytes per
//           `ClassNode::arbitrary`, but the renderer must still
//           be UTF-8-safe for future generator expansion.
#[test]
fn class_render_preserves_utf8() {
    let mut out = String::new();
    Node::Class(ClassNode { bytes: b"a-z".to_vec() }).render(&mut out);
    assert_eq!(out, "[a-z]");
    let mut out2 = String::new();
    Node::NegClass(ClassNode { bytes: b"a-z".to_vec() }).render(&mut out2);
    assert_eq!(out2, "[^a-z]");
}

// What:     End-to-end check: a `(?iu)<Unicode-literal>` rule
//           rendered through `RuleSrc::render` must produce
//           source bytes that, when re-parsed as a regex,
//           match the literal byte sequence in content.
// Why:      Round-trip property: rule render -> compile -> match
//           content -> hit. The pre-fix renderer broke this
//           round-trip for Unicode literals.
#[test]
fn rule_render_round_trips_unicode_literal() {
    use forbidden_strings::fuzz_api::compile_rule_src;
    let rule = RuleSrc {
        flags: Some(FlagSet {
            include_i: true,
            include_u: true,
            negate_i: false,
        }),
        body: Node::Literal(b"caf\xc3\xa9".to_vec()),
    };
    let src = rule.render();
    assert!(
        src.as_bytes().windows(2).any(|w| w == [0xc3, 0xa9]),
        "rendered src must contain raw UTF-8 bytes of é: {:?}",
        src.as_bytes()
    );
    let compiled = compile_rule_src(&src).expect("compile (?iu)café");
    let content = b"prefix_caf\xc3\xa9_suffix";
    let matches = compiled.find_all(content).expect("find_all OK");
    assert!(!matches.is_empty(), "regex (?iu)café must match its own literal bytes in content");
}
