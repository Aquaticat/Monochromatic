//! Keyboard input encoding for terminal PTY writes.

// What:     `const ...: &str` declares borrowed string constants for Slint-sent
//           special-key names. Sibling `String` would allocate at runtime.
// Why:      Keeping names in one place prevents the Slint callback and tests from
//           disagreeing about non-printable keys.
// TS map:   `const KEY_BACKSPACE = "Backspace"`.
const KEY_BACKSPACE: &str = "Backspace";
const KEY_TAB: &str = "Tab";
const KEY_RETURN: &str = "Return";
const KEY_ESCAPE: &str = "Escape";
const KEY_BACKTAB: &str = "Backtab";
const KEY_DELETE: &str = "Delete";
const KEY_INSERT: &str = "Insert";
const KEY_UP_ARROW: &str = "UpArrow";
const KEY_DOWN_ARROW: &str = "DownArrow";
const KEY_LEFT_ARROW: &str = "LeftArrow";
const KEY_RIGHT_ARROW: &str = "RightArrow";
const KEY_HOME: &str = "Home";
const KEY_END: &str = "End";
const KEY_PAGE_UP: &str = "PageUp";
const KEY_PAGE_DOWN: &str = "PageDown";
const KEY_F1: &str = "F1";
const KEY_F2: &str = "F2";
const KEY_F3: &str = "F3";
const KEY_F4: &str = "F4";
const KEY_F5: &str = "F5";
const KEY_F6: &str = "F6";
const KEY_F7: &str = "F7";
const KEY_F8: &str = "F8";
const KEY_F9: &str = "F9";
const KEY_F10: &str = "F10";
const KEY_F11: &str = "F11";
const KEY_F12: &str = "F12";

// What:     `pub fn encode_terminal_key(...) -> Option<Vec<u8>>` converts one
//           Slint key event into bytes for a PTY. `Option` is Rust's
//           `value | null`; `Vec<u8>` is a growable byte array.
// Why:      The UI should not know terminal escape sequences or control-byte math.
// TS map:   `function encodeTerminalKey(key, control, alt): Uint8Array | null`.
pub fn encode_terminal_key(key_text: &str, control: bool, alt: bool) -> Option<Vec<u8>> {
    // What:     `let encoded = ...?` tries control, named, and printable encoders.
    //           The `?` returns `None` if all encoders reject the key.
    // Why:      Modifier-only or unknown special keys should not write text to the shell.
    // TS map:   `const encoded = encodeControl(...) ?? encodeNamed(...) ?? encodeText(...)`.
    let encoded = if control {
        encode_control_key(key_text)
            .or_else(|| encode_named_key(key_text))
            .or_else(|| encode_printable_text(key_text))?
    } else {
        encode_named_key(key_text).or_else(|| encode_printable_text(key_text))?
    };
    // What:     `if alt { ... } else { ... }` optionally prefixes ESC for Alt-modified
    //           terminal input. `Some(...)` wraps the present byte vector.
    // Why:      Many terminal programs treat Alt+x as ESC followed by x.
    // TS map:   `return alt ? Uint8Array.of(0x1b, ...encoded) : encoded`.
    if alt {
        // What:     `Vec::with_capacity(encoded.len() + 1)` allocates a byte vector
        //           with room for ESC plus the encoded key.
        // Why:      Avoid reallocating while prefixing the Alt escape byte.
        // TS map:   `const prefixed = [0x1b, ...encoded]`.
        let mut prefixed = Vec::with_capacity(encoded.len() + 1);
        // What:     `prefixed.push(0x1b)` appends ASCII ESC.
        // Why:      ESC is the conventional terminal Alt prefix.
        // TS map:   `prefixed.push(0x1b)`.
        prefixed.push(0x1b);
        // What:     `prefixed.extend(encoded)` moves all encoded bytes into the new vector.
        // Why:      Preserve the original key sequence after the Alt prefix.
        // TS map:   `prefixed.push(...encoded)`.
        prefixed.extend(encoded);
        // What:     `Some(prefixed)` returns the present prefixed byte vector.
        // Why:      The caller should write these bytes to the PTY.
        // TS map:   `return prefixed`.
        Some(prefixed)
    } else {
        // What:     `Some(encoded)` returns the present unmodified byte vector.
        // Why:      No Alt prefix is needed.
        // TS map:   `return encoded`.
        Some(encoded)
    }
}

// What:     `fn encode_control_key(...) -> Option<Vec<u8>>` handles Ctrl+letter.
// Why:      Shell shortcuts such as Ctrl+C and Ctrl+D are control bytes, not text.
// TS map:   `function encodeControlKey(key): Uint8Array | null`.
fn encode_control_key(key_text: &str) -> Option<Vec<u8>> {
    // What:     `let mut chars = key_text.chars()` creates a Unicode character iterator.
    // Why:      Ctrl mapping only applies to a single visible character.
    // TS map:   `const chars = [...keyText]`.
    let mut chars = key_text.chars();
    // What:     `let first = chars.next()?` reads the first character or returns `None`.
    // Why:      Empty key text cannot produce a control byte.
    // TS map:   `const first = chars[0]; if (first === undefined) return null`.
    let first = chars.next()?;
    // What:     `if chars.next().is_some() { return None; }` rejects multi-character text.
    // Why:      Ctrl mapping for pasted or composed strings would be ambiguous.
    // TS map:   `if (chars.length !== 1) return null`.
    if chars.next().is_some() {
        return None;
    }
    // What:     `if !first.is_ascii_alphabetic() { return None; }` limits mapping to A-Z.
    // Why:      Letter control shortcuts cover the common terminal control-byte set.
    // TS map:   `if (!isAsciiLetter(first)) return null`.
    if !first.is_ascii_alphabetic() {
        return None;
    }
    // What:     `first.to_ascii_uppercase() as u8 - b'A' + 1` computes Ctrl+A through
    //           Ctrl+Z as bytes 1 through 26.
    // Why:      POSIX terminals encode control letters this way.
    // TS map:   `const byte = first.toUpperCase().charCodeAt(0) - 64`.
    let control_byte = first.to_ascii_uppercase() as u8 - b'A' + 1;
    // What:     `Some(vec![control_byte])` returns a one-byte vector.
    // Why:      The caller writes this control byte to the PTY.
    // TS map:   `return Uint8Array.of(controlByte)`.
    Some(vec![control_byte])
}

// What:     `fn encode_named_key(...) -> Option<Vec<u8>>` maps Slint special-key
//           names to terminal byte sequences.
// Why:      Arrows and editing keys are escape sequences, not printable text.
// TS map:   `function encodeNamedKey(key): Uint8Array | null`.
fn encode_named_key(key_text: &str) -> Option<Vec<u8>> {
    // What:     `let bytes = if ...` picks one byte slice for known special keys.
    // Why:      Plain string comparisons avoid regex and keep the mapping explicit.
    // TS map:   `if (key === "Backspace") bytes = [0x7f]; ...`.
    let bytes: &[u8] = if key_text == KEY_BACKSPACE {
        b"\x7f"
    } else if key_text == KEY_TAB {
        b"\t"
    } else if key_text == KEY_RETURN {
        b"\r"
    } else if key_text == KEY_ESCAPE {
        b"\x1b"
    } else if key_text == KEY_BACKTAB {
        b"\x1b[Z"
    } else if key_text == KEY_DELETE {
        b"\x1b[3~"
    } else if key_text == KEY_INSERT {
        b"\x1b[2~"
    } else if key_text == KEY_UP_ARROW {
        b"\x1b[A"
    } else if key_text == KEY_DOWN_ARROW {
        b"\x1b[B"
    } else if key_text == KEY_RIGHT_ARROW {
        b"\x1b[C"
    } else if key_text == KEY_LEFT_ARROW {
        b"\x1b[D"
    } else if key_text == KEY_HOME {
        b"\x1b[H"
    } else if key_text == KEY_END {
        b"\x1b[F"
    } else if key_text == KEY_PAGE_UP {
        b"\x1b[5~"
    } else if key_text == KEY_PAGE_DOWN {
        b"\x1b[6~"
    } else if key_text == KEY_F1 {
        b"\x1bOP"
    } else if key_text == KEY_F2 {
        b"\x1bOQ"
    } else if key_text == KEY_F3 {
        b"\x1bOR"
    } else if key_text == KEY_F4 {
        b"\x1bOS"
    } else if key_text == KEY_F5 {
        b"\x1b[15~"
    } else if key_text == KEY_F6 {
        b"\x1b[17~"
    } else if key_text == KEY_F7 {
        b"\x1b[18~"
    } else if key_text == KEY_F8 {
        b"\x1b[19~"
    } else if key_text == KEY_F9 {
        b"\x1b[20~"
    } else if key_text == KEY_F10 {
        b"\x1b[21~"
    } else if key_text == KEY_F11 {
        b"\x1b[23~"
    } else if key_text == KEY_F12 {
        b"\x1b[24~"
    } else {
        return None;
    };
    // What:     `Some(bytes.to_vec())` copies the borrowed byte slice into an owned vector.
    // Why:      The caller owns the returned bytes independently of this static mapping.
    // TS map:   `return Uint8Array.from(bytes)`.
    Some(bytes.to_vec())
}

// What:     `fn encode_printable_text(...) -> Option<Vec<u8>>` converts ordinary
//           Slint text into UTF-8 bytes.
// Why:      Printable input and paste-like key text should reach the shell unchanged.
// TS map:   `function encodePrintableText(text): Uint8Array | null`.
fn encode_printable_text(key_text: &str) -> Option<Vec<u8>> {
    // What:     `if key_text.is_empty() { return None; }` rejects modifier-only events.
    // Why:      Writing nothing is different from writing an empty allocation.
    // TS map:   `if (keyText.length === 0) return null`.
    if key_text.is_empty() {
        return None;
    }
    // What:     `Some(key_text.as_bytes().to_vec())` copies UTF-8 bytes from the string.
    // Why:      PTYs transport bytes, and terminals interpret UTF-8 text bytes.
    // TS map:   `return new TextEncoder().encode(keyText)`.
    Some(key_text.as_bytes().to_vec())
}

// What:     `#[cfg(test)] #[path = "input_tests.rs"] mod tests;`
//           declares a test-only submodule whose code lives in the sibling
//           file `input_tests.rs`. `#[cfg(test)]` gates it to test
//           builds only; `#[path = "..."]` aims the module at a flat sibling
//           file instead of the default `input/tests.rs`
//           subdirectory lookup. The file stays the `tests` CHILD of
//           input, so its `use super::*` reaches the module items
//           (including private ones) unchanged.
// Why:      Keep `input.rs` to production code; the tests live
//           beside it without inflating this file or its max-lines budget
//           (sibling `*_tests.rs` files are exempt from the linter).
// TS map:   the `input.unit.test.ts` file beside
//           `input.ts`, excluded from the production bundle.
//
// In TS you'd write (pseudocode):
// ```ts
// // input.unit.test.ts, run only by the test runner
// ```
#[cfg(test)]
#[path = "input_tests.rs"]
mod tests;
