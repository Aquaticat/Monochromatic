// What:     `pub enum ParsedRule { Literal(String), Regex(String) }`
//           declares an enum (Rust's tagged-union; closer to a
//           discriminated union in TS than a TS `enum`). Each variant
//           carries an owned `String` payload: the raw literal text,
//           or the resharp regex source string. `pub` exposes it for
//           `parse_rule_source`'s return type.
// Why:      The classifier output of `parse_rule_source`. Downstream
//           code splits these into the AC bucket vs the regex bucket.
// TS map:   `type ParsedRule = { kind: "literal"; text: string } | { kind: "regex"; src: string };`.
//
// In TS you'd write (pseudocode):
// ```ts
// type ParsedRule =
//   | { kind: "literal"; text: string }
//   | { kind: "regex"; src: string };
// ```
pub enum ParsedRule {
    Literal(String),
    Regex(String),
}

// What:     `pub fn parse_rule_source(line: &str) -> Option<ParsedRule>`
//           classifies one line of the rules file into a literal or a
//           regex (or `None` for blank/comment lines). `&str` is a
//           borrowed UTF-8 slice; we don't take ownership.
// Why:      Single source of truth for rule syntax. Comments use `#`,
//           blanks are ignored; `/PATTERN/FLAGS` is a regex; everything
//           else is a literal.
// TS map:   `function parseRuleSource(line: string): ParsedRule | null`.
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
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.starts_with('#') {
        return None;
    }
    let bytes = trimmed.as_bytes();
    if bytes.len() >= 2 && bytes[0] == b'/' {
        // What:     `if let Some(last) = trimmed.rfind('/') { ... }` is
        //           one-arm pattern match: `rfind` returns `Option<usize>`,
        //           we enter the block only when `Some`, binding the
        //           inner offset to `last`.
        // Why:      Anchor on the LAST `/` so the regex body itself can
        //           contain escaped slashes.
        // TS map:   `const last = trimmed.lastIndexOf("/"); if (last !== -1) { ... }`.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const last = trimmed.lastIndexOf("/");
        // if (last > 0) { ... }
        // ```
        if let Some(last) = trimmed.rfind('/') {
            if last > 0 {
                let pattern = &trimmed[1..last];
                let flags = &trimmed[last + 1..];
                let flags_ok = flags.chars().all(|c| c.is_ascii_lowercase());
                if flags_ok {
                    let mut out = String::new();
                    if !flags.is_empty() {
                        out.push_str("(?");
                        out.push_str(flags);
                        out.push(')');
                    }
                    out.push_str(pattern);
                    return Some(ParsedRule::Regex(out));
                }
            }
        }
    }
    Some(ParsedRule::Literal(trimmed.to_string()))
}
