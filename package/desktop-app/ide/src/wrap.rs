//! Soft-wrap break rules and the continuation indent, taken from IntelliJ Community.
//!
//! The rules come from `GenericLineWrapPositionStrategy` and `DefaultLineWrapPositionStrategy`
//!  (`platform/code-style-api`), and from `LineWrapPositionStrategy.canWrapLineAtOffset`
//!  and `SoftWrapEngine.findWrapPosition` (`platform/editor-ui-api`, `platform/platform-impl`).
//! Each rule is a named predicate on one adjacent pair of code points,
//!  so a test can exercise it alone.
//! Parley asks for a decision per pair and takes the rightmost fitting opportunity,
//!  so IntelliJ's weights and its ten-character look-back are not reproduced.

/// IntelliJ's tab stops, so a continuation indent counts a leading tab at its stop.
use crate::tab_stop::tab_advance;
/// What:
///  `pub use` names Parley's line-break override types under this module.
/// Why:
///  The override is the only hook Parley offers for forcing or suppressing a break opportunity.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { LineBreakContext, LineBreakOverrideFn } from 'parley';
/// ```
use parley::{LineBreakContext, LineBreakOverrideFn};

/// First code point that IntelliJ's `canWrapLineAtOffset` treats as Eastern text.
const EASTERN_FIRST: u32 = 0x2F00;
/// First code point outside the BMP, which IntelliJ never breaks around.
const BMP_END: u32 = 0x1_0000;

/// Space or tab: IntelliJ's `Rule(' ')` and `Rule('\t')` allow a break before and after each.
pub fn is_blank(character: char) -> bool {
    return character == ' ' || character == '\t';
}

/// Identifier characters of IntelliJ's `isIdSymbol`: underscore, dollar, and ASCII letters and digits.
pub fn is_identifier(character: char) -> bool {
    return character == '_' || character == '$' || character.is_ascii_alphanumeric();
}

/// Symbols after which IntelliJ allows a break: `Rule(',', AFTER)`, `Rule(';', AFTER)`, `Rule(')', AFTER)`.
pub fn is_closing_symbol(character: char) -> bool {
    return matches!(character, ',' | ';' | ')');
}

/// Symbols before which IntelliJ allows a break: `Rule('(', BEFORE)` and `Rule('.', BEFORE)`.
pub fn is_opening_symbol(character: char) -> bool {
    return matches!(character, '(' | '.');
}

/// Symbols that have their own rule, so the identifier rule never breaks in front of them.
fn is_rule_symbol(character: char) -> bool {
    return is_blank(character) || is_closing_symbol(character) || is_opening_symbol(character);
}

/// Eastern text of `canWrapLineAtOffset`: a BMP code point from U+2F00 on.
pub fn is_eastern(character: char) -> bool {
    let code = character as u32;
    return (EASTERN_FIRST..BMP_END).contains(&code);
}

/// Code points that attach to the one before them, so a break in front of them splits a grapheme.
///
/// The list is approximate: combining marks, variation selectors, skin tones, tags, and Hangul jamo.
/// Spacing marks of Indic scripts are not listed, so a break before one is not excluded here.
pub fn joins_previous(character: char) -> bool {
    return matches!(
        character as u32,
        0x0300..=0x036F
            | 0x1160..=0x11FF
            | 0x1AB0..=0x1AFF
            | 0x1DC0..=0x1DFF
            | 0x200C
            | 0x200D
            | 0x20D0..=0x20FF
            | 0x3099..=0x309A
            | 0xFE00..=0xFE0F
            | 0xFE20..=0xFE2F
            | 0x1F3FB..=0x1F3FF
            | 0xE0020..=0xE007F
            | 0xE0100..=0xE01EF
    );
}

/// Regional indicator symbols, which pair up into one flag.
fn is_regional(character: char) -> bool {
    return matches!(character as u32, 0x1F1E6..=0x1F1FF);
}

/// True when no break may sit between `before` and `after` because they belong to one grapheme cluster.
///
/// A zero width joiner never ends a cluster, and a regional indicator pair is one flag.
pub fn joins_grapheme(before: char, after: char) -> bool {
    return joins_previous(after)
        || before == '\u{200D}'
        || (is_regional(before) && is_regional(after));
}

/// IntelliJ leaves the blanks after a closing symbol on the upper row, so no break sits between them.
///
/// The break comes after the blank run, from the blank rule on the last blank.
pub fn keeps_blank_with_closing_symbol(before: char, after: char) -> bool {
    return is_closing_symbol(before) && after == ' ';
}

/// Blank rule: a break opportunity on both sides of a space or tab.
pub fn blank_break(before: char, after: char) -> bool {
    return is_blank(before) || is_blank(after);
}

/// Closing rule: a break after `,`, `;`, or `)`.
pub fn closing_symbol_break(before: char, _after: char) -> bool {
    return is_closing_symbol(before);
}

/// Opening rule: a break before `(` or `.`.
pub fn opening_symbol_break(_before: char, after: char) -> bool {
    return is_opening_symbol(after);
}

/// Eastern rule: a break before or after any BMP code point from U+2F00.
pub fn eastern_break(before: char, after: char) -> bool {
    return is_eastern(before) || is_eastern(after);
}

/// Identifier rule: a break before a non-identifier symbol that follows an identifier character.
///
/// IntelliJ gives this rule a lower weight than the others;
///  Parley's rightmost choice ignores weights, so it is a plain opportunity here.
pub fn identifier_symbol_break(before: char, after: char) -> bool {
    return is_identifier(before) && !is_identifier(after) && !is_rule_symbol(after);
}

/// Break decision for one adjacent pair of code points, the union of IntelliJ's rules.
///
/// Every other pair gets no opportunity, so Unicode's default line breaking does not add breaks
/// that IntelliJ would not add.
pub fn intellij_break(before: char, after: char) -> bool {
    if joins_grapheme(before, after) {
        return false;
    }
    if keeps_blank_with_closing_symbol(before, after) {
        return false;
    }
    return blank_break(before, after)
        || closing_symbol_break(before, after)
        || opening_symbol_break(before, after)
        || eastern_break(before, after)
        || identifier_symbol_break(before, after);
}

/// Parley's override callback: forces or suppresses the opportunity between the context's two code points.
///
/// Parley calls it for every adjacent pair, and mandatory breaks such as a newline are not affected.
pub fn line_break_override(context: LineBreakContext) -> Option<bool> {
    return Some(intellij_break(context.before, context.after));
}

/// The override as the shared function pointer that `set_line_break_override` takes.
///
/// `dyn Fn` is unsized, so the pointer is spelled as a reference to a function value.
pub static INTELLIJ_LINE_BREAK: &LineBreakOverrideFn =
    &(line_break_override as fn(LineBreakContext) -> Option<bool>);

/// Whether a wrap width can wrap at all: a positive finite number of logical pixels.
///
/// IntelliJ keeps its previous available width when the visible width is not positive (`SoftWrapApplianceManager`),
///  so a caller that gets `false` must keep the last positive width.
pub fn has_wrap_width(width: f32) -> bool {
    return width > 0.0 && width.is_finite();
}

/// Continuation indent of a wrapped logical line, in logical pixels.
///
/// The indent is the x of the first non-blank character, with tabs ending on their stops,
///  plus one space advance for the wrap mark (`SoftWrapEngine.createSoftWrap`, `USE_CUSTOM_SOFT_WRAP_INDENT`).
/// A line with no non-blank character gets only the mark.
pub fn continuation_indent(text: &str, space: f32) -> f32 {
    let mut column = 0.0;
    for character in text.chars() {
        match character {
            ' ' => column += space,
            '\t' => column += tab_advance(column, space),
            _ => return column + space,
        }
    }
    return space;
}

#[cfg(test)]
#[path = "wrap_tests.rs"]
mod tests;
