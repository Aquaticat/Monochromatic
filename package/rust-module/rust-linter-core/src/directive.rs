//! Inline suppression directives, and the rules governing when they are obeyed.
//!
//! Directives are comments, not attributes. That is forced rather than
//! preferred: `#[allow(monochromatic::max_lines)]` fails on stable with
//! `error[E0710]: unknown tool name`, and the fix rustc suggests,
//! `#![register_tool(monochromatic)]`, is nightly-only. A third-party tool
//! therefore cannot use Rust's own suppression syntax at all.

/// Applying directives to findings, and reporting the ones that did nothing.
pub mod apply;

/// Imports the parsed per-file context directives are read from.
use crate::context::LintContext;
/// Imports the source-range type each directive reports at.
use crate::span::Span;

// What:     `pub const PREFIX: &str = "rust-linter-";`. The token every
//           directive starts with, named once.
// Why:      Four directive spellings share it, and a literal repeated across
//           them is a rename waiting to go wrong.
/// Prefix every directive comment begins with.
pub const PREFIX: &str = "rust-linter-";

// What:     `pub const JUSTIFICATION_SEPARATOR: &str = "--";`.
// Why:      The same separator oxlint uses, so a reader who knows
//           `// oxlint-disable-next-line rule -- reason` already knows this.
/// Separator between a directive's rule list and its justification.
pub const JUSTIFICATION_SEPARATOR: &str = "--";

// What:     `pub enum DirectiveKind { .. }` names the four shapes a directive
//           takes, which differ only in the lines they govern.
// Why:      The scope is the whole behaviour, and expressing it as a type means
//           the applier cannot forget one.
//
// In TS you'd write (pseudocode):
// ```ts
// type DirectiveKind = "disable" | "enable" | "disable-line" | "disable-next-line";
// ```
/// Which lines a directive governs.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DirectiveKind {
    /// Suppresses from this line until a matching enable, or end of file.
    Disable,

    /// Ends the effect of an earlier `Disable`.
    Enable,

    /// Suppresses on the line the comment itself sits on.
    DisableLine,

    /// Suppresses on the line after the comment.
    DisableNextLine,
}

/// Parsing helpers for directive kinds.
impl DirectiveKind {
    /// Parse a directive kind from the text following the prefix.
    pub fn parse(text: &str) -> Option<Self> {
        // Longest first: `disable-next-line` also starts with `disable`, so
        // testing `disable` first would match it and swallow the rest.
        if text.starts_with("disable-next-line") {
            return Some(DirectiveKind::DisableNextLine);
        } else if text.starts_with("disable-line") {
            return Some(DirectiveKind::DisableLine);
        } else if text.starts_with("disable") {
            return Some(DirectiveKind::Disable);
        } else if text.starts_with("enable") {
            return Some(DirectiveKind::Enable);
        } else {
            return None;
        }
    }

    /// Return the directive word as written, for error messages.
    pub fn name(&self) -> &'static str {
        if *self == DirectiveKind::DisableNextLine {
            return "disable-next-line";
        } else if *self == DirectiveKind::DisableLine {
            return "disable-line";
        } else if *self == DirectiveKind::Disable {
            return "disable";
        } else {
            return "enable";
        }
    }

    /// Return how many characters the kind's own word occupies.
    fn width(&self) -> usize {
        return self.name().len();
    }
}

// What:     `pub struct Directive { .. }` is one parsed comment.
// Why:      Everything the applier and the reporter need, resolved once at parse
//           time rather than re-derived from the comment text later.
/// One inline suppression directive, as written in the source.
#[derive(Clone, Debug)]
pub struct Directive {
    /// Which lines this directive governs.
    pub kind: DirectiveKind,

    // What:     `rules: Vec<String>`, EMPTY meaning every rule.
    // Why:      `// rust-linter-disable-next-line -- reason` with no rule named
    //           is the broad form, matching oxlint. An empty list says that
    //           without needing a separate variant.
    /// Rules this directive targets; empty means every rule.
    pub rules: Vec<String>,

    // What:     `justification: Option<String>`, absent when the author wrote
    //           none.
    // Why:      Absence is itself a violation here, so it has to be
    //           representable rather than defaulted to an empty string.
    /// Text after the `--` separator, absent when the author supplied none.
    pub justification: Option<String>,

    /// One-based line the directive comment sits on.
    pub line: usize,

    /// Source range of the directive comment, for reporting it.
    pub span: Span,
}

/// Interrogation helpers for parsed directives.
impl Directive {
    // What:     `pub fn targets(&self, plugin: &str, rule_id: &str) -> bool`.
    // Why:      A directive may name rules with or without their plugin prefix,
    //           exactly as the config file may, so one rule's two spellings
    //           resolve the same way wherever they appear.
    /// Report whether this directive targets the given rule.
    pub fn targets(&self, plugin: &str, rule_id: &str) -> bool {
        // An empty list is the broad form: every rule.
        if self.rules.is_empty() {
            return true;
        }

        let qualified = format!("{plugin}/{rule_id}");

        // `.any(closure)` is true when the closure accepts at least one element.
        return self
            .rules
            .iter()
            .any(|named| return named == rule_id || *named == qualified);
    }

    // What:     `pub fn governs(&self, line: usize) -> bool`. Answers for the
    //           two single-line kinds only; the ranged `Disable` form is
    //           resolved by the applier, which has to pair it with its `Enable`.
    // Why:      A line-scoped directive can answer for itself, and having it do
    //           so keeps the applier from restating the offset arithmetic.
    /// Report whether a single-line directive governs the given line.
    pub fn governs(&self, line: usize) -> bool {
        if self.kind == DirectiveKind::DisableLine {
            return line == self.line;
        } else if self.kind == DirectiveKind::DisableNextLine {
            return line == self.line + 1;
        } else {
            return false;
        }
    }
}

// What:     `pub fn parse(context: &LintContext) -> Vec<Directive>`. Walks the
//           file's COMMENT tokens rather than its lines.
// Why:      The lexer is what tells a real comment from the same characters
//           inside a string literal. Scanning lines for `// rust-linter-disable`
//           would find one inside `let s = "// rust-linter-disable";` and
//           silently suppress a rule nobody asked to suppress.
//
// In TS you'd write (pseudocode):
// ```ts
// function parse(context: LintContext): Directive[]
// ```
/// Parse every directive comment in a file.
pub fn parse(context: &LintContext) -> Vec<Directive> {
    /// Imports the token kinds and traversal used to find comments.
    use ra_ap_syntax::{NodeOrToken, SyntaxKind};

    let mut found = Vec::new();

    // `.descendants_with_tokens()` walks nodes AND tokens; comments are tokens,
    // so a node-only walk would never see them.
    for element in context.syntax_node().descendants_with_tokens() {
        // `if let NodeOrToken::Token(token) = element` keeps only the tokens.
        if let NodeOrToken::Token(token) = element {
            if token.kind() != SyntaxKind::COMMENT {
                continue;
            }

            let offset = usize::from(token.text_range().start());
            if let Some(directive) = parse_comment(token.text(), offset, context) {
                found.push(directive);
            }
        }
    }

    return found;
}

/// Parse one comment's text into a directive, when it is one.
fn parse_comment(text: &str, offset: usize, context: &LintContext) -> Option<Directive> {
    // Strip the comment markers before looking for the prefix, so both `//` and
    // `/* */` spellings are recognised.
    let body = text
        .trim_start_matches('/')
        .trim_start_matches('*')
        .trim_end_matches('/')
        .trim_end_matches('*')
        .trim();

    // `.strip_prefix(..)` answers `Some(rest)` when the prefix matched and
    // `None` otherwise, which is both the test and the removal in one step.
    let rest = body.strip_prefix(PREFIX)?;

    let kind = DirectiveKind::parse(rest)?;

    // Everything after the kind's own word is the argument list.
    let arguments = rest[kind.width()..].trim();

    // What:     `.split_once(..)` splits at the FIRST occurrence, answering
    //           `Some((before, after))` or `None` when the separator is absent.
    // Why:      A justification may itself contain `--`, and only the first
    //           separator delimits it.
    let (rule_text, justification) = match arguments.split_once(JUSTIFICATION_SEPARATOR) {
        Some((before, after)) => (before.trim(), Some(after.trim().to_string())),
        None => (arguments, None),
    };

    // `split_whitespace` collapses runs of spaces and commas are stripped, so
    // both `a b` and `a, b` name two rules.
    let rules: Vec<String> = rule_text
        .split_whitespace()
        .map(|name| return name.trim_end_matches(',').to_string())
        .filter(|name| return !name.is_empty())
        .collect();

    return Some(Directive {
        kind,
        rules,
        // An empty justification after the separator counts as absent: `-- `
        // with nothing behind it explains no more than no separator at all.
        justification: justification.filter(|text| return !text.is_empty()),
        line: context.line_at_offset(offset),
        span: context.span_at_offset(offset, text.len()),
    });
}
