//! Lossless source mapping for the rendered representation of one code line.

/// Unicode widths are used only for tab-stop expansion, never glyph hit geometry.
use helix_core::unicode::width::UnicodeWidthChar;

/// What: Own display text and maps between its bytes and source characters.
/// Why: Tabs expand visually while copying and language requests retain source offsets.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Projection = { text: string; sourceToByte: number[]; byteToSource: number[] };
/// ```
pub struct Projection {
    /// Text passed to the shaper, with tabs expanded and terminators excluded.
    pub text: String,
    /// Display byte position for each source character boundary.
    pub source_to_byte: Vec<usize>,
    /// Source character position for each display byte boundary.
    pub byte_to_source: Vec<usize>,
}

/// Build the projection in one pass; input is one logical source line.
pub fn project_line(source: &str) -> Projection {
    // Owned buffers grow linearly; no repeated prefix-string reconstruction.
    let mut text = String::new();
    let mut source_to_byte = vec![0];
    let mut byte_to_source = vec![0];
    let mut column = 0;
    let mut source_index = 0;
    for character in source.chars() {
        if character == '\n' || character == '\r' {
            break;
        }
        if character == '\t' {
            let count = 4 - column % 4;
            for index in 0..count {
                text.push(' ');
                // The nearer edge of an expanded tab determines its source boundary.
                if (index + 1) * 2 >= count {
                    byte_to_source.push(source_index + 1);
                } else {
                    byte_to_source.push(source_index);
                }
            }
            column += count;
        } else {
            text.push(character);
            for index in 0..character.len_utf8() {
                if index + 1 == character.len_utf8() {
                    byte_to_source.push(source_index + 1);
                } else {
                    byte_to_source.push(source_index);
                }
            }
            // Missing width for a control character contributes no display columns.
            column += UnicodeWidthChar::width(character).unwrap_or(0);
        }
        source_index += 1;
        source_to_byte.push(text.len());
    }
    return Projection { text, source_to_byte, byte_to_source };
}
