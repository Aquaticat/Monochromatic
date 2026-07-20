//! Stage two of the builtin-baseline generation chain: rewrites the stage-one
//! intermediate into the forbidden-regex dialect and writes the embedded baseline.
//!
//! What: reads the tail-format intermediate the TS porter (stage one,
//! `package/cli/forbidden-strings/src/mise.port-betterleaks.ts`) wrote to
//! `<repo>/.cache/forbidden-strings-builtin-stage1.txt`, rewrites every
//! `/PATTERN/FLAGS` line into the restricted dialect while passing every other line
//! (section headers, comments, blanks) through byte-identically on its original
//! 1-based line, verifies each ported rule through strict
//! `forbidden_regex::RegexSet::new`, proves the whole output loads through the
//! scanner's own tail-format loader, and writes
//! `<repo>/package/cli/forbidden-strings/data/builtin-rules.txt`. Why: the committed
//! baseline stays reproducible from the upstream TOML; run both stages via
//! `mise run //package/cli/forbidden-strings:generate:rules`. This bin was first
//! written for the one-shot #376 port, removed after that cutover, and recovered as
//! the standing stage two when the baseline adopted the tail format.
//!
//! It reuses the sidecar's `normalize` (dialect normalizer) and `port` (its `class_end`
//! span helper) modules; the faithful line-preserving wrapping and escape handling that the
//! bench's context-stripping `port::port` deliberately omits live here.

/// Registers the shared dialect normalizer module (POSIX classes, case flags, capturing
/// groups, quantifier bounding).
#[path = "../normalize.rs"]
mod normalize;

/// Registers the shared porter module; only its `class_end` span helper is reused here, but
/// `normalize` depends on the module so it must be compiled in. This bin exercises a subset
/// of the module, so its context-stripping `port` path is dead here.
#[allow(dead_code)]
#[path = "../port.rs"]
mod port;

/// Registers the case-expansion module: the three-casing expander that rewrites inline `(?i)`
/// scopes into case-sensitive dialect before normalization runs.
#[path = "../caseexpand.rs"]
mod caseexpand;

/// Imports the strict ruleset compiler used as the fail-closed verifier.
use forbidden_regex::RegexSet;

/// Imports the scanner's rule loader, used to prove the written output loads
/// end-to-end through the same tail-format path the runtime uses.
use forbidden_strings::compile_from_text;

/// Imports the exit-code type returned from `main`.
use std::process::ExitCode;

/// Imports the dialect normalizer applied before wrapping.
use crate::normalize::normalize;

/// Imports the inline `(?i)` three-casing expander applied before normalization.
use crate::caseexpand::expand_case;

/// Imports the character-class span helper shared with the porter.
use crate::port::class_end;

/// Sentinel char that stands in for an escaped backslash (`\\`) while `normalize` runs.
///
/// What: U+0001, absent from the printable-ASCII rule corpus. Why: `normalize`'s naive
/// `\_`/`\x60` string replacements would corrupt a `\\_` (escaped backslash then literal
/// underscore) into `\_`; protecting every `\\` as this sentinel across the `normalize`
/// call, then restoring it, keeps escaped backslashes intact.
const SENTINEL: &str = "\u{1}";

//region Escape and whitespace handling

/// Reports whether `\x` is an escape the engine accepts in this position.
///
/// What: the engine's fixed escape vocabulary (shorthands, `\t`, the escaped
/// metacharacters, and escaped whitespace), with `\b` legal only outside a class. Why: any
/// escape outside this set is a hard compile error, so an unnecessary escape of a literal
/// (`\"`) must have its backslash dropped, `\z`/`\n`/`\r` handled specially by the caller.
fn is_allowed_escape(x: u8, in_class: bool) -> bool {
    match x {
        b'd' | b'D' | b'w' | b'W' | b's' | b'S' | b't' => return true,
        b'b' => return !in_class,
        b'.' | b'[' | b']' | b'(' | b')' | b'{' | b'}' | b'?' | b'|' | b'&' | b'~' | b'^'
        | b'$' | b'\\' | b'#' | b'-' | b'/' | b'*' | b'+' => return true,
        other => return other.is_ascii_whitespace(),
    }
}

/// Rewrites escapes and unescaped whitespace that the always-verbose dialect rejects.
///
/// What: `\z` becomes `$` (line end), bare `\n`/`\r` are dropped (a scanned line carries no
/// newline byte), an unnecessary escape of a non-metacharacter becomes the bare literal,
/// unescaped spaces and tabs outside a class are escaped (verbose mode swallows them
/// otherwise), and classes are sanitized in place. Why: turns a PCRE body into one the
/// engine's escape and verbose rules accept without changing which bytes it matches.
fn fix_escapes(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = String::new();
    let mut i = 0;
    while i < b.len() {
        let c = b[i];
        if c == b'\\' {
            if i + 1 >= b.len() {
                out.push('\\');
                i += 1;
                continue;
            }
            let n = b[i + 1];
            if n == b'z' {
                out.push('$');
            } else if n == b'n' || n == b'r' {
                // Dropped: CR and LF never occur inside a single scanned line.
            } else if is_allowed_escape(n, false) {
                out.push('\\');
                out.push(n as char);
            } else {
                out.push(n as char);
            }
            i += 2;
        } else if c == b'[' {
            let end = class_end(b, i);
            out.push_str(&sanitize_class(&s[i..end]));
            i = end;
        } else if c == b' ' || c == b'\t' {
            out.push('\\');
            out.push(c as char);
            i += 1;
        } else {
            out.push(c as char);
            i += 1;
        }
    }
    return out;
}

/// Sanitizes the escapes inside one `[...]` class.
///
/// What: drops `\n`/`\r`, reduces an unnecessary escape to its bare literal, and keeps every
/// engine-legal escape; whitespace and `#` stay literal (a class never runs verbose mode).
/// Why: line 440's base64 class carries `\r\n` continuation bytes the engine rejects, and no
/// class needs a non-metacharacter escaped.
fn sanitize_class(class: &str) -> String {
    let b = class.as_bytes();
    let end = b.len().saturating_sub(1);
    let mut out = String::from("[");
    let mut i = 1;
    while i < end {
        let c = b[i];
        if c == b'\\' && i + 1 < end {
            let n = b[i + 1];
            if n == b'n' || n == b'r' {
                // Dropped inside the class as well.
            } else if is_allowed_escape(n, true) {
                out.push('\\');
                out.push(n as char);
            } else {
                out.push(n as char);
            }
            i += 2;
        } else {
            out.push(c as char);
            i += 1;
        }
    }
    out.push(']');
    return out;
}

//endregion

//region Single-atom operand wrapping

/// Returns the index just past one atom and its optional single quantifier.
///
/// What: consumes an escape, class, group, complement, or literal, then an optional `?` or
/// `{...}`. Why: `is_single_atom` needs the extent of the first postfix unit to decide
/// whether a whole fragment is exactly one atom.
fn unit_end(b: &[u8], start: usize) -> usize {
    let mut i = start;
    match b.get(i) {
        Some(b'\\') => i += if i + 1 < b.len() { 2 } else { 1 },
        Some(b'[') => i = class_end(b, i),
        Some(b'(') => i = matching_close(b, i) + 1,
        Some(b'~') if b.get(i + 1) == Some(&b'(') => i = matching_close(b, i + 1) + 1,
        Some(_) => i += 1,
        None => return i,
    }
    match b.get(i) {
        Some(b'?') => i += 1,
        Some(b'{') => {
            if let Some(rel) = b[i..].iter().position(|&x| return x == b'}') {
                i += rel + 1;
            }
        }
        _ => {}
    }
    return i;
}

/// Reports whether `s` is exactly one atom (with optional quantifier).
///
/// What: true when the first postfix unit spans the whole string. Why: an operand of `|` or
/// `&` must be a single atom; a fragment that already is one needs no `(?:...)` wrapper,
/// keeping the ported rule readable.
fn is_single_atom(s: &str) -> bool {
    if s.is_empty() {
        return false;
    }
    let b = s.as_bytes();
    return unit_end(b, 0) == b.len();
}

/// Re-emits a concatenation, wrapping the alternations inside its groups and complements.
///
/// What: copies escapes and classes verbatim and recurses into each `(?:...)` group and
/// `~(...)` complement with `wrap_alternation`. Why: branch wrapping must reach every
/// nesting level, not just the top.
fn process_seq(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = String::new();
    let mut i = 0;
    while i < b.len() {
        let c = b[i];
        if c == b'\\' {
            out.push('\\');
            if i + 1 < b.len() {
                out.push(b[i + 1] as char);
            }
            i += 2;
        } else if c == b'[' {
            let end = class_end(b, i);
            out.push_str(&s[i..end]);
            i = end;
        } else if c == b'~' && b.get(i + 1) == Some(&b'(') {
            let close = matching_close(b, i + 1);
            out.push_str("~(");
            out.push_str(&wrap_alternation(&s[i + 2..close]));
            out.push(')');
            i = close + 1;
        } else if c == b'(' {
            let close = matching_close(b, i);
            let inner = group_inner_start(b, i);
            out.push_str(&s[i..inner]);
            out.push_str(&wrap_alternation(&s[inner..close]));
            out.push(')');
            i = close + 1;
        } else {
            out.push(c as char);
            i += 1;
        }
    }
    return out;
}

/// Wraps each multi-atom `|` branch of a fragment in a non-capturing group.
///
/// What: splits on top-level `|`; a lone branch is re-emitted, otherwise each branch that is
/// not already a single atom is wrapped in `(?:...)`. Why: the dialect's `|` takes
/// single-atom operands, and wrapping only where required keeps the output minimal.
fn wrap_alternation(s: &str) -> String {
    let branches = split_top_level(s, b'|');
    if branches.len() == 1 {
        return process_seq(&branches[0]);
    }
    let wrapped: Vec<String> = branches
        .iter()
        .map(|branch| {
            let seq = process_seq(branch);
            if is_single_atom(&seq) {
                return seq;
            }
            return format!("(?:{seq})");
        })
        .collect();
    return wrapped.join("|");
}

/// Wraps one `&` operand so it is a single atom.
///
/// What: a complement is already an atom; anything else is wrapped in `(?:...)` unless it
/// already is a single atom. Why: the dialect's `&` requires single-atom operands.
fn wrap_operand(body: &str) -> String {
    let expr = wrap_alternation(body);
    if body.trim_start().starts_with('~') {
        return expr;
    }
    if is_single_atom(&expr) {
        return expr;
    }
    return format!("(?:{expr})");
}

//endregion

//region Byte-cursor helpers

/// Returns the index of the `)` matching the `(` at `open`.
///
/// What: tracks paren depth while skipping escapes and classes. Why: recursion into a group
/// or complement needs its exact extent.
fn matching_close(b: &[u8], open: usize) -> usize {
    let mut depth = 0i32;
    let mut i = open;
    let mut in_class = false;
    while i < b.len() {
        let c = b[i];
        if c == b'\\' {
            i += 2;
            continue;
        }
        if in_class {
            if c == b']' {
                in_class = false;
            }
            i += 1;
            continue;
        }
        match c {
            b'[' => in_class = true,
            b'(' => depth += 1,
            b')' => {
                depth -= 1;
                if depth == 0 {
                    return i;
                }
            }
            _ => {}
        }
        i += 1;
    }
    return b.len().saturating_sub(1);
}

/// Returns the index where a group's inner content starts after its prefix.
///
/// What: skips `(?:` when present, else just the `(`. Why: only the content is rewrapped;
/// the prefix is copied as-is.
fn group_inner_start(b: &[u8], open: usize) -> usize {
    if open + 2 < b.len() && b[open + 1] == b'?' && b[open + 2] == b':' {
        return open + 3;
    }
    return open + 1;
}

/// Splits `s` on a delimiter byte that sits at paren depth zero, outside classes.
///
/// What: an escape-, class-, and depth-aware split. Why: `&` operands and `|` branches must
/// be separated only at the current level.
fn split_top_level(s: &str, delim: u8) -> Vec<String> {
    let b = s.as_bytes();
    let mut parts = Vec::new();
    let mut start = 0;
    let mut depth = 0i32;
    let mut in_class = false;
    let mut i = 0;
    while i < b.len() {
        let c = b[i];
        if c == b'\\' {
            i += 2;
            continue;
        }
        if in_class {
            if c == b']' {
                in_class = false;
            }
            i += 1;
            continue;
        }
        match c {
            b'[' => in_class = true,
            b'(' => depth += 1,
            b')' => depth -= 1,
            _ if c == delim && depth == 0 => {
                parts.push(s[start..i].to_string());
                start = i + 1;
            }
            _ => {}
        }
        i += 1;
    }
    parts.push(s[start..].to_string());
    return parts;
}

//endregion

//region Per-pattern porting

/// Normalizes and escape-fixes one operand into a dialect body, before branch wrapping.
///
/// What: three-casing-expands inline `(?i)` scopes, protects escaped backslashes, runs the
/// shared normalizer (POSIX classes, capturing groups, quantifier bounding; its case-flag
/// strip is now a no-op because `expand_case` already consumed every `(?i)`), restores
/// backslashes, then fixes the remaining escapes and verbose whitespace. Why: `expand_case`
/// must see the raw case flags before normalization, and `normalize`'s naive `\_` replacement
/// would otherwise corrupt an escaped backslash that precedes an underscore.
fn dialect_body(operand: &str) -> String {
    let expanded = expand_case(operand);
    let protected = expanded.replace("\\\\", SENTINEL);
    let normalized = normalize(&protected);
    let restored = normalized.replace(SENTINEL, "\\\\");
    return fix_escapes(&restored);
}

/// Returns the byte length of a leading nullable class-repeat `[...]{0,N}`, or `None`.
///
/// What: matches a class at index zero immediately followed by `{0,N}`. Why: such a repeat
/// is nullable, so under unanchored line search it is pure redundant preceding context.
fn leading_class_repeat_len(s: &str) -> Option<usize> {
    let b = s.as_bytes();
    if b.first() != Some(&b'[') {
        return None;
    }
    let after = class_end(b, 0);
    let rest = s.get(after..)?;
    let bounded = rest.strip_prefix("{0,")?;
    let brace = bounded.find('}')?;
    return Some(after + 3 + brace + 1);
}

/// Strips one leading nullable class-repeat, at the pattern head or just inside a head group.
///
/// What: removes a leading `[...]{0,N}`, or one nested right after a leading `(?:`. Why: the
/// betterleaks generic detectors prepend `[\w.-]{0,50}` context that is redundant under
/// unanchored search but makes the engine's whole-line matcher determinize catastrophically
/// slowly (measured minutes per rule); a leading `\b`/`^` anchor is real and left intact.
fn strip_one_leading(s: &str) -> Option<String> {
    if let Some(end) = leading_class_repeat_len(s) {
        return Some(s[end..].to_string());
    }
    if let Some(rest) = s.strip_prefix("(?:")
        && let Some(end) = leading_class_repeat_len(rest)
    {
        return Some(format!("(?:{}", &rest[end..]));
    }
    return None;
}

/// Repeatedly strips leading nullable class-repeats until none remains.
///
/// What: applies `strip_one_leading` to a fixpoint. Why: a rule may nest a second redundant
/// `[\w.-]{0,50}` just inside its leading group.
fn strip_leading_redundant(s: &str) -> String {
    let mut cur = s.to_string();
    while let Some(next) = strip_one_leading(&cur) {
        cur = next;
    }
    return cur;
}

/// Ports one `/PATTERN/` body into the restricted dialect, faithful except for two
/// semantics-preserving simplifications: leading nullable class-repeats are stripped and the
/// operators' operands are wrapped to single atoms.
///
/// What: splits top-level `&` operands, normalizes and escape-fixes each, strips the leading
/// redundant repeat off the positive operand, then wraps `|` and `&` operands. Why: the port
/// keeps the rule's full match shape (delimiters, interior repeats, trailer) while adapting
/// it to the engine's grammar and clearing the compile-time blowup on leading context.
fn faithful_port(pattern: &str) -> String {
    let operands = split_top_level(pattern, b'&');
    if operands.len() == 1 {
        return wrap_alternation(&strip_leading_redundant(&dialect_body(pattern)));
    }
    let parts: Vec<String> = operands
        .iter()
        .enumerate()
        .map(|(index, operand)| {
            let body = dialect_body(operand);
            let body = if index == 0 { strip_leading_redundant(&body) } else { body };
            return wrap_operand(&body);
        })
        .collect();
    return parts.join("&");
}

/// Reports whether porting `pattern` strips a leading redundant class-repeat.
///
/// What: recomputes the positive operand's dialect body and checks whether the leading strip
/// shortens it. Why: the review report records this semantics-preserving simplification.
fn leading_stripped(pattern: &str) -> bool {
    let operands = split_top_level(pattern, b'&');
    let body = dialect_body(&operands[0]);
    return strip_leading_redundant(&body).len() != body.len();
}

/// Marker prefix identifying the single cross-line curl basic-auth builtin rule.
const CURL_PREFIX: &str = "\\bcurl\\b";

/// Substring at which the curl rule's kept credential shape begins.
const CURL_CREDENTIAL_MARKER: &str = "(?:-u|--user)";

/// Source-pattern prefix identifying the single mongodb connection-string builtin rule.
const MONGODB_PREFIX: &str = "\\b(mongodb";

/// Credential-bearing core the mongodb rule is reshaped to: the scheme, bounded user and
/// password phases, and the `@` delimiter. The delimiter-excluding user and password classes
/// keep the phases deterministic, and dropping the non-secret host, port, replica-set, and path
/// suffix removes the nested counters that determinized past the engine's DFA state cap.
// concat!-split so the credential-shaped byte sequence never sits on one source
// line: the deny-list commit gate scans this file line-by-line, and the compiled
// rule's own shape would otherwise self-match right here.
const MONGODB_CORE: &str = concat!(
    "\\bmongodb(?:\\+srv)?://",
    "[!-9;-~]{3,50}:",
    "[!-?A-~]{3,88}@",
);

/// Ports one rule pattern, reshaping the curl and mongodb rules per the settled decisions.
///
/// What: for the curl rule, drops the leading `\bcurl\b` context and the cross-line window and
/// ports only the `(?:-u|--user)` credential shape onward; for the mongodb rule, emits the
/// credential-bearing core directly; every other rule is ported whole. Why: rule 172 is the
/// only cross-line rule and its credential pair is the payload, and rule 518 otherwise
/// determinizes past the state cap while its non-secret URI suffix carries no leak.
fn port_pattern(pattern: &str) -> (String, bool) {
    if pattern.starts_with(CURL_PREFIX) {
        let idx = pattern
            .find(CURL_CREDENTIAL_MARKER)
            .expect("curl rule contains the -u/--user credential marker");
        return (faithful_port(&pattern[idx..]), true);
    }
    if pattern.starts_with(MONGODB_PREFIX) {
        return (MONGODB_CORE.to_string(), true);
    }
    return (faithful_port(pattern), false);
}

//endregion

//region Line parsing and change classification

/// Splits a `/PATTERN/FLAGS` line into its pattern body and flags slot.
///
/// What: mirrors the scanner's `rule::parse` exactly: a line of two or more bytes starting
/// with `/` whose LAST `/` leaves an all-lowercase flags tail is a regex rule; the body is
/// between the first and last `/`. Why: a rule body carries unescaped `/` (URLs, `[.../]`
/// classes), so anchoring on the last `/` (not the first) matches the loader; anything else
/// is a literal line and returns `None`.
fn extract(line: &str) -> Option<(&str, &str)> {
    if line.len() < 2 || !line.starts_with('/') {
        return None;
    }
    let last = line.rfind('/')?;
    if last == 0 {
        return None;
    }
    let flags = &line[last + 1..];
    if !flags.chars().all(|c| return c.is_ascii_lowercase()) {
        return None;
    }
    return Some((&line[1..last], flags));
}

/// Reports whether a source pattern has an unbounded quantifier outside a class.
///
/// What: an unescaped `*`, `+`, or `{n,}` outside `[...]`. Why: each becomes a bounded form
/// (cap 512), a semantic change worth recording.
fn has_unbounded_quant(s: &str) -> bool {
    let b = s.as_bytes();
    let mut i = 0;
    while i < b.len() {
        match b[i] {
            b'\\' => i += if i + 1 < b.len() { 2 } else { 1 },
            b'[' => i = class_end(b, i),
            b'*' | b'+' => return true,
            b'{' => {
                let Some(rel) = b[i..].iter().position(|&x| return x == b'}') else {
                    i += 1;
                    continue;
                };
                let body = &s[i + 1..i + rel];
                if body.len() >= 2
                    && body.ends_with(',')
                    && body[..body.len() - 1].bytes().all(|x| return x.is_ascii_digit())
                {
                    return true;
                }
                i += rel + 1;
            }
            _ => i += 1,
        }
    }
    return false;
}

/// Reports whether a source pattern carries a bare `\n` or `\r` escape.
///
/// What: a backslash immediately followed by `n` or `r`, skipping escaped backslashes. Why:
/// these are dropped, a (line-scan-inert) change worth recording.
fn has_crlf_escape(s: &str) -> bool {
    let b = s.as_bytes();
    let mut i = 0;
    while i + 1 < b.len() {
        if b[i] == b'\\' {
            if b[i + 1] == b'n' || b[i + 1] == b'r' {
                return true;
            }
            i += 2;
        } else {
            i += 1;
        }
    }
    return false;
}

/// One ported regex rule with its source line, bodies, and change classification.
///
/// What: the 1-based source line, the source and ported pattern bodies, the dropped flags,
/// and the boolean change categories. Why: the verifier and the review report read these.
struct Ported {
    /// One-based source line number, preserved in the output.
    line: usize,
    /// Source pattern body between the delimiters.
    source: String,
    /// Ported pattern body in the restricted dialect.
    ported: String,
    /// Flags slot dropped from the source line (`m`/`x` no-ops).
    flags: String,
    /// Inline case flag (`(?i)`, `(?i:`, `(?-i:`) three-casing-expanded (approximately preserved).
    case: bool,
    /// Unbounded quantifier bounded to the cap.
    quant: bool,
    /// Curl rule reshaped (context and cross-line window dropped).
    reshape: bool,
    /// Bare `\n`/`\r` escape dropped.
    crlf: bool,
    /// `\z` rewritten to `$`.
    zanchor: bool,
    /// Leading nullable class-repeat stripped (semantics-preserving, clears compile blowup).
    leadstrip: bool,
}

/// Classifies and ports one `/PATTERN/FLAGS` line.
///
/// What: extracts the body and flags, ports the body, and records every change category.
/// Why: one place produces both the output line and the review classification.
fn classify(line_no: usize, pattern: &str, flags: &str) -> Ported {
    let (ported, reshape) = port_pattern(pattern);
    return Ported {
        line: line_no,
        source: pattern.to_string(),
        ported,
        flags: flags.to_string(),
        case: pattern.contains("(?i)") || pattern.contains("(?i:") || pattern.contains("(?-i:"),
        // The mongodb reshape drops (does not bound) its unbounded repeats, so it leaves the
        // quantifier-bounding category even though its source carries `*`/`+`.
        quant: has_unbounded_quant(pattern) && !pattern.starts_with(MONGODB_PREFIX),
        reshape,
        crlf: has_crlf_escape(pattern),
        zanchor: pattern.contains("\\z"),
        leadstrip: leading_stripped(pattern),
    };
}

//endregion

//region Source porting and verification

/// Ports one whole rule-file text, keeping every line on its original number.
///
/// What: passes non-`/` lines (literals, comments, blanks) through byte-identically and
/// rewrites each `/PATTERN/FLAGS` line to `/PORTED/` with flags dropped. Why: the 1-based
/// line alignment is load-bearing for the later differential validation.
fn port_source(text: &str) -> (String, Vec<Ported>) {
    let mut out: Vec<String> = Vec::new();
    let mut rules: Vec<Ported> = Vec::new();
    for (index, line) in text.split('\n').enumerate() {
        let Some((pattern, flags)) = extract(line) else {
            // Literal, comment, blank line, or a `/`-line that is not a valid regex rule:
            // pass through byte-identically, keeping the 1-based line alignment.
            out.push(line.to_string());
            continue;
        };
        let ported = classify(index + 1, pattern, flags);
        out.push(format!("/{}/", ported.ported));
        rules.push(ported);
    }
    return (out.join("\n"), rules);
}

/// Strict-compiles every ported rule individually, attributing failures to source lines.
///
/// What: validates the flags slot, then compiles each ported body through strict
/// `RegexSet::new` on a one-element slice (never `compile_lenient`), across a pool of worker
/// threads pulling from a shared index, recording the line and error of any rejection. Why:
/// the port is fail-closed (every rule proven on its own, zero silently dropped); the
/// faithful full-context rules are individually costly to determinize, so the per-rule proofs
/// are fanned out to keep the one-time run bounded.
fn verify(rules: &[&Ported]) -> Vec<(usize, String)> {
    let failures: std::sync::Mutex<Vec<(usize, String)>> = std::sync::Mutex::new(Vec::new());
    for rule in rules {
        if rule.flags.chars().any(|f| return f != 'm' && f != 'x') {
            let mut guard = failures.lock().expect("failures mutex is not poisoned");
            guard.push((rule.line, format!("unexpected flag(s) '{}'", rule.flags)));
        }
    }
    let next = std::sync::atomic::AtomicUsize::new(0);
    let threads = std::thread::available_parallelism().map_or(1, |n| return n.get());
    std::thread::scope(|scope| {
        for _ in 0..threads {
            scope.spawn(|| {
                loop {
                    let index = next.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    let Some(rule) = rules.get(index) else {
                        break;
                    };
                    let start = std::time::Instant::now();
                    let outcome = RegexSet::new(std::slice::from_ref(&rule.ported));
                    let secs = start.elapsed().as_secs_f64();
                    if secs > 1.0 {
                        eprintln!("SLOW line {} took {secs:.1}s", rule.line);
                    }
                    if let Err(error) = outcome {
                        let mut guard = failures.lock().expect("failures mutex is not poisoned");
                        guard.push((rule.line, format!("{error}")));
                    }
                }
            });
        }
    });
    let mut out = failures.into_inner().expect("failures mutex is not poisoned");
    out.sort_by_key(|(line, _)| return *line);
    return out;
}

//endregion

//region Reporting and file output

/// Prints one file's change breakdown and a per-changed-rule dump to stdout.
///
/// What: counts rewritten and semantically-changed rules, prints per-category totals, and
/// emits one `CHANGE` line per changed rule for authoring the review doc. Why: the review
/// doc must list every semantically changed rule with before and after.
fn report(name: &str, rules: &[Ported]) {
    let rewritten = rules.iter().filter(|r| return r.ported != r.source).count();
    let semantic = rules
        .iter()
        .filter(|r| return r.case || r.quant || r.reshape || r.crlf)
        .count();
    let case = rules.iter().filter(|r| return r.case).count();
    let quant = rules.iter().filter(|r| return r.quant).count();
    let reshape = rules.iter().filter(|r| return r.reshape).count();
    let crlf = rules.iter().filter(|r| return r.crlf).count();
    let zanchor = rules.iter().filter(|r| return r.zanchor).count();
    let leadstrip = rules.iter().filter(|r| return r.leadstrip).count();
    let flags = rules.iter().filter(|r| return !r.flags.is_empty()).count();
    println!(
        "[{name}] rules={} rewritten={rewritten} semantic={semantic} (case={case} quant={quant} reshape={reshape} crlf={crlf}) zanchor={zanchor} leadstrip={leadstrip} flag_dropped={flags}",
        rules.len(),
    );
    for rule in rules {
        if rule.case || rule.quant || rule.reshape || rule.crlf || rule.zanchor || rule.leadstrip {
            let mut cats: Vec<&str> = Vec::new();
            if rule.case {
                cats.push("case");
            }
            if rule.quant {
                cats.push("quant");
            }
            if rule.reshape {
                cats.push("reshape");
            }
            if rule.crlf {
                cats.push("crlf");
            }
            if rule.zanchor {
                cats.push("zanchor");
            }
            if rule.leadstrip {
                cats.push("leadstrip");
            }
            println!(
                "CHANGE\t{name}\t{}\t{}\t{}\t{}",
                rule.line,
                cats.join(","),
                rule.source,
                rule.ported,
            );
        }
    }
}

/// Returns the repository root, derived from this crate's compile-time manifest directory.
///
/// What: the manifest dir is `<repo>/package/rust-module/forbidden-regex.bench`; its third
/// ancestor is the repo root. Why: the bin writes to fixed repo-relative paths regardless of
/// its working directory.
fn repo_root() -> std::path::PathBuf {
    let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    return manifest
        .ancestors()
        .nth(3)
        .expect("manifest dir has a repo-root ancestor")
        .to_path_buf();
}

/// Ports the stage-one intermediate, verifies the set, and writes the live baseline.
///
/// What: reads the tail-format intermediate stage one wrote under `.cache/`, ports every
/// `/PATTERN/FLAGS` body, strict-compiles each ported rule with per-line attribution,
/// proves the whole output loads through the scanner's own tail-format loader (headers,
/// name uniqueness, per-section classification), and only then overwrites the committed
/// `data/builtin-rules.txt`. Why: the embedded baseline must stay reproducible and the
/// write must be fail-closed at both the per-rule and whole-file layers.
fn main() -> ExitCode {
    let root = repo_root();
    let stage1_path = root.join(".cache/forbidden-strings-builtin-stage1.txt");
    let stage1_text = std::fs::read_to_string(&stage1_path).unwrap_or_else(|error| {
        panic!(
            "read stage-one intermediate {} (run the TS porter first): {error}",
            stage1_path.display(),
        )
    });

    let (builtin_ported, builtin_rules) = port_source(&stage1_text);

    report("builtin", &builtin_rules);

    // Strict-compile every ported rule (fail-closed); attribute any failure to a line.
    let combined: Vec<&Ported> = builtin_rules.iter().collect();
    let start = std::time::Instant::now();
    let failures = verify(&combined);
    let secs = start.elapsed().as_secs_f64();

    if !failures.is_empty() {
        for (line, error) in &failures {
            eprintln!("FAIL line {line}: {error}");
        }
        return ExitCode::FAILURE;
    }

    // Whole-file proof through the scanner's own loader: catches header grammar
    // breaks, duplicate section names, and per-section classification errors the
    // per-rule compile pass cannot see. The redacted error carries no rule text.
    let set = match compile_from_text(&builtin_ported) {
        Ok(set) => set,
        Err(error) => {
            eprintln!("FAIL tail-format load of ported output: {error}");
            return ExitCode::FAILURE;
        }
    };
    // Every section holds exactly one regex rule, so the loaded set's size must
    // equal the ported rule count; a mismatch means a section was dropped or split.
    if set.len() != builtin_rules.len() {
        eprintln!(
            "FAIL loaded rule count {} != ported rule count {}",
            set.len(),
            builtin_rules.len(),
        );
        return ExitCode::FAILURE;
    }

    let builtin_out = root.join("package/cli/forbidden-strings/data/builtin-rules.txt");
    std::fs::write(&builtin_out, &builtin_ported).expect("write builtin baseline file");

    println!(
        "OK: all {} ported rules compile strictly and the tail file loads ({secs:.1}s wall, parallel); wrote {}",
        combined.len(),
        builtin_out.display(),
    );
    return ExitCode::SUCCESS;
}

//endregion
