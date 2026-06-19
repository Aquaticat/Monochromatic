//! rules engine routing support for the forbidden-strings scanner.
/// Implements `requires_resharp`.
// What:     `fn requires_resharp(src: &str) -> bool` returns `true` when
//           `src` contains any feature the `regex` crate cannot parse
//           OR would parse with semantics different from resharp's.
//           Three feature families trigger true:
//           1. Set-algebra operators: unescaped `&` or `~(` outside a
//              character class (resharp's intersection / complement).
//           2. Lookaround groups: `(?=`, `(?!`, `(?<=`, `(?<!`. The
//              `regex` crate rejects these with "look-around, including
//              look-ahead and look-behind, is not supported"; resharp
//              accepts them.
//           3. Bare `_` outside a character class. Resharp treats `_`
//              as a universal wildcard (matches any single character),
//              while the `regex` crate treats it as a literal underscore.
//              Routing a rule like `pre_post` to the `regex` crate
//              would silently change its meaning -- the rule author
//              wrote a wildcard pattern, the matcher searched for a
//              literal seven-byte string. Escaped (`\_`) and class-
//              internal `_` ([_], [A-Z_]) stay literal in both engines
//              and do not trigger this branch.
//           Conservative: any of the above triggers true, even if the
//           resharp parser would have accepted a sequence the regex
//           crate also accepts (no false-positive cost beyond using the
//           slower engine).
// Why:      We need to dispatch each rule to its engine at compile time.
//           This shallow string scan avoids invoking either engine's
//           parser; the actual parse happens once via the chosen
//           engine. Regex character classes can contain `&` and parens
//           as literal bytes (e.g. `[&a-z]`, `[()]`) without those
//           characters carrying their group/algebra meaning, so we
//           track class membership and skip class interiors. Named
//           captures `(?<name>` / `(?P<name>` and non-capturing groups
//           `(?:` must NOT trigger -- the regex crate handles them --
//           so the lookbehind discriminator is "the byte after `(?<`
//           is `=` or `!`", not "the regex contains `(?<`".
//
// In TS you'd write (pseudocode):
// ```ts
// function requiresResharp(src: string): boolean {
//   // walk bytes, skip \X escapes, track class membership,
//   // return true on outside-class `&`, `~(`, or any of
//   // `(?=`, `(?!`, `(?<=`, `(?<!`.
// }
// ```
pub fn requires_resharp(src: &str) -> bool {
    let bytes = src.as_bytes();
    let mut i = 0usize;
    let mut in_class = false;
    while i < bytes.len() {
        let c = bytes[i];
        if c == b'\\' {
            i += 2;
            continue;
        }
        if !in_class && c == b'[' {
            in_class = true;
            i += 1;
            continue;
        }
        if in_class && c == b']' {
            in_class = false;
            i += 1;
            continue;
        }
        if !in_class {
            if c == b'&' {
                return true;
            }
            if c == b'_' {
                return true;
            }
            if c == b'~' && i + 1 < bytes.len() && bytes[i + 1] == b'(' {
                return true;
            }
            // Lookaround detection. Shape: `(?` followed by `=`/`!` is
            // a lookahead; `(?<` followed by `=`/`!` is a lookbehind.
            // Other `(?...` forms (`(?:`, `(?P<`, `(?<name>`, `(?#...)`,
            // inline flags `(?i)`) are NOT lookarounds and the regex
            // crate handles them, so they must not trigger.
            if c == b'(' && i + 2 < bytes.len() && bytes[i + 1] == b'?' {
                let after = bytes[i + 2];
                if after == b'=' || after == b'!' {
                    return true;
                }
                if after == b'<'
                    && i + 3 < bytes.len()
                    && (bytes[i + 3] == b'=' || bytes[i + 3] == b'!')
                {
                    return true;
                }
            }
        }
        i += 1;
    }
    false
}
