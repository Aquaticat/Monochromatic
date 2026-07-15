//! rules regex_syntax support for the forbidden-strings scanner.
/// Implements `group_body_start`.
// What:     `fn group_body_start(s: &str) -> Option<usize>` returns the
//           byte offset of the first character of a group's body.
//           For `(body)` it is `1`; for `(?:body)` and `(?P<name>body)`
//           it is the offset just after the opener metadata.
// Why:      Recursion into a group body must skip the opener itself
//           (`(`, `(?:`, `(?P<name>`, `(?<name>`) so the recursive
//           walker sees only the body's regex syntax.
//
// In TS you'd write (pseudocode):
// ```ts
// function groupBodyStart(s: string): number | null {
//   if (s[0] !== "(") return null;
//   if (s[1] !== "?") return 1;
//   if (s[2] === ":") return 3;
//   if (s[2] === "P" && s[3] === "<") return s.indexOf(">", 4) + 1;
//   if (s[2] === "<") return s.indexOf(">", 3) + 1;
//   return 1;  // fallback: best-effort
// }
// ```
pub fn group_body_start(s: &str) -> Option<usize> {
    // What:     `let bytes = s.as_bytes();`. Borrowed `&[u8]` view of
    //           `s`'s UTF-8 bytes. No allocation. `b'('` is a byte
    //           literal -- the `b` prefix on a char literal makes it a
    //           `u8` value (here 0x28, ASCII '('), not a Unicode `char`.
    // Why:      Byte indexing is cheaper than char iteration for the
    //           ASCII-only sentinel checks.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const code = (i: number) => s.charCodeAt(i);
    // if (s.length === 0 || s[0] !== "(") return null;
    // ```
    let bytes = s.as_bytes();
    if bytes.is_empty() || bytes[0] != b'(' {
        return None;
    }
    if bytes.len() < 2 || bytes[1] != b'?' {
        return Some(1);
    }
    if bytes.len() >= 3 && bytes[2] == b':' {
        return Some(3);
    }
    if bytes.len() >= 4 && bytes[2] == b'P' && bytes[3] == b'<' {
        // What:     `let close = s[4..].find('>')?;`. `s[4..]` is a
        //           range slice from byte 4 to the end (borrowed `&str`).
        //           `.find('>')` returns `Option<usize>` -- the byte
        //           offset of the first `>` in that sub-slice, or None.
        //           Trailing `?` operator: unwraps `Some(v)` to `v`,
        //           or early-returns `None` from THIS function if the
        //           result was `None`.
        // Why:      Locate the closing `>` of the `(?P<name>` capture
        //           opener; absence means malformed input -> abort.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const close = s.indexOf(">", 4);
        // if (close === -1) return null;
        // return close + 1;
        // ```
        let close = s[4..].find('>')?;
        return Some(4 + close + 1);
    }
    if bytes.len() >= 3 && bytes[2] == b'<' {
        let close = s[3..].find('>')?;
        return Some(3 + close + 1);
    }
    // (?... unknown shape, e.g. (?=lookahead)/(?!neg)/(?<=...) -- bail.
    None
}

/// Implements `find_matching_close_paren`.
// What:     `fn find_matching_close_paren(s: &str) -> Option<usize>`
//           returns the byte index of the `)` matching the leading `(`
//           in `s`. Handles nested parens, character classes (which
//           don't nest but contain literal `)` as a regular char), and
//           `\X` escapes.
// Why:      Group skipping needs the right closing paren to advance
//           past the whole group, including any nested parens.
//
// In TS you'd write (pseudocode):
// ```ts
// function findMatchingCloseParen(s: string): number | null {
//   if (s[0] !== "(") return null;
//   let depth = 1, i = 1;
//   while (i < s.length) {
//     const c = s[i];
//     if (c === "\\") { i += 2; continue; }
//     if (c === "[") { /* skip class */ }
//     else if (c === "(") depth += 1;
//     else if (c === ")") { depth -= 1; if (depth === 0) return i; }
//     i += 1;
//   }
//   return null;
// }
// ```
pub fn find_matching_close_paren(s: &str) -> Option<usize> {
    let bytes = s.as_bytes();
    if bytes.is_empty() || bytes[0] != b'(' {
        return None;
    }
    let mut depth: usize = 1;
    let mut i: usize = 1;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'\\' {
            i += 2;
            continue;
        }
        if c == b'[' {
            // Skip class body so an unescaped `(`/`)` inside a class
            // doesn't break our paren count. The class body skipper
            // returns the slice AFTER the closing `]`.
            let class_slice = &s[i..];
            if let Some(after_class) = skip_class_body(class_slice) {
                let bytes_consumed = class_slice.len() - after_class.len();
                i += bytes_consumed;
                continue;
            }
            // Malformed class -- bail out.
            return None;
        }
        if c == b'(' {
            depth += 1;
            i += 1;
            continue;
        }
        if c == b')' {
            depth -= 1;
            if depth == 0 {
                return Some(i);
            }
            i += 1;
            continue;
        }
        i += 1;
    }
    None
}

/// Implements `skip_any_quantifier`.
// What:     `fn skip_any_quantifier(s: &str) -> &str` advances past one
//           leading quantifier (required OR optional) and returns the
//           remainder. If no quantifier is present, returns `s`.
// Why:      The new atom-skipper needs to advance past quantifiers
//           regardless of required-vs-optional: the body-extracted
//           literal is contributed only when the quantifier is required,
//           but the walker still has to skip past optional quantifiers
//           in either case so it can keep going.
//
// In TS you'd write (pseudocode):
// ```ts
// function skipAnyQuantifier(s: string): string { /* ... */ }
// ```
pub fn skip_any_quantifier(s: &str) -> &str {
    let bytes = s.as_bytes();
    if bytes.is_empty() {
        return s;
    }
    // What:     `matches!(bytes[0], b'+' | b'?' | b'*')`. The
    //           `matches!` macro returns `true` if its first arg
    //           matches any of the patterns on the right (separated
    //           by `|`). Here it's a tidy alternative to writing
    //           `bytes[0] == b'+' || bytes[0] == b'?' || bytes[0] == b'*'`.
    //           Byte literals `b'+'` etc. are `u8` values (ASCII
    //           codepoints).
    // Why:      Quick membership test against the simple-quantifier
    //           characters.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (s[0] === "+" || s[0] === "?" || s[0] === "*") { ... }
    // ```
    if matches!(bytes[0], b'+' | b'?' | b'*') {
        // Tail `?` (lazy) is OK to also skip; e.g. `++?`
        if bytes.len() >= 2 && bytes[1] == b'?' {
            // What:     `return &s[2..];`. Borrowed sub-slice from
            //           byte 2 to end. `&` re-borrows; the returned
            //           `&str` shares the input's lifetime, so the
            //           caller cannot keep the result past `s`'s
            //           validity.
            // Why:      Hand back the tail past `++?` (two-byte
            //           lazy quantifier) to the caller.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // return s.slice(2);
            // ```
            return &s[2..];
        }
        return &s[1..];
    }
    if bytes[0] == b'{'
        && let Some(close) = s.find('}') {
            // Tail `?` (lazy) after `}` is also part of the quantifier
            // syntax; skip if present.
            let after = close + 1;
            if after < bytes.len() && bytes[after] == b'?' {
                return &s[after + 1..];
            }
            return &s[after..];
        }
    s
}

/// Implements `quantifier_is_required`.
// What:     `fn quantifier_is_required(s: &str) -> bool` returns true
//           if the head of `s` is a quantifier whose lower bound is
//           >= 1 (or there is no quantifier, treating "exactly one"
//           as required).
// Why:      Decides whether the body of a preceding group is required
//           to appear in any match. Optional quantifiers (`?`, `*`,
//           `{0}`, `{0,N}`, `{0,}`) make the group body matchable zero
//           times, so its literal contributes nothing.
//
// In TS you'd write (pseudocode):
// ```ts
// function quantifierIsRequired(s: string): boolean { /* ... */ }
// ```
pub fn quantifier_is_required(s: &str) -> bool {
    let bytes = s.as_bytes();
    if bytes.is_empty() {
        return true; // no quantifier -> exactly one match -> required
    }
    if bytes[0] == b'+' {
        return true;
    }
    if bytes[0] == b'?' || bytes[0] == b'*' {
        return false;
    }
    if bytes[0] == b'{' {
        if let Some(close) = s.find('}') {
            let inner = &s[1..close];
            // What:     `inner.split(',').next().and_then(|n| n.trim().parse::<u32>().ok()).unwrap_or(0)`.
            //           - `.split(',')` returns a lazy iterator of
            //             `&str` segments split by `,`.
            //           - `.next()` returns the FIRST segment as
            //             `Option<&str>`.
            //           - `.and_then(closure)` is "monadic bind" on
            //             `Option`: if the option is `Some(n)`, run
            //             `closure(n)` whose return type is also
            //             `Option<U>`; if `None`, short-circuit.
            //           - Inside the closure: `.trim()` strips
            //             whitespace; `.parse::<u32>()` returns
            //             `Result<u32, ParseIntError>` -- the
            //             `::<u32>` turbofish disambiguates the target
            //             integer type. `.ok()` converts `Result` ->
            //             `Option`, dropping the error.
            //           - `.unwrap_or(0)` extracts the inner `u32` or
            //             substitutes `0` if anything along the chain
            //             produced `None`. Sibling: `unwrap()` would
            //             PANIC on `None`; `unwrap_or_default()` would
            //             use `u32::default()` which is also `0`.
            // Why:      `{N,M}` and `{N,}` and `{N}` all start with
            //           an integer; we want it parsed for the lower
            //           bound check.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const firstNum = parseInt((inner.split(",")[0] ?? "0").trim(), 10) || 0;
            // ```
            let first_num = inner
                .split(',')
                .next()
                .and_then(|n| n.trim().parse::<u32>().ok())
                .unwrap_or(0);
            return first_num >= 1;
        }
        return true;
    }
    true
}

/// Implements `skip_class_body`.
// What:     `fn skip_class_body(s: &str) -> Option<&str>` skips a single
//           bracketed character class starting at the leading `[` of
//           `s` and returns the remainder after the closing `]`.
//           Handles a leading `^` negation and a leading `]` treated as
//           a literal character (e.g. `[]abc]` matches `]ab` etc.).
//           Skips `\X` escape sequences inside the class without
//           interpreting them.
// Why:      Resharp accepts character classes with the same syntax as
//           PCRE/regex_syntax; skipping one body is a flat scan with
//           no nesting (regex character classes don't nest, except via
//           the resharp set-algebra `[A&&B]` form -- which this scan
//           handles correctly because `&&` doesn't open a new class).
//
// In TS you'd write (pseudocode):
// ```ts
// function skipClassBody(s: string): string | null {
//   // walk past `[`, optional `^`, optional immediate `]`-as-literal,
//   // then characters and `\X` escapes until the matching `]`.
// }
// ```
pub fn skip_class_body(s: &str) -> Option<&str> {
    let bytes = s.as_bytes();
    if bytes.is_empty() || bytes[0] != b'[' {
        return None;
    }
    let mut i: usize = 1;
    if i < bytes.len() && bytes[i] == b'^' {
        i += 1;
    }
    if i < bytes.len() && bytes[i] == b']' {
        i += 1;
    }
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'\\' {
            if i + 1 >= bytes.len() {
                return None;
            }
            i += 2;
            continue;
        }
        if c == b']' {
            return Some(&s[i + 1..]);
        }
        i += 1;
    }
    None
}
