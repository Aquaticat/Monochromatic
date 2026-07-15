//! rules parse support for the forbidden-strings scanner.
/// Enumerates `ParsedRule` variants.
// What:     `pub enum ParsedRule { Literal(String), Regex(String) }`
//           declares an enum (Rust's tagged-union; closer to a
//           discriminated union in TS than a TS `enum`). Each variant
//           carries an owned `String` payload: the raw literal text,
//           or the resharp regex source string. `pub` exposes it for
//           `parse_rule_source`'s return type.
// Why:      The classifier output of `parse_rule_source`. Downstream
//           code splits these into the AC bucket vs the regex bucket.
//
// In TS you'd write (pseudocode):
// ```ts
// type ParsedRule =
//   | { kind: "literal"; text: string }
//   | { kind: "regex"; src: string };
// ```
pub enum ParsedRule {
    /// Parsed literal rule.
    Literal(
        /// Owned literal text after trimming rule-file whitespace.
        String,
    ),
    /// Parsed regex rule.
    Regex(
        /// Owned resharp-compatible regex source string.
        String,
    ),
}

/// Implements `parse_rule_source`.
// What:     `pub fn parse_rule_source(line: &str) -> Option<ParsedRule>`
//           classifies one line of the rules file into a literal or a
//           regex (or `None` for blank/comment lines). `&str` is a
//           borrowed UTF-8 slice; we don't take ownership.
// Why:      Single source of truth for rule syntax. Comments use `#`,
//           blanks are ignored; `/PATTERN/FLAGS` is a regex; everything
//           else is a literal.
//
// In TS you'd write (pseudocode):
// ```ts
// function parseRuleSource(line: string): ParsedRule | null {
//   const trimmed = line.trim();
//   if (!trimmed || trimmed.startsWith("#")) return null;
//   if (trimmed.length >= 2 && trimmed[0] === "/") {
//     const last = trimmed.lastIndexOf("/");
//     if (last > 0) {
//       const pattern = trimmed.slice(1, last);
//       const flags = trimmed.slice(last + 1);
//       if (/^[a-z]*$/.test(flags)) {
//         const src = flags ? `(?${flags})${pattern}` : pattern;
//         return { kind: "regex", src };
//       }
//     }
//   }
//   return { kind: "literal", text: trimmed };
// }
// ```
pub fn parse_rule_source(line: &str) -> Option<ParsedRule> {
    // What:     `let trimmed = line.trim();`. `&str::trim` returns a
    //           BORROWED `&str` slice with leading/trailing ASCII
    //           whitespace removed -- it does not allocate; the new
    //           slice points into the same backing memory as `line`,
    //           with adjusted start/length.
    // Why:      Whitespace-only lines and indentation should not
    //           influence rule parsing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const trimmed = line.trim();
    // ```
    let trimmed = line.trim();
    if trimmed.is_empty() {
        // What:     `return None;`. `None` is the absent variant of
        //           `Option`. As an early-return statement (with `;`),
        //           it ends the function with the `None` value.
        // Why:      Skip blank lines.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return null;
        // ```
        return None;
    }
    if trimmed.starts_with('#') {
        return None;
    }
    // What:     `let bytes = trimmed.as_bytes();`. `&str::as_bytes`
    //           returns a BORROWED `&[u8]` view of the same memory --
    //           UTF-8-encoded bytes. No allocation, no copy. Sibling:
    //           `trimmed.chars()` would iterate decoded `char` values
    //           (Unicode scalars); we want raw bytes for cheap byte-
    //           level comparisons.
    // Why:      Byte indexing is faster than char iteration for the
    //           ASCII-only sentinel checks below (`b'/'`, `b'#'`).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const bytes = new TextEncoder().encode(trimmed);
    // ```
    let bytes = trimmed.as_bytes();
    if bytes.len() >= 2 && bytes[0] == b'/' {
        // What:     `if let Some(last) = trimmed.rfind('/') { ... }` is
        //           one-arm pattern match: `rfind` returns `Option<usize>`,
        //           we enter the block only when `Some`, binding the
        //           inner offset to `last`.
        // Why:      Anchor on the LAST `/` so the regex body itself can
        //           contain escaped slashes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const last = trimmed.lastIndexOf("/");
        // if (last > 0) { ... }
        // ```
        if let Some(last) = trimmed.rfind('/')
            && last > 0 {
                // What:     `let pattern = &trimmed[1..last];`. Range
                //           indexing `[start..end]` on `&str` returns a
                //           BORROWED `&str` sub-slice (start inclusive,
                //           end exclusive). The leading `&` is the
                //           borrow operator. Sibling: `trimmed[1..last].to_string()`
                //           would allocate a new owned `String`; we
                //           don't need ownership, so a borrow is cheaper.
                // Why:      Extract the regex body between the leading
                //           and trailing `/`.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const pattern = trimmed.slice(1, last);
                // const flags = trimmed.slice(last + 1);
                // ```
                let pattern = &trimmed[1..last];
                let flags = &trimmed[last + 1..];
                // What:     `flags.chars().all(|c| c.is_ascii_lowercase())`.
                //           `.chars()` decodes the `&str` into a
                //           lazy iterator of `char` values (Unicode
                //           scalars). `.all(closure)` returns `true`
                //           if EVERY element satisfies the closure
                //           (or the iterator was empty). The `|c|`
                //           syntax is Rust's closure form (TS arrow
                //           `(c) => ...`).
                // Why:      Validate that the trailing flags portion
                //           is exactly `[a-z]*` -- anything else means
                //           this isn't a regex rule and should fall
                //           through to literal handling.
                //
                // In TS you'd write (pseudocode):
                // ```ts
                // const flagsOk = /^[a-z]*$/.test(flags);
                // ```
                let flags_ok = flags.chars().all(|c| c.is_ascii_lowercase());
                if flags_ok {
                    // What:     `let mut out = String::new();`.
                    //           `String::new()` is the empty-`String`
                    //           constructor; the result is a heap-
                    //           allocated growable UTF-8 buffer that
                    //           OWNS its bytes. `mut` lets us push
                    //           characters onto it. Sibling: `&str`
                    //           cannot grow; we need owned mutable
                    //           string capacity.
                    // Why:      We need a fresh string to assemble the
                    //           regex source `(?flags)pattern`.
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // let out = "";
                    // ```
                    let mut out = String::new();
                    if !flags.is_empty() {
                        // What:     `out.push_str(...)` and `out.push(c)`.
                        //           `push_str` appends a `&str` slice
                        //           to the owned string; `push` appends
                        //           a single `char`. Both grow the
                        //           backing buffer if needed.
                        // Why:      Build the resharp inline-flags
                        //           prefix `(?flags)` followed by the
                        //           pattern body.
                        //
                        // In TS you'd write (pseudocode):
                        // ```ts
                        // out += "(?" + flags + ")";
                        // ```
                        out.push_str("(?");
                        out.push_str(flags);
                        out.push(')');
                    }
                    out.push_str(pattern);
                    // What:     `return Some(ParsedRule::Regex(out));`.
                    //           `Some(...)` is the present variant of
                    //           `Option`; `ParsedRule::Regex(out)`
                    //           constructs the `Regex` variant of the
                    //           enum, MOVING ownership of `out` into
                    //           the variant payload (we no longer have
                    //           access to `out` after this).
                    // Why:      Hand the parsed regex source back as
                    //           "yes, this line is a regex rule".
                    //
                    // In TS you'd write (pseudocode):
                    // ```ts
                    // return { kind: "regex", src: out };
                    // ```
                    return Some(ParsedRule::Regex(out));
                }
            }
    }
    // What:     `Some(ParsedRule::Literal(trimmed.to_string()))` --
    //           function tail expression (no `;`), so its value
    //           returns from the function. `Some(...)` wraps into
    //           `Option`; `ParsedRule::Literal(...)` constructs the
    //           literal variant; `trimmed.to_string()` allocates a
    //           fresh OWNED `String` from the borrowed `&str` so
    //           the returned `ParsedRule` doesn't borrow from
    //           `line` (which would force the caller to keep `line`
    //           alive).
    // Why:      Default classification: any non-blank, non-comment
    //           line that isn't a regex pattern is a literal substring.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return { kind: "literal", text: trimmed };
    // ```
    Some(ParsedRule::Literal(trimmed.to_string()))
}
