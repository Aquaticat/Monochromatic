//! Pattern parsing: text to a normalized node, plus the empty-match guard.

/// The verbose-mode-aware byte cursor.
mod cursor;

/// Backslash-escape parsing.
mod escape;

/// Character-class parsing.
mod class;

/// Bounded-repetition desugaring.
mod repeat;

/// The recursive-descent grammar.
mod grammar;

/// Imports the node algebra produced by parsing.
use crate::ast::node::Node;

/// Imports the boundary context used by the empty-match guard.
use crate::context::Ctx;

/// Imports the error type.
use crate::error::CompileError;

/// Imports nullability for the empty-match guard.
use crate::nullable::nullable;

/// Imports the cursor.
use cursor::Cursor;

/// Imports the grammar entry point.
use grammar::parse_setexpr;

/// Parses a pattern into a normalized, non-empty-matchable node.
///
/// What: runs the grammar over the whole pattern, requires all input to be
/// consumed, and rejects a pattern that can match the empty string. Why: this is
/// the single front door from pattern text to the node the DFA builder consumes,
/// and the empty-match guard prevents a rule that would flag every line.
pub fn parse(pattern: &str) -> Result<Node, CompileError> {
    let mut cur = Cursor::new(pattern.as_bytes());
    let node = parse_setexpr(&mut cur, None)?;
    cur.skip_ignorable();
    // What: any leftover bytes mean the grammar stopped early. Why: a stray `)`
    // or operator should be reported rather than silently ignored.
    if !cur.eof() {
        return Err(CompileError::Syntax {
            pos: cur.pos(),
            message: "unexpected trailing input".to_string(),
        });
    }
    if can_match_empty(&node) {
        return Err(CompileError::EmptyMatchable);
    }
    Ok(node)
}

/// Reports whether the node can match the empty string at some real boundary.
///
/// What: checks nullability across the realizable anchor contexts (a line start
/// cannot have a word byte before it, a line end cannot have one after it). Why:
/// under unanchored search an empty match means the rule matches every input, so
/// such patterns are rejected at compile time.
fn can_match_empty(node: &Node) -> bool {
    // What: enumerate the four context booleans, skipping impossible combos.
    // Why: a precise realizable-context check avoids false rejections while still
    // catching every genuinely empty-matchable pattern.
    for line_start in [false, true] {
        for line_end in [false, true] {
            for word_before in [false, true] {
                for word_after in [false, true] {
                    // What: drop unrealizable combinations. Why: a line boundary
                    // forces the adjacent byte to be a non-word newline or edge.
                    if (line_start && word_before) || (line_end && word_after) {
                        continue;
                    }
                    let ctx = Ctx {
                        line_start,
                        line_end,
                        word_before,
                        word_after,
                    };
                    if nullable(node, ctx) {
                        return true;
                    }
                }
            }
        }
    }
    false
}
