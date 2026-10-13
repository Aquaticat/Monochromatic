//! What:
//!  The exact supported grammar of one policy-proposed Git patch.
//! Why:
//!  A policy patch is untrusted output, so only one ordinary text path, its declared headers
//!  and the candidate base index line may reach `git apply`.
//!  The rules are the incumbent's `validatePolicyPatch`
//!  (`src/policy-engine/commit-transaction-patch.ts`).
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! validatePolicyPatch({ patch, expectedRevision });
//! ```

use super::policy_patch::{PatchError, PolicyPatch};

/// What:
///  The validation input: the proposed patch and the exact candidate blob it must base on.
/// Why:
///   One object keeps the check's two inputs named at every call site.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PatchCheck = { patch: PolicyPatch; expectedRevision: string };
/// ```
pub struct PatchCheck<'a> {
    /// Policy patch under check.
    pub patch: &'a PolicyPatch,
    /// Exact candidate blob revision the patch's index line names as its base.
    pub expected_revision: &'a str,
}

/// What:
///  Directive prefixes a single-file text patch must not contain.
/// Why:
///   Renames, copies, mode changes, binary and deleted or new files change more than the declared text path.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const FORBIDDEN_PATCH_PREFIXES = ['rename from ', 'rename to ', ...];
/// ```
const FORBIDDEN_PATCH_PREFIXES: [&str; 10] = [
    "rename from ",
    "rename to ",
    "copy from ",
    "copy to ",
    "new file mode ",
    "deleted file mode ",
    "old mode ",
    "new mode ",
    "GIT binary patch",
    "Binary files ",
];

/// What:
///  Check a policy patch against the exact supported grammar.
/// Why:
///   Each rule removes one way a proposal could address another path or change another mode.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// validatePolicyPatch({ patch, expectedRevision }); // throws TypeError
/// ```
pub fn validate_policy_patch(check: PatchCheck<'_>) -> Result<(), PatchError> {
    if path_is_unsafe(check.patch.path.as_str()) {
        return Err(PatchError::Rejected(format!(
            "Patch path contains an unsupported delimiter or traversal segment: {}",
            check.patch.path
        )));
    }
    let text: String = String::from_utf8_lossy(check.patch.bytes.as_slice()).into_owned();
    let lines: Vec<&str> = text.split('\n').collect();
    if !headers_are_exact(lines.as_slice(), check.patch.path.as_str(), check.expected_revision) {
        return Err(PatchError::Rejected(format!(
            "Patch must contain exactly declared ordinary text path {}",
            check.patch.path
        )));
    }
    return Ok(());
}

/// What:
///  Whether a repository path has a delimiter or a traversal segment.
/// Why:
///   The path is interpolated into patch headers, so it must not carry line breaks, absolute roots or `.`/`..`.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// patch.path.includes('\n') || patch.path.startsWith('/') || segments.some(isTraversal);
/// ```
fn path_is_unsafe(path: &str) -> bool {
    if path.contains('\n') || path.contains('\r') || path.starts_with('/') {
        return true;
    }
    for segment in path.split('/') {
        if segment == ".." || segment == "." {
            return true;
        }
    }
    return false;
}

/// What:
///  Whether the patch lines carry exactly the declared headers and no other path, mode or directive.
/// Why:
///   `git apply --3way` trusts the headers it reads, so a single-path grammar is checked before Git sees them.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// lines[0] === requiredHeader && counts.every(c => c === 1) && indexHeaders.length === 1;
/// ```
fn headers_are_exact(lines: &[&str], path: &str, expected_revision: &str) -> bool {
    let required: String = format!("diff --git a/{path} b/{path}");
    let old: String = format!("--- a/{path}");
    let new: String = format!("+++ b/{path}");
    if lines.first().copied() != Some(required.as_str()) {
        return false;
    }
    if count_equal(lines, required.as_str()) != 1
        || count_equal(lines, old.as_str()) != 1
        || count_equal(lines, new.as_str()) != 1
    {
        return false;
    }
    let indexes: Vec<&str> = index_headers(lines);
    if indexes.len() != 1 {
        return false;
    }
    let Some(index_line) = indexes.first().copied() else {
        return false;
    };
    let prefix: String = format!("index {expected_revision}..");
    if !index_line.starts_with(prefix.as_str()) || !is_valid_index_header(index_line, expected_revision) {
        return false;
    }
    for line in lines {
        if mismatched_path_directive(line, required.as_str(), old.as_str(), new.as_str())
            || forbidden_directive(line)
        {
            return false;
        }
    }
    return true;
}

/// What:
///  How many lines equal a wanted header.
/// Why:
///   Exactly one declared target means each header appears once.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// lines.filter((line) => line === header).length;
/// ```
fn count_equal(lines: &[&str], wanted: &str) -> usize {
    let mut count: usize = 0;
    for line in lines {
        if *line == wanted {
            count += 1;
        }
    }
    return count;
}

/// What:
///  The `index ` lines of the patch.
/// Why:
///   A single-file patch carries one index line, which names the candidate base.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// lines.filter((line) => line.startsWith('index '));
/// ```
fn index_headers<'a>(lines: &[&'a str]) -> Vec<&'a str> {
    let mut found: Vec<&str> = Vec::new();
    for line in lines {
        if line.starts_with("index ") {
            found.push(*line);
        }
    }
    return found;
}

/// What:
///  Whether a `diff --git`, `---` or `+++` line names a path other than the declared one.
/// Why:
///   A patch that names a second file would change a path the policy did not propose.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// (line.startsWith('diff --git ') && line !== requiredHeader) || ...;
/// ```
fn mismatched_path_directive(line: &str, required: &str, old: &str, new: &str) -> bool {
    return (line.starts_with("diff --git ") && line != required)
        || (line.starts_with("--- ") && line != old)
        || (line.starts_with("+++ ") && line != new);
}

/// What:
///  Whether a line starts with a forbidden directive prefix.
/// Why:
///   Forbidden directives change more than the content of the declared text file.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// FORBIDDEN_PATCH_PREFIXES.some((prefix) => line.startsWith(prefix));
/// ```
fn forbidden_directive(line: &str) -> bool {
    for prefix in FORBIDDEN_PATCH_PREFIXES {
        if line.starts_with(prefix) {
            return true;
        }
    }
    return false;
}

/// What:
///  Whether an index line is `index <base>..<new> <100644|100755>` with the exact base.
/// Why:
///   The base must be the candidate blob, and the new side must be a same-length lowercase object ID.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// const [range, mode] = line.slice(6).split(' '); // range === `${base}..${newId}`
/// ```
fn is_valid_index_header(line: &str, expected_revision: &str) -> bool {
    let Some(fields_text) = line.strip_prefix("index ") else {
        return false;
    };
    let fields: Vec<&str> = fields_text.split(' ').collect();
    let [range_text, mode_text] = fields.as_slice() else {
        return false;
    };
    let range: &str = range_text;
    let mode: &str = mode_text;
    if mode != "100644" && mode != "100755" {
        return false;
    }
    let Some(delimiter) = range.find("..") else {
        return false;
    };
    if range[delimiter + 2..].contains("..") {
        return false;
    }
    let old_revision: &str = &range[..delimiter];
    let new_revision: &str = &range[delimiter + 2..];
    return old_revision == expected_revision
        && new_revision.len() == expected_revision.len()
        && new_revision.bytes().all(is_lowercase_hex_byte);
}

/// What:
///  Whether a byte is a lowercase hexadecimal digit.
/// Why:
///   Git object IDs are lowercase hexadecimal, and a proposal must match that alphabet exactly.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// /^[0-9a-f]$/.test(char);
/// ```
fn is_lowercase_hex_byte(byte: u8) -> bool {
    return byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte);
}
