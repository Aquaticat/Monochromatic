//! Parses the tail-format sectioned rule file into named engine-ready rules.
//!
//! A tail-format file is what `tail --verbose -n +1` over per-rule files would
//! produce: `==> name <==` header lines open sections whose bodies are rules.
//! Every section is exactly one rule, so every rule carries its own name. A body
//! with one significant line classifies by the incumbent two-form rule (bare
//! literal or single-line `/PATTERN/FLAGS`); a body with more than one significant
//! line is one verbatim pattern handed to the always-verbose engine, which ignores
//! blank lines and first-column `#` comments itself. Loose-shaped near-headers,
//! duplicate names, empty sections, and pre-header content each fail the load
//! closed with a redacted, line-numbered error. Autodetection and the byte-for-byte
//! legacy path live in the sibling `format` module.

/// Imports the redacted load-error type reported on every fail-closed condition.
use super::error::LoadError;

/// Imports the shared significance test and the two-form single-line compiler.
use super::format::{is_significant, significant_line_pattern};

/// Imports the name-to-line map backing duplicate-name enforcement.
use std::collections::HashMap;

/// The exact prefix a section header line opens with, before the name.
const HEADER_PREFIX: &str = "==> ";

/// The exact suffix a section header line closes with, after the name.
const HEADER_SUFFIX: &str = " <==";

/// One parsed rule: its engine pattern plus its retained section name, if any.
///
/// Tail-format rules carry `Some(name)` (the section identity that will drive the
/// separate rule-identity UX decision); legacy line-based rules carry `None`. This
/// issue keeps finding output unchanged, so the name is retained but not rendered;
/// its first production consumer is duplicate-name enforcement.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct ParsedRule {
    /// Retained section name for a tail-format rule, or `None` for a legacy rule.
    pub(super) name: Option<String>,
    /// Engine-ready pattern the compiler validates and assembles into the set.
    pub(super) pattern: String,
}

/// The classification of one line against the section-header grammar.
enum HeaderKind {
    /// A well-formed strict header carrying its validated section name.
    Strict(
        /// Validated lowercase-kebab-with-dots section name.
        String,
    ),
    /// A loose `==> ... <==` shape whose within-alphabet name fails strict rules.
    Near,
    /// A line that is not header-shaped and stays section-body content.
    NotHeader,
}

/// A section header opened but whose body has not yet been closed and classified.
struct OpenSection<'a> {
    /// Validated section name, moved into the finished rule.
    name: String,
    /// 1-based source line of the header, used for empty-section reporting.
    name_line: usize,
    /// Raw body lines collected verbatim until the next header or end of file.
    body: Vec<&'a str>,
}

/// Reports whether a character may open a strict section name (`[a-z0-9]`).
fn is_name_start(ch: char) -> bool {
    return ch.is_ascii_lowercase() || ch.is_ascii_digit();
}

/// Reports whether a character may continue a strict section name (`[a-z0-9.-]`).
fn is_name_char(ch: char) -> bool {
    return is_name_start(ch) || ch == '.' || ch == '-';
}

/// Classifies one line as a strict header, a near-header, or ordinary content.
///
/// A header is an exact full line `==> ` + name + ` <==`. Only a middle drawn
/// entirely from the strict alphabet `[a-z0-9.-]` is header-shaped, so a middle
/// with an out-of-alphabet byte (uppercase, a slash, a space) such as `X9` or
/// `/etc/passwd` stays content, matching the spec's collision examples. Within the
/// alphabet, a valid first byte is the only remaining strict rule: a leading `.` or
/// `-` is a near-header (a mistyped header), never silently absorbed as content.
fn classify_header(line: &str) -> HeaderKind {
    let Some(rest) = line.strip_prefix(HEADER_PREFIX) else {
        return HeaderKind::NotHeader;
    };
    let Some(middle) = rest.strip_suffix(HEADER_SUFFIX) else {
        return HeaderKind::NotHeader;
    };
    if middle.is_empty() {
        return HeaderKind::NotHeader;
    }
    // An out-of-alphabet middle is ordinary content, never a mistyped header.
    if !middle.chars().all(|ch| return is_name_char(ch)) {
        return HeaderKind::NotHeader;
    }
    let first_ok = middle.chars().next().is_some_and(|ch| return is_name_start(ch));
    if first_ok {
        return HeaderKind::Strict(middle.to_string());
    }
    return HeaderKind::Near;
}

/// Reports whether a line is a strict section header, for format autodetection.
///
/// The sibling `format` module's `parse_patterns` calls this on the first
/// significant line: a strict header there selects the tail-format path, any other
/// shape selects the byte-for-byte legacy path.
pub(super) fn detect_tail_format(text: &str) -> bool {
    for line in text.lines() {
        if !is_significant(line) {
            continue;
        }
        return matches!(classify_header(line), HeaderKind::Strict(_));
    }
    return false;
}

/// Classifies one closed section's body into a single named engine rule.
///
/// Trailing blank lines are the section-separator tail plus any the author left, so
/// they are trimmed before significance is counted and before the verbatim body is
/// formed. A body with no significant line fails closed as an empty section. One
/// significant line classifies by the incumbent two-form rule at `index` (a
/// single-line regex there can still fail the flag policy). More than one keeps the
/// trimmed body verbatim as one pattern, comments and interior blanks included, for
/// the always-verbose engine to consume.
fn finish_section(section: OpenSection<'_>, index: usize) -> Result<ParsedRule, LoadError> {
    let mut end = section.body.len();
    while end > 0 && section.body[end - 1].trim().is_empty() {
        end -= 1;
    }
    let body = &section.body[..end];
    let significant: Vec<&str> =
        body.iter().copied().filter(|&line| return is_significant(line)).collect();
    if significant.is_empty() {
        return Err(LoadError::EmptySection { line: section.name_line });
    }
    let pattern = if significant.len() == 1 {
        significant_line_pattern(significant[0], index)?
    } else {
        body.join("\n")
    };
    return Ok(ParsedRule { name: Some(section.name), pattern });
}

/// Parses BOM-stripped tail-format text into named, engine-ready rules in file order.
///
/// Walks lines once: a strict header closes any open section and opens the next; a
/// near-header, or significant content before the first header, fails closed with
/// its source line; anything else accumulates into the current body. After the
/// walk, name uniqueness is enforced across the whole loaded input by reading each
/// rule's retained name. Rule order is file order, giving deterministic indices.
pub(super) fn parse_sections(text: &str) -> Result<Vec<ParsedRule>, LoadError> {
    let mut rules: Vec<ParsedRule> = Vec::new();
    let mut name_lines: Vec<usize> = Vec::new();
    let mut current: Option<OpenSection<'_>> = None;

    for (offset, line) in text.lines().enumerate() {
        let line_number = offset + 1;
        match classify_header(line) {
            HeaderKind::Strict(name) => {
                if let Some(section) = current.take() {
                    let name_line = section.name_line;
                    rules.push(finish_section(section, rules.len())?);
                    name_lines.push(name_line);
                }
                current = Some(OpenSection { name, name_line: line_number, body: Vec::new() });
            }
            HeaderKind::Near => {
                return Err(LoadError::NearHeader { line: line_number });
            }
            HeaderKind::NotHeader => match current.as_mut() {
                Some(section) => section.body.push(line),
                None => {
                    if is_significant(line) {
                        return Err(LoadError::PreHeaderContent { line: line_number });
                    }
                }
            },
        }
    }
    if let Some(section) = current.take() {
        let name_line = section.name_line;
        rules.push(finish_section(section, rules.len())?);
        name_lines.push(name_line);
    }

    // Autodetection guarantees at least one header reached this path, but fail
    // closed rather than return an empty set if that invariant is ever broken.
    if rules.is_empty() {
        return Err(LoadError::NoRules);
    }

    // Enforce name uniqueness over the whole loaded input; reading each rule's
    // retained name here is the parsed representation's first production consumer.
    let mut seen: HashMap<&str, usize> = HashMap::new();
    for (index, rule) in rules.iter().enumerate() {
        let Some(name) = rule.name.as_deref() else {
            continue;
        };
        if let Some(first) = seen.get(name) {
            return Err(LoadError::DuplicateName {
                first_line: name_lines[*first],
                line: name_lines[index],
            });
        }
        seen.insert(name, index);
    }

    return Ok(rules);
}

/// Registers the header-grammar, section-body, and fail-closed tests (sidecar, lint-exempt).
#[cfg(test)]
#[path = "sections_tests.rs"]
mod sections_tests;
