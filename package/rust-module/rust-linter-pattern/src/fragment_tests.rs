//! Unit tests for the fragment cascade.

/// Imports the cascade under test.
use crate::fragment::{parse, FragmentKind};

// What:     These cases are the ones measured against ra_ap_syntax 0.0.335
//           during design, before any of this was written.
// Why:      The cascade exists BECAUSE no single entry point accepts all three
//           shapes. Pinning each shape here means a future parser bump that
//           changes which entry point accepts what fails loudly rather than
//           silently making some patterns stop matching.
/// An expression snippet parses through the expression entry point.
#[test]
fn expression_snippet_parses_as_an_expression() {
    let fragment = parse("META_X.unwrap()").expect("should parse");

    assert_eq!(fragment.kind, FragmentKind::Expression, "kind");
    assert_eq!(
        format!("{:?}", fragment.root.kind()),
        "METHOD_CALL_EXPR",
        "root node kind"
    );
}

/// An item snippet parses through the file entry point, attributes included.
#[test]
fn item_snippet_parses_as_an_item() {
    let fragment = parse("#[test]\nfn META_F() {}").expect("should parse");

    assert_eq!(fragment.kind, FragmentKind::Item, "kind");
    assert_eq!(format!("{:?}", fragment.root.kind()), "FN", "root node kind");
}

/// A struct is an item too.
#[test]
fn struct_snippet_parses_as_an_item() {
    let fragment = parse("struct META_S;").expect("should parse");

    assert_eq!(fragment.kind, FragmentKind::Item, "kind");
}

// What:     The shape that fails BOTH other entry points.
// Why:      A statement is neither an item nor an expression, so it only parses
//           inside a function body. This is the case that forces the cascade to
//           have a third step rather than two.
/// A statement snippet parses through the synthetic wrapper.
#[test]
fn statement_snippet_parses_as_a_statement() {
    let fragment = parse("let META_A = 1;").expect("should parse");

    assert_eq!(fragment.kind, FragmentKind::Statement, "kind");
    assert_eq!(
        format!("{:?}", fragment.root.kind()),
        "LET_STMT",
        "root node kind"
    );
}

/// The wrapper is stripped, so matching never sees the synthetic function.
#[test]
fn statement_fragment_excludes_the_wrapper() {
    let fragment = parse("let META_A = 1;").expect("should parse");

    assert!(
        !fragment.root.text().to_string().contains("wrapper"),
        "the synthetic function must not survive into the pattern: {}",
        fragment.root.text()
    );
}

// What:     The ast-grep spelling, asserted NOT to work.
// Why:      `$X` is what a reader coming from ast-grep or semgrep will try
//           first. It yields errors through every entry point here, because `$`
//           is only a token inside a macro definition. Pinning the failure is
//           what makes the `META_` convention a measured decision rather than a
//           stylistic one.
/// The ast-grep dollar spelling does not parse.
#[test]
fn dollar_metavariable_does_not_parse() {
    assert!(
        parse("$X.unwrap()").is_none(),
        "the ast-grep spelling is not usable with this parser"
    );
}

/// Nonsense does not parse as anything.
#[test]
fn unparseable_snippet_is_absent() {
    assert!(parse("fn fn fn ((").is_none(), "unbalanced nonsense");
}

/// An empty snippet is absent rather than matching everything.
#[test]
fn empty_snippet_is_absent() {
    assert!(parse("").is_none(), "empty");
    assert!(parse("   \n  ").is_none(), "whitespace only");
}

/// Surrounding whitespace does not change what a snippet parses as.
#[test]
fn surrounding_whitespace_is_ignored() {
    let fragment = parse("\n   META_X.unwrap()  \n").expect("should parse");

    assert_eq!(fragment.kind, FragmentKind::Expression, "still an expression");
}
