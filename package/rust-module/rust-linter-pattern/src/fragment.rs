//! Parsing a pattern snippet, whatever kind of Rust fragment it is.

// What:     `use ra_ap_syntax::{ast, Edition, SourceFile, SyntaxNode};`
//           imports rust-analyzer's syntax crate. Naming a crate directly, with
//           no `crate::` prefix, is what marks it external.
// Why:      The cascade below calls two different parse entry points and walks
//           the resulting tree.
//
// In TS you'd write (pseudocode):
// ```ts
// import { ast, Edition, SourceFile, SyntaxNode } from "<rust-parser>";
// ```
/// Imports the parser entry points and tree types the cascade uses.
use ra_ap_syntax::{ast, Edition, SourceFile, SyntaxKind, SyntaxNode};

// What:     `pub enum FragmentKind { .. }` names the three shapes a pattern
//           snippet can take.
// Why:      Rust has no single "parse anything" entry point. An item, an
//           expression and a statement are parsed by different means, and which
//           one a snippet is decides how it is parsed and what it can match.
//
// In TS you'd write (pseudocode):
// ```ts
// type FragmentKind = "item" | "expression" | "statement";
// ```
/// Which kind of Rust fragment a pattern snippet turned out to be.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum FragmentKind {
    /// A whole item, such as `fn f() {}` or `struct S;`.
    Item,

    /// An expression, such as `META_X.unwrap()`.
    Expression,

    /// A statement, such as `let META_A = 1;`.
    Statement,
}

// What:     `pub struct Fragment { .. }` is a successfully parsed snippet.
// Why:      Matching needs the tree, and reporting needs to know which entry
//           point produced it, because a statement fragment's tree carries a
//           synthetic wrapper that must not be matched against.
/// A pattern snippet, parsed into a syntax tree.
#[derive(Debug)]
pub struct Fragment {
    /// Which entry point parsed this snippet.
    pub kind: FragmentKind,

    /// Root of the parsed fragment, with any synthetic wrapper stripped.
    pub root: SyntaxNode,
}

// What:     `const WRAPPER_PREFIX` and `WRAPPER_SUFFIX` bracket a statement so
//           it can be parsed as part of something Rust accepts.
// Why:      A statement is neither an item nor an expression, so neither entry
//           point takes one. Wrapping it in a function body is the only way to
//           parse `let a = 1;` at all, verified against ra_ap_syntax 0.0.335.
/// Text prepended to a statement snippet so it parses.
const WRAPPER_PREFIX: &str = "fn __rust_linter_pattern_wrapper() { ";

/// Text appended to a statement snippet so it parses.
const WRAPPER_SUFFIX: &str = " }";

// What:     `pub fn parse(snippet: &str) -> Option<Fragment>`. Tries three entry
//           points in order and keeps the first that reports no errors, or
//           answers absent when none does.
// Why:      Measured, not assumed. Against ra_ap_syntax 0.0.335:
//           `META_X.unwrap()` through `SourceFile::parse` yields five errors and
//           an `ERROR` root, but through `ast::Expr::parse` yields zero errors
//           and a `METHOD_CALL_EXPR`. `#[test] fn META_F() {}` is the reverse.
//           And `let META_A = 1;` fails BOTH, because a statement is neither an
//           item nor an expression, and only parses inside a function body.
//           So a pattern format cannot have one parse entry point, and rather
//           than making the author declare which kind they wrote, the kind is
//           detected by trying each.
//
// In TS you'd write (pseudocode):
// ```ts
// function parse(snippet: string): Fragment | undefined
// ```
/// Parse a pattern snippet, detecting which kind of fragment it is.
pub fn parse(snippet: &str) -> Option<Fragment> {
    let trimmed = snippet.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Item first: it is the broadest entry point, and the only one that accepts
    // attributes, so `#[test] fn f() {}` is recognised as one fragment.
    let as_file = SourceFile::parse(trimmed, Edition::CURRENT);
    if as_file.errors().is_empty()
        && let Some(item) = first_child_node(&as_file.syntax_node())
    {
        return Some(Fragment {
            kind: FragmentKind::Item,
            root: item,
        });
    }

    // Expression next. `ast::Expr::parse` is documented to panic from `.tree()`
    // when the root is not a valid expression, so the error list is checked
    // first and `syntax_node()` is used rather than `tree()`.
    let as_expression = ast::Expr::parse(trimmed, Edition::CURRENT);
    if as_expression.errors().is_empty() {
        return Some(Fragment {
            kind: FragmentKind::Expression,
            root: as_expression.syntax_node(),
        });
    }

    // Statement last, wrapped in a synthetic function body.
    let wrapped = format!("{WRAPPER_PREFIX}{trimmed}{WRAPPER_SUFFIX}");
    let as_statement = SourceFile::parse(&wrapped, Edition::CURRENT);
    if as_statement.errors().is_empty()
        && let Some(statement) = first_statement(&as_statement.syntax_node())
    {
        return Some(Fragment {
            kind: FragmentKind::Statement,
            root: statement,
        });
    }

    return None;
}

// What:     `fn first_child_node(root: &SyntaxNode) -> Option<SyntaxNode>`.
//           Returns the first real node under a parsed file.
// Why:      `SourceFile::parse` always yields a `SOURCE_FILE` root, and matching
//           against that would compare the file wrapper rather than the item the
//           author wrote.
/// Return the first node beneath a parsed file root.
fn first_child_node(root: &SyntaxNode) -> Option<SyntaxNode> {
    // `.children()` walks direct child NODES, skipping tokens, so whitespace
    // between the file start and the item does not come back.
    return root.children().next();
}

// What:     `fn first_statement(root: &SyntaxNode) -> Option<SyntaxNode>`.
//           Digs the statement back out of the synthetic wrapper.
// Why:      The wrapper exists only to make the snippet parse. Matching against
//           it would compare a function nobody wrote, so the tree handed back is
//           the statement itself.
/// Return the first statement inside the synthetic wrapper function.
fn first_statement(root: &SyntaxNode) -> Option<SyntaxNode> {
    // `.descendants()` walks every node beneath the root, in source order, so
    // the first `STMT_LIST` found is the wrapper's own body.
    let statements = root
        .descendants()
        .find(|node| return node.kind() == SyntaxKind::STMT_LIST)?;

    return statements.children().next();
}
