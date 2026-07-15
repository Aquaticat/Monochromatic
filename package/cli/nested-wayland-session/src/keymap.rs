//! US-QWERTY character/key-name to Linux evdev keycode tables.
//!
//! Synthetic keyboard input is expressed as evdev keycodes (the values in
//! `linux/input-event-codes.h`). The compositor's keyboard uses the default US xkb
//! layout, so mapping a character to the keycode-plus-shift that produces it under that
//! layout is a fixed table. This is display-independent and unit-tested directly.

/// Evdev keycode of the left Shift modifier (`KEY_LEFTSHIFT`).
///
/// What:     `pub const LEFT_SHIFT: u32 = 42;`. Unsigned 32-bit; the raw evdev code.
/// Why:      Typing an uppercase or shifted character wraps the key tap in a Shift
///           press/release, and the input layer needs this code.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const LEFT_SHIFT = 42;
/// ```
pub const LEFT_SHIFT: u32 = 42;

/// Map a character to `(evdev_keycode, needs_shift)` under the US layout.
///
/// What:     `pub fn char_to_key(character: char) -> Option<(u32, bool)>`. Returns the
///           keycode and whether Shift must be held, or `None` for characters not on a
///           US keyboard (which the caller skips).
/// Why:      `type <text>` turns each character into a key tap; this is the lookup.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function charToKey(character: string): [number, boolean] | undefined { ... }
/// ```
///
/// @example
/// ```ts
/// charToKey("A"); // => [30, true]  (KEY_A held with Shift)
/// charToKey("!"); // => [2, true]   (KEY_1 held with Shift)
/// ```
pub fn char_to_key(character: char) -> Option<(u32, bool)> {
    // What:     `if character.is_ascii_alphabetic() { ... }`. True for A-Z and a-z.
    // Why:      Letters share one code per letter; case only sets the Shift flag.
    if character.is_ascii_alphabetic() {
        // What:     `let code = letter_code(character.to_ascii_lowercase())?;`. Lowercase
        //           the letter, look up its code; `?` returns `None` if somehow absent.
        // Why:      The keycode is the same for `a` and `A`.
        let code = letter_code(character.to_ascii_lowercase())?;

        // What:     `Some((code, character.is_ascii_uppercase()))`. Shift is needed exactly
        //           when the character is uppercase. Tail expression.
        // Why:      Return the code plus whether to hold Shift.
        return Some((code, character.is_ascii_uppercase()));
    }

    // What:     `match character { ... }`. Map each non-letter character to its
    //           `(code, shift)`. Digits and space are unshifted; the shifted symbols on
    //           the number row and punctuation keys set `true`. Anything else is `None`.
    // Why:      Cover the printable US-keyboard characters a test is likely to type.
    match character {
        ' ' => Some((57, false)),
        '1' => Some((2, false)),
        '!' => Some((2, true)),
        '2' => Some((3, false)),
        '@' => Some((3, true)),
        '3' => Some((4, false)),
        '#' => Some((4, true)),
        '4' => Some((5, false)),
        '$' => Some((5, true)),
        '5' => Some((6, false)),
        '%' => Some((6, true)),
        '6' => Some((7, false)),
        '^' => Some((7, true)),
        '7' => Some((8, false)),
        '&' => Some((8, true)),
        '8' => Some((9, false)),
        '*' => Some((9, true)),
        '9' => Some((10, false)),
        '(' => Some((10, true)),
        '0' => Some((11, false)),
        ')' => Some((11, true)),
        '-' => Some((12, false)),
        '_' => Some((12, true)),
        '=' => Some((13, false)),
        '+' => Some((13, true)),
        '[' => Some((26, false)),
        '{' => Some((26, true)),
        ']' => Some((27, false)),
        '}' => Some((27, true)),
        '\\' => Some((43, false)),
        '|' => Some((43, true)),
        ';' => Some((39, false)),
        ':' => Some((39, true)),
        '\'' => Some((40, false)),
        '"' => Some((40, true)),
        '`' => Some((41, false)),
        '~' => Some((41, true)),
        ',' => Some((51, false)),
        '<' => Some((51, true)),
        '.' => Some((52, false)),
        '>' => Some((52, true)),
        '/' => Some((53, false)),
        '?' => Some((53, true)),
        _ => None,
    }
}

/// Map a lowercase ASCII letter to its evdev keycode.
///
/// What:     `fn letter_code(letter: char) -> Option<u32>`. Private helper covering
///           `a`..=`z`.
/// Why:      Keep the 26-entry letter table out of `char_to_key`'s symbol match.
fn letter_code(letter: char) -> Option<u32> {
    // What:     `match letter { 'a' => Some(30), ... }`. The QWERTY letter-to-code table.
    // Why:      One authoritative place for letter keycodes.
    match letter {
        'a' => Some(30),
        'b' => Some(48),
        'c' => Some(46),
        'd' => Some(32),
        'e' => Some(18),
        'f' => Some(33),
        'g' => Some(34),
        'h' => Some(35),
        'i' => Some(23),
        'j' => Some(36),
        'k' => Some(37),
        'l' => Some(38),
        'm' => Some(50),
        'n' => Some(49),
        'o' => Some(24),
        'p' => Some(25),
        'q' => Some(16),
        'r' => Some(19),
        's' => Some(31),
        't' => Some(20),
        'u' => Some(22),
        'v' => Some(47),
        'w' => Some(17),
        'x' => Some(45),
        'y' => Some(21),
        'z' => Some(44),
        _ => None,
    }
}

/// Map a key name (`enter`, `space`, or a single character) to its evdev keycode.
///
/// What:     `pub fn named_key(name: &str) -> Option<u32>`. Returns the code for a named
///           key, or for a one-character name delegates to `char_to_key` (dropping the
///           Shift flag, since `key` presses a raw key). `None` for unknown names.
/// Why:      The `key <name>` command presses named keys (Enter, arrows) and single
///           characters alike.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function namedKey(name: string): number | undefined { ... }
/// ```
///
/// @example
/// ```ts
/// namedKey("enter"); // => 28
/// namedKey("a");     // => 30
/// ```
pub fn named_key(name: &str) -> Option<u32> {
    // What:     `match name { ... }`. Named keys first; the `_` arm handles single
    //           characters. Alternatives (`|`) accept common spellings.
    // Why:      Accept both symbolic names and bare characters.
    match name {
        "enter" | "return" => Some(28),
        "escape" | "esc" => Some(1),
        "tab" => Some(15),
        "space" => Some(57),
        "backspace" => Some(14),
        "delete" | "del" => Some(111),
        "up" => Some(103),
        "down" => Some(108),
        "left" => Some(105),
        "right" => Some(106),
        "home" => Some(102),
        "end" => Some(107),
        "pageup" => Some(104),
        "pagedown" => Some(109),
        _ => {
            // What:     `let mut chars = name.chars();`. Iterator over the name's characters.
            // Why:      Detect the single-character case.
            let mut chars = name.chars();

            // What:     `let first = chars.next()?;`. Take the first character, or `None`
            //           (an empty name) via `?`.
            // Why:      A single-character name maps through `char_to_key`.
            let first = chars.next()?;

            // What:     `if chars.next().is_some() { return None; }`. More than one
            //           character and not a known name means unknown.
            // Why:      Reject multi-character names we do not recognise.
            if chars.next().is_some() {
                return None;
            }

            // What:     `char_to_key(first).map(|(code, _shift)| code)`. Reuse the character
            //           table, discarding the Shift flag. Tail expression.
            // Why:      A bare character key press uses only the keycode.
            char_to_key(first).map(|(code, _shift)| code)
        }
    }
}

/// What:     `#[cfg(test)] #[path = "keymap_tests.rs"] mod tests;`. Declares the keymap
///           unit test module from the sibling file.
/// Why:      Keep the keycode-table tests beside the tables.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import "./keymap_tests";
/// ```
#[cfg(test)]
#[path = "keymap_tests.rs"]
mod tests;
