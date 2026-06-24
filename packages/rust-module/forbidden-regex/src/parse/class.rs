//! Character-class `[...]` parsing.

/// Imports the byte-set accumulator and node constructor.
use crate::charset::ByteSet;

/// Imports the node algebra produced by a class.
use crate::ast::node::Node;

/// Imports the class smart constructor (collapses an empty set to `Fail`).
use crate::ast::smart::class;

/// Imports the error type for malformed classes.
use crate::error::CompileError;

/// Imports the cursor.
use crate::parse::cursor::Cursor;

/// Imports the escape parser and its result kind.
use crate::parse::escape::{EscapeResult, parse_escape};

/// One element inside a character class.
///
/// What: either a concrete byte (a possible range endpoint) or a shorthand set.
/// Why: ranges are only meaningful between two bytes, so the parser must know
/// which kind it just read.
enum ClassAtom {
    /// A single byte that may begin or end a range.
    Byte(
        /// Byte value, usable as a range endpoint.
        u8,
    ),
    /// A shorthand set that cannot participate in a range.
    Set(
        /// Shorthand set, never a range endpoint.
        ByteSet,
    ),
}

/// Parses a `[...]` (or `[^...]`) class into a class node.
///
/// What: reads members and ranges until the closing `]`, with no verbose-mode
/// skipping (whitespace and `#` are literal inside a class), then negates the
/// accumulated set when the class opened with `^`. Why: byte classes are the
/// engine's main alphabet primitive and need their own grammar distinct from the
/// whitespace-insensitive outer one.
pub fn parse_class(cur: &mut Cursor) -> Result<Node, CompileError> {
    let pos = cur.pos();
    cur.bump();
    // What: an immediate `^` negates the class. Why: `[^...]` is set complement.
    let negated = if cur.peek() == Some(b'^') {
        cur.bump();
        true
    } else {
        false
    };
    let mut set = ByteSet::empty();
    // What: `first` lets a leading `]` be a literal member rather than the close.
    // Why: matches the conventional class grammar.
    let mut first = true;
    loop {
        let p = cur.peek().ok_or(CompileError::Syntax {
            pos,
            message: "unterminated character class".to_string(),
        })?;
        if p == b']' && !first {
            cur.bump();
            break;
        }
        read_class_element(cur, pos, &mut set)?;
        first = false;
    }
    // What: complement the bitmap when the class was negated. Why: `[^...]`
    // matches every byte not listed, including the newline (byte-level).
    let final_set = if negated { set.negate() } else { set };
    Ok(class(final_set))
}

/// Reads one element (member or range) and folds it into `set`.
///
/// What: parses an atom, then, when it is a byte followed by a `-` and a real
/// endpoint, reads a range; otherwise inserts the single byte or unions the
/// shorthand. Why: keeps the loop in `parse_class` short and the range logic in
/// one place.
fn read_class_element(cur: &mut Cursor, pos: usize, set: &mut ByteSet) -> Result<(), CompileError> {
    // What: classify the next element. Why: ranges only apply to byte atoms.
    let lo = parse_class_atom(cur)?;
    let lo_b = match lo {
        ClassAtom::Set(s) => {
            set.union_with(&s);
            return Ok(());
        }
        ClassAtom::Byte(b) => b,
    };
    // What: a `-` that is not the class close starts a range. Why: `a-z` form;
    // a trailing `-` (before `]`) is a literal handled by the else branch.
    let is_range = cur.peek() == Some(b'-') && cur.peek_at(1).is_some() && cur.peek_at(1) != Some(b']');
    if is_range {
        cur.bump();
        match parse_class_atom(cur)? {
            ClassAtom::Byte(hi_b) => {
                if hi_b < lo_b {
                    return Err(CompileError::Syntax {
                        pos,
                        message: "character-class range is out of order".to_string(),
                    });
                }
                set.insert_range(lo_b, hi_b);
            }
            ClassAtom::Set(_) => {
                return Err(CompileError::Syntax {
                    pos,
                    message: "a shorthand cannot be a range endpoint".to_string(),
                });
            }
        }
    } else {
        set.insert(lo_b);
    }
    Ok(())
}

/// Parses one class atom: an escape or a literal byte.
///
/// What: dispatches a backslash to the shared escape parser, otherwise consumes
/// one literal byte. Why: classes admit the same escapes as atoms except `\b`,
/// which the escape parser rejects when `in_class` is set.
fn parse_class_atom(cur: &mut Cursor) -> Result<ClassAtom, CompileError> {
    let p = cur.peek().ok_or(CompileError::Syntax {
        pos: cur.pos(),
        message: "unterminated character class".to_string(),
    })?;
    if p == b'\\' {
        // What: reuse the escape grammar with class rules. Why: `\d`/`\t`/escaped
        // metacharacters all work the same inside a class.
        match parse_escape(cur, true)? {
            EscapeResult::Byte(b) => Ok(ClassAtom::Byte(b)),
            EscapeResult::Set(s) => Ok(ClassAtom::Set(s)),
            EscapeResult::Boundary => Err(CompileError::Syntax {
                pos: cur.pos(),
                message: "\\b is not valid in a character class".to_string(),
            }),
        }
    } else {
        cur.bump();
        Ok(ClassAtom::Byte(p))
    }
}
