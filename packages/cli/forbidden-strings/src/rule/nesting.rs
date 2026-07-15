//! rules nesting support for the forbidden-strings scanner.
/// Defines the `TROUBLESHOOT_REF` constant.
// What:     `const TROUBLESHOOT_REF: &str = "..."`. `&str` is a borrowed,
//           read-only view of UTF-8 bytes baked into the binary at compile
//           time (sibling: `String`, a heap-allocated owned buffer). This
//           file keeps its own copy rather than importing `engine.rs`'s
//           private const of the same name.
// Why:      `&str` (not `String`) because the text is a fixed compile-time
//           literal that never changes and never needs to be owned or
//           grown; appending it to error messages only borrows it.
//
// In TS you'd write (pseudocode):
// ```ts
// const TROUBLESHOOT_REF = "See doc/troubleshooting/resharp.md for workarounds.";
// ```
const TROUBLESHOOT_REF: &str = "See doc/troubleshooting/resharp.md for workarounds.";

/// Defines the `MAX_NESTING_DEPTH` constant.
// What:     `const MAX_NESTING_DEPTH: usize = 1_000`. `usize` is the
//           unsigned integer wide enough to count any byte offset on this
//           platform (siblings the reader might expect: `u32`, `u64`,
//           `i32`, `i64`). The `1_000` underscore is digit grouping, the
//           same value as `1000`.
// Why:      `usize` (not `u32`/`u64`) because it is compared against a
//           depth counter that itself indexes source bytes, and the std
//           length/index APIs all speak `usize`, so matching the width
//           avoids casts. The value 1,000 sits below every observed
//           resharp stack-overflow floor: about 1,500 in the debug /
//           fuzz profile and about 20,000 for complement and lookahead
//           nesting in release, and below resharp's `expanded_ast_limit`
//           of 50,000. A cap this low keeps even resharp's recursive
//           `Drop` of the parsed tree shallow enough not to overflow.
//
// In TS you'd write (pseudocode):
// ```ts
// const MAX_NESTING_DEPTH = 1000;
// ```
const MAX_NESTING_DEPTH: usize = 1_000;

/// Implements `nesting_depth`.
// What:     `pub fn nesting_depth(src: &str) -> Option<String>`. Takes a
//           borrowed rule source string (`&str`, not an owned `String`,
//           because it only reads it) and returns `Option<String>`: the
//           present variant `Some(reason)` when the rule nests groups
//           deeper than `MAX_NESTING_DEPTH`, or the absent variant `None`
//           when the rule is within the cap. `Option` is Rust's stand-in
//           for "a value or nothing"; it has no `null`.
// Why:      resharp's parser is iterative, but the passes that walk the
//           parsed tree afterwards (`expanded_ast_size`, the AST-to-node
//           translation, the algebra walks `get_bounded_length` /
//           `reverse` / `der` / `contains_look`, and the recursive `Drop`)
//           are not depth-bounded. Through 0.6.8, deeply nested complement
//           (`~(...)`) or lookaround (`(?=...)`) patterns overflowed the
//           stack and aborted the process with a stack-overflow SIGABRT
//           during `Regex::new`, below resharp's own size guard, which
//           `catch_unwind` cannot intercept. resharp 0.6.9 fixed this
//           upstream: the parser now caps recursion at
//           `DEFAULT_MAX_DEPTH = 1_000`, rejecting over-deep rules with a
//           clean `Parse` error (Bug G in doc/troubleshooting/resharp.md).
//           This cheap source-text scan keeps the same 1_000 cap as
//           belt-and-suspenders, rejecting the rule before resharp ever
//           sees it; over-rejection is fail-closed-safe because the
//           production corpus has no deeply nested rules.
//
// In TS you'd write (pseudocode):
// ```ts
// function nestingDepth(src: string): string | null {
//   // walk bytes; skip char classes and escaped chars; on `(` increment
//   // depth and track the max; on `)` decrement. Return a reason string
//   // when the max exceeds MAX_NESTING_DEPTH, else null.
// }
// ```
pub fn nesting_depth(src: &str) -> Option<String> {
    // What:     `src.as_bytes()` borrows the string as a read-only slice
    //           of raw bytes (`&[u8]`, sibling: an owned `Vec<u8>`). We
    //           scan byte-by-byte rather than char-by-char because every
    //           character that matters here (`(`, `)`, `[`, `]`, `\`) is a
    //           single ASCII byte.
    // Why:      Byte indexing is O(1) and avoids UTF-8 decoding; multi-byte
    //           characters in the rule can only appear as opaque content,
    //           never as the structural punctuation we count.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const bytes = src; // index via charCodeAt
    // ```
    let bytes = src.as_bytes();
    // What:     Four mutable locals. `i` is the scan cursor (`usize`
    //           index). `in_class` is a flag that is true while inside a
    //           `[...]` character class. `depth` is the current open-paren
    //           nesting depth. `max_depth` is the deepest `depth` reached.
    // Why:      A flat byte-scan state machine, the same shape the other
    //           pre-validators in `engine.rs` use; tracking the running
    //           max lets one pass decide acceptance at the end.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let i = 0, inClass = false, depth = 0, maxDepth = 0;
    // ```
    let mut i = 0usize;
    let mut in_class = false;
    let mut depth = 0usize;
    let mut max_depth = 0usize;
    while i < bytes.len() {
        let c = bytes[i];
        // What:     `b'\\'` is a single-byte ASCII literal for the
        //           backslash character (the `b` prefix means "byte", not a
        //           multi-byte `char`). A backslash escapes the next byte,
        //           so `i += 2` skips both this byte and the one it escapes.
        // Why:      An escaped `\(` or `\[` is a literal paren or bracket,
        //           not structural punctuation; skipping the pair keeps the
        //           depth count accurate.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (c === 0x5c /* backslash */) { i += 2; continue; }
        // ```
        if c == b'\\' {
            i += 2;
            continue;
        }
        // What:     Enter a character class on an unescaped `[` when not
        //           already inside one, and leave it on `]`. `b'['` and
        //           `b']'` are single-byte ASCII literals.
        // Why:      Parens inside `[...]` are literal class members, not
        //           groups; the depth counter must ignore them.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (!inClass && c === 0x5b /* [ */) { inClass = true; i += 1; continue; }
        // if (inClass && c === 0x5d /* ] */) { inClass = false; i += 1; continue; }
        // ```
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
            // What:     On an open paren raise `depth` and record it if it
            //           is a new maximum; on a close paren lower `depth`.
            //           `depth.saturating_sub(1)` subtracts 1 but clamps at
            //           0 instead of underflowing (a stray `)` cannot wrap
            //           the unsigned counter around to a huge number).
            // Why:      Every group form (plain `(`, `(?:`, `(?=`, `(?<=`,
            //           and complement `~(`) opens with a literal `(`, so
            //           counting `(` depth covers all of them, including the
            //           complement and lookaround nesting that overflows
            //           resharp.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (c === 0x28 /* ( */) { depth++; if (depth > maxDepth) maxDepth = depth; }
            // else if (c === 0x29 /* ) */) { depth = Math.max(0, depth - 1); }
            // ```
            if c == b'(' {
                depth += 1;
                if depth > max_depth {
                    max_depth = depth;
                }
            } else if c == b')' {
                depth = depth.saturating_sub(1);
            }
        }
        i += 1;
    }
    if max_depth > MAX_NESTING_DEPTH {
        // What:     `Some(format!(...))` builds the present variant of
        //           `Option`, wrapping an owned `String` made by `format!`
        //           (Rust's `printf`-style string builder; `{}` slots take
        //           the trailing arguments in order). This is an early
        //           return, not the tail.
        // Why:      Hand the caller an actionable rejection naming the
        //           measured depth, the cap, and the Bug G context, so the
        //           rule author can flatten or split the rule.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return `rule nests groups ${maxDepth} levels deep, over the ${MAX_NESTING_DEPTH} cap. ... ${TROUBLESHOOT_REF}`;
        // ```
        return Some(format!(
            "rule nests groups {} levels deep, over the {} cap. Deeply nested complement (`~(...)`) or lookaround (`(?=...)`) groups overflowed resharp's stack and aborted the scanner during `Regex::new` through 0.6.8, a SIGABRT `catch_unwind` cannot intercept (Bug G). resharp 0.6.9 caps parser recursion at the same depth upstream; this pre-validator rejects on the source shape first as belt-and-suspenders. Flatten the rule or split it into separate rules. {}",
            max_depth, MAX_NESTING_DEPTH, TROUBLESHOOT_REF
        ));
    }
    // What:     `None` is the absent variant of `Option<String>`, the tail
    //           expression (no trailing `;`), so it is the return value.
    // Why:      Signal "no nesting-depth problem" so `compile_rule_src`
    //           moves on to the next check.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return null;
    // ```
    None
}
