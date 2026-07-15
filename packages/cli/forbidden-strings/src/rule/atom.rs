//! rules atom support for the forbidden-strings scanner.
/// Imports dependencies used by this module.
use super::regex_syntax::{
    find_matching_close_paren, group_body_start, quantifier_is_required, skip_any_quantifier,
    skip_class_body,
};
/// Imports dependencies used by this module.
use super::walker::extract_scope;

/// Implements `walk_literal_bytes`.
// What:     `fn walk_literal_bytes(input, out, remainder)` walks `input`
//           character by character (UTF-8 aware), pushing literal
//           characters into `out` and returning the un-walked tail via
//           `remainder` (a `&mut &str` pointing into `input`'s
//           lifetime). Stops at the first character that introduces a
//           non-literal regex construct.
// Why:      Extracted from the original inline walk so it can be reused
//           between the leading pass and the post-skip passes.
//           Literal-recognition rules: punctuation escapes (`\.`,
//           `\*`, ...) become their literal char; metacharacters
//           (`. * + ? | ( [ { $ ^ & ~`) end the walk; non-punctuation
//           escapes (`\d`, `\w`, ...) end the walk. Iterating by
//           `char` (not `u8`) is required for soundness: a previous
//           byte-by-byte version cast each `u8` to `char`, which
//           mangled multi-byte UTF-8 sequences (em-dash `—` =
//           `\xe2\x80\x94` became 6 mojibake bytes), producing AC
//           gating patterns that never matched the file's original
//           bytes and silently disabling the rule.
//
// In TS you'd write (pseudocode):
// ```ts
// function walkLiteralBytes(input: string, out: string[]) {
//   let tail = input;
//   while (tail.length > 0) {
//     const c = tail[0];
//     if (c === "|") break;
//     if (c === "\\") {
//       const next = tail[1];
//       if (next === undefined) break;
//       if (/[A-Za-z0-9]/.test(next)) break;
//       out.push(next); tail = tail.slice(2); continue;
//     }
//     if ('.*+?([{$^&~'.includes(c)) break;
//     out.push(c); tail = tail.slice(1);
//   }
//   return { remainder: tail };
// }
// ```
pub fn walk_literal_bytes<'a>(
    input: &'a str,
    out: &mut String,
    remainder: &mut &'a str,
) {
    // What:     `let mut tail: &'a str = input;`. `tail` is the
    //           un-walked remainder, sliced off the front each
    //           iteration. `&str` is a borrowed string slice (NOT a
    //           `String`, which would be heap-allocated and owned).
    //           The lifetime `'a` from the signature ensures `tail`
    //           cannot outlive the original `input` slice.
    // Why:      Walking by re-binding `tail = chars.as_str()` after
    //           consuming each char is what makes this function
    //           UTF-8 correct: `chars.as_str()` always returns a
    //           valid char-boundary slice, so `out` only ever
    //           receives whole UTF-8 characters.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let tail = input;
    // ```
    let mut tail = input;
    while !tail.is_empty() {
        // What:     `let mut chars = tail.chars();`. `tail.chars()`
        //           returns a `Chars` iterator that yields one
        //           Unicode `char` per call to `.next()`, decoded
        //           from `tail`'s UTF-8 bytes. `mut` because
        //           `.next()` advances internal state.
        // Why:      Iterating by `char` (not `u8`) is the whole
        //           soundness fix; see function-level comment above.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const chars = tail[Symbol.iterator]();
        // ```
        let mut chars = tail.chars();
        // What:     `chars.next().expect("non-empty")`. `.next()` on
        //           a `Chars` iterator returns `Option<char>`:
        //           `Some(c)` if a char remains, `None` otherwise.
        //           `.expect(msg)` extracts the inner `char` if
        //           `Some`, panics with `msg` if `None`.
        // Why:      The `while !tail.is_empty()` guard above
        //           guarantees at least one `char` remains.
        //           `expect` (rather than `unwrap`) leaves an audit
        //           trail explaining why this can't be `None`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const c = tail[0]!;
        // ```
        let c = chars.next().expect("non-empty");
        if c == '|' {
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
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (c === "|") break;
            // ```
            break;
        }
        if c == '\\' {
            // What:     `let after_bs: &str = chars.as_str();`.
            //           `chars.as_str()` returns the borrowed slice
            //           of `tail` that comes AFTER the chars already
            //           consumed by the iterator. Since we just
            //           consumed `\`, `after_bs` points at whatever
            //           follows the backslash.
            // Why:      Peek the char after `\` without re-decoding
            //           from the front of `tail`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const afterBs = tail.slice(1);
            // ```
            let after_bs = chars.as_str();
            // What:     `let Some(next) = after_bs.chars().next()
            //           else { break; };` is a "let-else" binding.
            //           If `chars().next()` returns `Some(next_char)`,
            //           bind `next` to the inner `char` and fall
            //           through. If `None` (empty after `\`), execute
            //           the `else` branch -- which `break`s the outer
            //           loop.
            // Why:      A backslash at end-of-input is not a complete
            //           escape; matches the original byte-walker's
            //           "`i + 1 >= bytes.len()` -> break" check.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const next = afterBs[0];
            // if (next === undefined) break;
            // ```
            let Some(next) = after_bs.chars().next() else {
                break;
            };
            // What:     ASCII alphanumeric escapes (`\w`, `\d`, `\s`,
            //           `\b`, `\A`, `\Z`, `\n`, etc.) are SPECIAL --
            //           they end the walk, not contribute a literal
            //           character. Everything else after `\` is
            //           treated as that character literal (`\_` ->
            //           `_`, `\=` -> `=`, `\:` -> `:`, `\—` -> `—`).
            //           Resharp's grammar accepts `\X` as literal `X`
            //           for any non-special `X`; the walker mirrors
            //           that.
            // Why:      The previous allowlist of punctuation escapes
            //           missed `\_` -- common in betterleaks-shape
            //           rules. The non-ASCII case (`\—`) was also
            //           silently broken under the byte-cast bug.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (/[A-Za-z0-9]/.test(next)) break;
            // ```
            if next.is_ascii_alphanumeric() {
                break;
            }
            // What:     `out.push(next);` appends `char` `next` to the
            //           owned `String` `out`, encoding it as 1 to 4
            //           UTF-8 bytes depending on `next`'s codepoint.
            //           Was `out.push(next as char);` previously --
            //           THAT was the bug, because `next` was a `u8`
            //           (one UTF-8 byte) and `as char` produced a
            //           single codepoint U+0000..U+00FF, which
            //           mangles multi-byte sequences.
            // Why:      Punctuation escape `\X` contributes literal
            //           `X` to the prefix. Pushing the whole `char`
            //           preserves original UTF-8 bytes.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // out += next;
            // ```
            out.push(next);
            // What:     `tail = &after_bs[next.len_utf8()..];`.
            //           `next.len_utf8()` returns how many UTF-8
            //           bytes `next` occupies (1 for ASCII, 2 for
            //           Latin-1 supplements like `é`, 3 for most
            //           BMP including em-dash `—`, 4 for emoji).
            //           `&after_bs[N..]` is byte-slicing that
            //           returns the subslice starting at byte index
            //           `N`; lands on a valid char boundary because
            //           `len_utf8()` is the exact byte count.
            // Why:      Advance `tail` past `\next`. Hard-coding `2`
            //           (one byte for `\`, one byte for `next`)
            //           would re-introduce the bug: for `\—`, `next`
            //           is 3 bytes wide, so `tail` would be sliced
            //           mid-character, panicking on the next
            //           iteration's `chars.next()`.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // tail = afterBs.slice(next.length);
            // ```
            tail = &after_bs[next.len_utf8()..];
            continue;
        }
        // What:     `matches!(c, '.' | '*' | ...)` -- macro that
        //           desugars to a `match` returning `bool`. True
        //           when `c` is any regex metacharacter that ends
        //           a literal run.
        // Why:      These characters introduce non-literal regex
        //           constructs the walker is not equipped to handle
        //           inline; the outer `extract_required_prefix` loop
        //           may resume after them via `skip_atom_with_extract`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if ('.*+?()[]{}$^&~'.includes(c)) break;
        // ```
        // What:     `_` is added to the meta-break list as part of the
        //           BUG 10 fix. Resharp treats unescaped `_` as a
        //           universal wildcard (matches any single character);
        //           the literal walker must stop at it so the byte is
        //           NOT pushed into `out`. The escaped form `\_` is
        //           handled by the `c == '\\'` arm above, where it
        //           falls through `is_ascii_alphanumeric() == false`
        //           and gets pushed as a literal byte -- preserving
        //           the betterleaks `ghp\_[...]` gating shape.
        // Why:      Pre-fix the walker greedily consumed `pre_post`
        //           as a literal seven-byte string. AC then looked for
        //           that literal in file content, but the rule's
        //           actual match is `pre<anychar>post` -- silent gate-
        //           never-fires. Closes the extract-side half of BUG 10.
        if matches!(
            c,
            '.' | '*' | '+' | '?' | '(' | ')' | '[' | ']' | '{' | '}' | '$' | '^' | '&' | '~' | '_'
        ) {
            break;
        }
        // What:     `out.push(c);` pushes `char` `c` into `out`,
        //           re-encoding as 1 to 4 UTF-8 bytes. **This was
        //           the OTHER bug site**: `out.push(c as char);`
        //           where `c` was a `u8`, producing mojibake for
        //           non-ASCII bytes.
        // Why:      Push the literal character and keep walking.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // out += c;
        // ```
        out.push(c);
        // What:     `tail = chars.as_str();`. After `.next()`
        //           consumed `c`, `chars.as_str()` is the borrowed
        //           slice of `tail` starting at the byte
        //           immediately past `c`'s UTF-8 encoding. O(1).
        // Why:      Cheap advance; equivalent to
        //           `&tail[c.len_utf8()..]` but the iterator
        //           already tracks the offset.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // tail = tail.slice(c.length);
        // ```
        tail = chars.as_str();
    }
    // What:     `*remainder = tail;`. `*remainder` derefs the
    //           mutable reference passed in by the caller, assigning
    //           `tail` into whatever `&str` binding the caller owns.
    //           Lifetime `'a` ties `tail`'s borrow to `input`'s, so
    //           the caller's binding is statically guaranteed to be
    //           valid.
    // Why:      Return the un-walked remainder via the out-param,
    //           same contract as before.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // remainderRef.value = tail;
    // ```
    *remainder = tail;
}

/// Implements `skip_atom_with_extract`.
// What:     `fn skip_atom_with_extract(s, ci) -> Option<(&str, Option<Vec<(String, bool)>>, Option<bool>)>`
//           recognizes one head atom, advances past it AND its
//           quantifier, and optionally returns a Vec of (substring, ci)
//           pairs extracted from a `(?:body)` / `(body)` / `(?flags:body)`
//           group whose body's recursive `extract_scope` returned
//           `Some`. The third tuple element is `Some(new_ci)` when the
//           atom was an inline `(?flags)` group that changed the ci
//           context for subsequent atoms; `None` otherwise. Returns
//           `None` only when the head is not a recognised atom (so the
//           outer walker should stop).
//
//           Recognised heads:
//           - `[ ... ]<quantifier>` (character class with any quantifier)
//           - `\d|\w|\s|\D|\W|\S<quantifier>` (perl-class escape with any quantifier)
//           - `(?: body )<quantifier>` and `( body )<quantifier>`:
//             non-capturing or capturing group; recurses via
//             `extract_scope` into body with the SAME ci as the caller
//             (no flag change at this scope).
//           - `~(body)<quantifier>`: resharp complement. Skips the
//             body without extracting from it because complement
//             bytes are excluded, not required.
//           - `(?flags)`: inline flag group, no body. Transparent atom,
//             no extraction, BUT signals the caller via the third tuple
//             element that ci should update for subsequent atoms at the
//             same scope.
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
//
//           Inline-flag ci propagation (BUG 1) is bubbled to the caller
//           via the third tuple element. Previously this arm returned
//           `Some((rest, None))` silently, leaving the caller's ci
//           unchanged so subsequent literals at the same scope were
//           tagged with the original ci, breaking AC routing for rules
//           shaped like `/literalA(?i)keyword-suffix/`.
//
// Clippy lint suppressed: the return tuple's three-level Option/Vec/tuple
// is the natural shape (remainder slice + optional list of (substring, ci)
// pairs + optional ci update); aliasing it to a `type Extracted<'a>` would
// only rename the noise.
#[allow(clippy::type_complexity)]
pub fn skip_atom_with_extract(
    s: &str,
    ci: bool,
) -> Option<(&str, Option<Vec<(String, bool)>>, Option<bool>)> {
    let bytes = s.as_bytes();
    if bytes.is_empty() {
        return None;
    }

    // Character class `[...]`
    if bytes[0] == b'[' {
        let after_class = skip_class_body(s)?;
        let after_quant = skip_any_quantifier(after_class);
        return Some((after_quant, None, None));
    }

    // Perl-class escape `\d`, `\w`, `\s`, `\D`, `\W`, `\S`
    if bytes.len() >= 2 && bytes[0] == b'\\' {
        match bytes[1] {
            b'd' | b'w' | b's' | b'D' | b'W' | b'S' => {
                let after_quant = skip_any_quantifier(&s[2..]);
                return Some((after_quant, None, None));
            }
            _ => {}
        }
    }

    // What:     Resharp universal wildcard `_` -- matches any single
    //           character. Treat as a zero-contribution atom: advance
    //           past the `_` and any quantifier (`_+`, `_*`, `_?`,
    //           `_{N,M}`), contribute nothing to the gating substring
    //           list. The walker can then continue extracting from
    //           surrounding literals on either side.
    // Why:      Closes the extract-side half of BUG 10. Without this
    //           branch, after walk_literal_bytes breaks on `_` the
    //           outer walker calls skip_atom_with_extract, falls
    //           through to the function's tail `None`, and returns
    //           early -- losing any post-`_` literal that could
    //           contribute a longer gating substring. With this
    //           branch, `pre_post` extracts `post` (the longer side)
    //           and `pre_post_suffix` extracts `suffix`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (bytes[0] === '_'.charCodeAt(0)) {
    //   return { remainder: skipAnyQuantifier(s.slice(1)), extracted: null, ciUpdate: null };
    // }
    // ```
    if bytes[0] == b'_' {
        let after_quant = skip_any_quantifier(&s[1..]);
        return Some((after_quant, None, None));
    }

    // What:     Resharp complement `~(body)` is a zero-contribution
    //           algebra atom for extraction. The body is an excluded
    //           language, so literals inside it are NOT required bytes
    //           of a successful match.
    // Why:      Registering complement-body literals as AC gates makes
    //           placeholder exclusions disable real matches. Example:
    //           `ghp\_...&~(ghp\_0{36})` must gate on `ghp_`, not on
    //           the all-zero placeholder body.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (s.startsWith("~(")) {
    //   const closeIdx = findMatchingCloseParen(s.slice(1));
    //   return { remainder: skipAnyQuantifier(s.slice(closeIdx + 2)), extracted: null };
    // }
    // ```
    if bytes.len() >= 2 && bytes[0] == b'~' && bytes[1] == b'(' {
        let close_idx = 1 + find_matching_close_paren(&s[1..])?;
        let after = &s[close_idx + 1..];
        let after_quant = skip_any_quantifier(after);
        return Some((after_quant, None, None));
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
            // immediate `)` after the run. Bubble the updated ci back to
            // the caller so subsequent literals at this scope are tagged
            // with the new ci context. Same dash-aware logic as the
            // scoped form below: a `-` divides set-flags from clear-
            // flags; `i` sets case-insensitive, `-i` clears it. Other
            // flags (`s`, `m`, `x`, `U`) don't affect ci tracking.
            if j > 2 && j < bytes.len() && bytes[j] == b')' {
                // What:     `let flags = &s[2..j];`. Borrowed sub-slice
                //           covering the flag-letter run between `(?`
                //           and `)`. May include a `-` separator.
                // Why:      We need to inspect each flag byte to compute
                //           the updated ci context.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const flags = s.slice(2, j);
                // ```
                let flags = &s[2..j];
                // What:     `let mut new_ci = ci;` plus `let mut after_dash = false;`.
                //           Start from the caller's ci and walk the flag
                //           letters in order, tracking whether we've
                //           crossed the `-` divider. Standard PCRE/regex_syntax
                //           inline-flag semantics.
                // Why:      Mirror the scoped-flag arm below; only the
                //           bubble-up direction differs.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // let newCi = ci;
                // let afterDash = false;
                // for (const fc of flags) {
                //   if (fc === '-') { afterDash = true; continue; }
                //   if (fc === 'i') newCi = !afterDash;
                // }
                // ```
                let mut new_ci = ci;
                let mut after_dash = false;
                for fc in flags.bytes() {
                    if fc == b'-' {
                        after_dash = true;
                        continue;
                    }
                    if fc == b'i' {
                        new_ci = !after_dash;
                    }
                }
                // What:     `Some((&s[j + 1..], None, Some(new_ci)))`.
                //           Third tuple element is `Some(new_ci)`: the
                //           caller's `extract_branch` reads it and
                //           updates its mutable ci binding so subsequent
                //           literals walked at this scope inherit the
                //           new ci tag. We do NOT short-circuit `new_ci
                //           == ci` because the caller's overwrite is
                //           idempotent in that case anyway.
                // Why:      Closes BUG 1: the previous return shape
                //           `Some((rest, None))` left the caller's ci
                //           unchanged, so `/literalA(?i)keyword-suffix/`
                //           tagged `keyword-suffix` with the original
                //           ci=false instead of ci=true, mis-routing it
                //           to the case-sensitive AC bucket.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // return { remainder: s.slice(j + 1), extracted: null, ciUpdate: newCi };
                // ```
                return Some((&s[j + 1..], None, Some(new_ci)));
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
                let mut body_x = false;
                let mut after_dash = false;
                for fc in flags.bytes() {
                    if fc == b'-' {
                        after_dash = true;
                        continue;
                    }
                    if fc == b'i' {
                        body_ci = !after_dash;
                    }
                    // What:     `if fc == b'x'` tracks the free-spacing
                    //           flag for the scoped body. `x` enables
                    //           "extended" mode where unescaped whitespace
                    //           in the regex source is ignored and `#`
                    //           starts a line comment until newline. A
                    //           `(?x:foo bar)` body matches `foobar`, not
                    //           `foo bar`; `(?x:foo # ignore\nbar)` also
                    //           matches `foobar`.
                    // Why:      Closes BUG 9. Pre-fix the body was passed
                    //           verbatim to `extract_scope`, which walked
                    //           the literal bytes and registered the space
                    //           as part of the gating substring. AC then
                    //           looked for the space in file content but
                    //           the actual rule match never contained one
                    //           -- silent gate-never-fires. The body's
                    //           true literal projection under `x` mode
                    //           cannot be computed without an `x`-aware
                    //           rewrite of the extractor; the safe move
                    //           is to extract NOTHING from such a body
                    //           and let outer literals (if any) carry
                    //           the gate. `-x` is the inverse (turn off
                    //           extended mode); supported for symmetry
                    //           with `-i`.
                    if fc == b'x' {
                        body_x = !after_dash;
                    }
                }
                let close_idx = find_matching_close_paren(s)?;
                let body_start = j + 1;
                let body = &s[body_start..close_idx];
                let after = &s[close_idx + 1..];
                let after_quant = skip_any_quantifier(after);
                let quant_required = quantifier_is_required(after);
                let extraction = if quant_required && !body_x {
                    extract_scope(body, body_ci)
                } else {
                    None
                };
                return Some((after_quant, extraction, None));
            }

            // What:     Lookaround detection. Four shapes:
            //           - `(?=body)` positive lookahead: at this position,
            //             `body` must match the input AHEAD without
            //             consuming it.
            //           - `(?!body)` negative lookahead: at this position,
            //             `body` must NOT match the input ahead.
            //           - `(?<=body)` positive lookbehind: at this
            //             position, `body` must have just matched the
            //             input BEHIND.
            //           - `(?<!body)` negative lookbehind: at this
            //             position, `body` must NOT have just matched
            //             behind.
            //           All four are ZERO-WIDTH assertions: they constrain
            //           position but consume no input bytes. We skip the
            //           entire group (find matching `)`, advance past it
            //           and any optional quantifier) and contribute NO
            //           extracted literal.
            // Why:      Pre-fix: a rule like `(?<=[a-z]) -- (?=[a-z])`
            //           had no extractable AC gate; `group_body_start`
            //           returned `None` for `(?<=...)` shape, the walker
            //           bailed, and the rule fell into the slow per-rule
            //           resharp residual scan. Post-fix the lookarounds
            //           are skipped, the outer walker continues past
            //           them, and the literal between or after them
            //           (` -- ` for the example) becomes the AC gate.
            //
            //           Soundness note: a positive lookaround's body
            //           IS required to appear in the matched bytes (just
            //           at a specific zero-width position), so in
            //           principle we could contribute that body as an
            //           AC literal too. A NEGATIVE lookaround's body
            //           must NOT appear at that position, so its body
            //           is unsafe to register as a required literal.
            //           Skipping all four uniformly keeps the code
            //           simple and remains sound; the outer literal
            //           between or after the lookaround is what gates
            //           the rule onto the AC fast path.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const isLookahead =
            //   bytes.length >= 3 && (bytes[2] === 0x3d || bytes[2] === 0x21);
            // const isLookbehind =
            //   bytes.length >= 4 && bytes[2] === 0x3c &&
            //   (bytes[3] === 0x3d || bytes[3] === 0x21);
            // if (isLookahead || isLookbehind) {
            //   const closeIdx = findMatchingCloseParen(s);
            //   if (closeIdx === null) return null;
            //   const after = s.slice(closeIdx + 1);
            //   const afterQuant = skipAnyQuantifier(after);
            //   return { remainder: afterQuant, extracted: null };
            // }
            // ```
            let is_lookahead = bytes.len() >= 3 && (bytes[2] == b'=' || bytes[2] == b'!');
            let is_lookbehind = bytes.len() >= 4
                && bytes[2] == b'<'
                && (bytes[3] == b'=' || bytes[3] == b'!');
            if is_lookahead || is_lookbehind {
                // What:     `find_matching_close_paren(s)?`. The `?`
                //           propagation operator: if the call returned
                //           `Some(idx)`, bind `idx`; if `None`,
                //           early-return `None` from THIS function.
                //           For a lookaround, the close paren we want
                //           is the OUTER `)` matching the leading `(`,
                //           even if the body itself contains nested
                //           groups like `(?=(?:foo|bar))`. The helper
                //           tracks paren depth and class boundaries so
                //           it returns the correct outer `)`.
                // Why:      We need to know how far past the lookaround
                //           to advance the walker; without the close
                //           paren we cannot continue.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const closeIdx = findMatchingCloseParen(s);
                // if (closeIdx === null) return null;
                // ```
                let close_idx = find_matching_close_paren(s)?;
                // What:     `&s[close_idx + 1..]` is a borrowed `&str`
                //           sub-slice from byte `close_idx + 1` to the
                //           end of `s`. The `&` re-borrows; the result
                //           shares `s`'s lifetime so it remains valid
                //           as long as the caller's `s` remains valid.
                // Why:      Drop the lookaround group entirely (opener
                //           `(?=`/`(?!`/`(?<=`/`(?<!`, body, closing
                //           `)`); the walker resumes at the byte after.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const after = s.slice(closeIdx + 1);
                // ```
                let after = &s[close_idx + 1..];
                // What:     `skip_any_quantifier(after)` advances past
                //           any leading `+`/`?`/`*`/`{N,M}` quantifier
                //           and returns the remainder. If no quantifier
                //           is present, returns `after` unchanged.
                // Why:      Lookarounds are zero-width so quantifiers
                //           on them are semantically a no-op, but
                //           PCRE/resharp accept them syntactically.
                //           Skip whatever's there so the walker doesn't
                //           re-encounter it as a stray metacharacter.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const afterQuant = skipAnyQuantifier(after);
                // ```
                let after_quant = skip_any_quantifier(after);
                // What:     `Some((after_quant, None))` constructs the
                //           present variant of `Option`, wrapping a
                //           tuple. First element is the remainder
                //           `&str` for the outer walker to continue on;
                //           second is `Option<Vec<(String, bool)>>` =
                //           `None`, meaning "this atom contributed no
                //           extracted literal."
                // Why:      Tells the outer walker "I consumed bytes,
                //           continue from the new position; I have
                //           nothing to add to the gating set." Same
                //           shape as the character-class and
                //           perl-class arms above.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // return { remainder: afterQuant, extracted: null };
                // ```
                return Some((after_quant, None, None));
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
        return Some((after_quant, extraction, None));
    }

    None
}
