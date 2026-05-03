use super::regex_syntax::{
    find_matching_close_paren, group_body_start, quantifier_is_required, skip_any_quantifier,
    skip_class_body,
};
use super::walker::extract_scope;

// What:     `fn walk_literal_bytes(input, out, remainder)` walks `input`
//           byte by byte, pushing literal characters into `out` and
//           returning the un-walked tail via `remainder` (a `&mut &str`
//           pointing into `input`'s lifetime). Stops at the first byte
//           that introduces a non-literal regex construct.
// Why:      Extracted from the original inline walk so it can be reused
//           between the leading pass and the post-skip passes. Same
//           literal-recognition rules as before: punctuation escapes
//           (`\.`, `\*`, ...) become their literal char; metacharacters
//           (`. * + ? | ( [ { $ ^`) end the walk; non-punctuation
//           escapes (`\d`, `\w`, ...) end the walk.
// TS map:   `function walkLiteralBytes(input: string, out: string[]): { remainder: string }`.
//
// In TS you'd write (pseudocode):
// ```ts
// function walkLiteralBytes(input: string, out: string[]) {
//   let i = 0;
//   while (i < input.length) {
//     const c = input.charCodeAt(i);
//     if (c === 0x5c /* \\ */) { /* punctuation-escape -> push, else break */ }
//     else if ('.*+?|([{$^'.includes(input[i])) break;
//     else { out.push(input[i]); i += 1; }
//   }
//   return { remainder: input.slice(i) };
// }
// ```
pub(super) fn walk_literal_bytes<'a>(
    input: &'a str,
    out: &mut String,
    remainder: &mut &'a str,
) {
    let bytes = input.as_bytes();
    let mut i = 0usize;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'|' {
            // What:     Top-level alternation `|` makes the substring
            //           on either side of `|` not required (could be
            //           the other branch instead). Force the walker
            //           to bail; the caller's outer logic must then
            //           reject the whole scope as a candidate (see
            //           `extract_required_prefix` -- it tracks
            //           alternation via the helper below).
            // Why:      Without this, `/foobar|barfoo/` would extract
            //           "foobar" and AC-gate on it, missing files that
            //           contain only "barfoo". Soundness bug.
            // TS map:   `if (c === "|") break;`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (c === "|") break;
            // ```
            break;
        }
        if c == b'\\' {
            if i + 1 >= bytes.len() {
                break;
            }
            let next = bytes[i + 1];
            // What:     ASCII alphanumeric escapes (`\w`, `\d`, `\s`,
            //           `\b`, `\A`, `\Z`, `\n`, etc.) are SPECIAL --
            //           they should end the walk, not contribute a
            //           literal character. Everything else after `\`
            //           is treated as that character literal (`\_` ->
            //           `_`, `\=` -> `=`, `\:` -> `:`, etc.). Resharp's
            //           grammar accepts `\X` as the literal X for any
            //           non-special X; the walker mirrors that.
            // Why:      The previous allowlist of punctuation escapes
            //           missed `\_` -- which is common in
            //           betterleaks-shape rules (e.g. `doo\_v1\_`
            //           pattern bodies). 25+ rules with `\_` were
            //           falling into the residual bucket purely
            //           because the walker bailed on `\_`.
            // TS map:   `if (/[A-Za-z0-9]/.test(next)) break; else { out += next; i += 2; }`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (/[A-Za-z0-9]/.test(next)) break;
            // out += next; i += 2;
            // ```
            if next.is_ascii_alphanumeric() {
                break;
            }
            out.push(next as char);
            i += 2;
            continue;
        }
        // What:     `matches!(c, b'.' | ...)` -- match-as-expression.
        //           Returns true when `c` is any regex metacharacter
        //           that ends a literal run.
        // Why:      These characters introduce non-literal regex
        //           constructs the walker is not equipped to handle
        //           inline; the outer `extract_required_prefix` loop
        //           may resume after them via `skip_atom_with_extract`.
        // TS map:   `if ('.*+?([{$^'.includes(c)) break;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if ('.*+?([{$^'.includes(c)) break;
        // ```
        if matches!(c, b'.' | b'*' | b'+' | b'?' | b'(' | b')' | b'[' | b']' | b'{' | b'}' | b'$' | b'^') {
            break;
        }
        out.push(c as char);
        i += 1;
    }
    *remainder = &input[i..];
}

// What:     `fn skip_atom_with_extract(s, ci) -> Option<(&str, Option<Vec<(String, bool)>>)>`
//           recognizes one head atom, advances past it AND its
//           quantifier, and optionally returns a Vec of (substring, ci)
//           pairs extracted from a `(?:body)` / `(body)` / `(?flags:body)`
//           group whose body's recursive `extract_scope` returned
//           `Some`. Returns `None` only when the head is not a
//           recognised atom (so the outer walker should stop).
//
//           Recognised heads:
//           - `[ ... ]<quantifier>` (character class with any quantifier)
//           - `\d|\w|\s|\D|\W|\S<quantifier>` (perl-class escape with any quantifier)
//           - `(?: body )<quantifier>` and `( body )<quantifier>`:
//             non-capturing or capturing group; recurses via
//             `extract_scope` into body with the SAME ci as the caller
//             (no flag change at this scope).
//           - `(?flags)`: inline flag group, no body. Transparent atom,
//             no extraction.
//           - `(?flags:body)<quantifier>`: scoped flag group. Computes
//             the body's effective ci by applying `i` / `-i` flags to
//             the caller's ci, then recurses into body via
//             `extract_scope` with the new ci. Each substring extracted
//             from the body is tagged with the body's effective ci, so
//             a scoped `(?-i:foo)` inside an outer `(?i)` correctly
//             registers `foo` in the case-sensitive AC bucket.
//
//           A REQUIRED quantifier is `+`, `{N}`, `{N,}`, or `{N,M}`
//           with N>=1, or absence of quantifier. Optional quantifiers
//           (`?`, `*`, `{0}`, `{0,N}`, `{0,}`) are still recognised so
//           the walker advances past them; their group body never
//           contributes a substring even if it has one (because the
//           body may match zero times).
// Why:      Multi-substring contribution from a group body is the key
//           win: `(?:foo|bar)keyword` -- the `(?:...)` body returns
//           [("foo", ci), ("bar", ci)], an alternation gate. The walker
//           compares that against "keyword" and picks whichever is
//           more selective for THIS branch's best-candidate slot.
//           Scoped-flag handling drains betterleaks-shape rules whose
//           required keyword sits inside a `(?-i:...)` or `(?i:...)`
//           scope (e.g. L135 `(?-i:[Mm]eraki|MERAKI)` -> drains to cs
//           AC under `Meraki`/`meraki`/`MERAKI`).
// TS map:   `function skipAtomWithExtract(s: string, ci: boolean): { remainder: string; extracted: Array<{sub:string; ci:boolean}> | null } | null`.
//
// Clippy lint suppressed: the return tuple's two-level Option/Vec/tuple is
// the natural shape (remainder slice + optional list of (substring, ci)
// pairs); aliasing it to a `type Extracted<'a>` would only rename the noise.
#[allow(clippy::type_complexity)]
pub(super) fn skip_atom_with_extract(
    s: &str,
    ci: bool,
) -> Option<(&str, Option<Vec<(String, bool)>>)> {
    let bytes = s.as_bytes();
    if bytes.is_empty() {
        return None;
    }

    // Character class `[...]`
    if bytes[0] == b'[' {
        let after_class = skip_class_body(s)?;
        let after_quant = skip_any_quantifier(after_class);
        return Some((after_quant, None));
    }

    // Perl-class escape `\d`, `\w`, `\s`, `\D`, `\W`, `\S`
    if bytes.len() >= 2 && bytes[0] == b'\\' {
        match bytes[1] {
            b'd' | b'w' | b's' | b'D' | b'W' | b'S' => {
                let after_quant = skip_any_quantifier(&s[2..]);
                return Some((after_quant, None));
            }
            _ => {}
        }
    }

    // What:     Group: `(?:body)`, `(body)`, or inline `(?flags)`.
    //           For an inline `(?flags)` group with no body, treat as a
    //           transparent atom (advance past, no extraction). For a
    //           true group, find the matching close paren via
    //           `find_matching_close_paren`, recurse into the body to
    //           pull out a required substring (if quantifier permits),
    //           and advance past the quantifier.
    // Why:      Group skipping is what enables walking past
    //           `[\w.-]{0,50}` (already an optional class) and pulling
    //           the keyword out of the next `(?:adafruit)` group on
    //           the betterleaks shape.
    // TS map:   no equivalent.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // // group head detection
    // ```
    if bytes[0] == b'(' {
        // Determine if this is `(?flags)` (inline, no body), a scoped
        // flag group `(?flags:body)`, or a regular group `(?:body)` /
        // `(body)`. The inline form is a transparent atom; the scoped
        // form delimits a body whose flag context differs from outer;
        // the regular form is the common case.
        if bytes.len() >= 2 && bytes[1] == b'?' {
            // What:     Walk past `?` and any flag letters/dashes.
            //           `j` ends at either `)` (inline) or `:` (scoped)
            //           or another character (regular group with `(?:`,
            //           `(?<name>`, `(?P<name>`, `(?=...)`, etc.).
            // Why:      Discriminate inline-flag from scoped-flag from
            //           regular group without false-matching `(?:body)`
            //           which has `:` immediately after `?`.
            // TS map:   `let j = 2; while (...) j++;`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // let j = 2;
            // while (j < bytes.length && (isAlpha(bytes[j]) || bytes[j] === '-')) j += 1;
            // ```
            let mut j = 2usize;
            while j < bytes.len() && (bytes[j].is_ascii_alphabetic() || bytes[j] == b'-') {
                j += 1;
            }
            // Inline `(?flags)` -- requires at least one flag char and
            // immediate `)` after the run.
            if j > 2 && j < bytes.len() && bytes[j] == b')' {
                return Some((&s[j + 1..], None));
            }
            // Scoped `(?flags:body)` -- non-zero flag run followed by
            // `:`. Compute the body's effective ci by applying the
            // flag chars to the caller's ci. Standard PCRE/regex_syntax
            // semantics: a `-` divides set-flags from clear-flags;
            // `i` sets case-insensitive, `-i` clears it. Other flags
            // (`s`, `m`, `x`, `U`) don't affect ci tracking and are
            // ignored for the gate purpose. We then recurse into the
            // body via `extract_scope` with body_ci, so each substring
            // extracted from the body is tagged with the body's
            // effective ci. This drains residual rules whose required
            // keyword lives inside a `(?-i:...)` or `(?i:...)` scope.
            if j > 2 && j < bytes.len() && bytes[j] == b':' {
                let flags = &s[2..j];
                let mut body_ci = ci;
                let mut after_dash = false;
                for fc in flags.bytes() {
                    if fc == b'-' {
                        after_dash = true;
                        continue;
                    }
                    if fc == b'i' {
                        body_ci = !after_dash;
                    }
                }
                let close_idx = find_matching_close_paren(s)?;
                let body_start = j + 1;
                let body = &s[body_start..close_idx];
                let after = &s[close_idx + 1..];
                let after_quant = skip_any_quantifier(after);
                let quant_required = quantifier_is_required(after);
                let extraction = if quant_required {
                    extract_scope(body, body_ci)
                } else {
                    None
                };
                return Some((after_quant, extraction));
            }
        }

        let close_idx = find_matching_close_paren(s)?;
        let body_start = group_body_start(s)?;
        let body = &s[body_start..close_idx];
        let after = &s[close_idx + 1..];
        let after_quant = skip_any_quantifier(after);
        let quant_required = quantifier_is_required(after);
        // What:     Recurse via `extract_scope` (NOT the outer wrapper)
        //           because the group body is NOT a top-level scope --
        //           it doesn't strip leading `(?flags)` or anchors.
        //           `extract_scope` does the work that's also done at
        //           top level: split on top-level alternation `|` and
        //           gather each branch's required-substring set.
        // Why:      Calling `extract_gating_substrings` here would
        //           re-strip leading `(?flags)` from the body, which is
        //           wrong: the body's flags belong to its OWN scope and
        //           are already in effect for the body's content. The
        //           outer wrapper only runs once per rule, at the top.
        // TS map:   `extracted = quantRequired ? extractScope(body) : null;`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // extracted = quantRequired ? extractScope(body) : null;
        // ```
        let extraction = if quant_required {
            extract_scope(body, ci)
        } else {
            None
        };
        return Some((after_quant, extraction));
    }

    None
}
