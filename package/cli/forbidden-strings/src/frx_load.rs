//! Loads the scan's rule sets onto the in-house forbidden-regex engine.
//!
//! Stage two of the engine swap (#384) routes rule loading through the stage-one frx
//! compiler instead of the resharp/`regex` pipeline. Two sources feed a scan:
//!
//! - the resolved runtime rules file (the `forbidden-strings.local.txt` precedence
//!   chain), compiled from text at startup via `compile_from_text`; and
//! - the builtin baseline, embedded as a precompiled serialized `RegexSet` and
//!   rebuilt via `load_precompiled` (never recompiled), active only under
//!   `--builtin-rules`.
//!
//! A scan runs each set in order and attributes findings by rule id. The two sets
//! carry independent 0-based id spaces, so the builtin's ids are offset past the
//! runtime set's rule count: the runtime rules keep ids `0..user_len` and the
//! builtin takes `user_len..`, mirroring the old "user rules first, baseline
//! appended" ordering the `--builtin-rules` contract documents.

/// Imports the CLI-boundary error channel and its construction macro.
use anyhow::{anyhow, Result};

/// Imports the engine's compiled-ruleset type held by each loaded set.
use forbidden_regex::RegexSet;

/// Imports the std filesystem module used to read the runtime rules file.
use std::fs;

/// Imports the stage-one frx construction paths (from text and from precompiled bytes).
use crate::{compile_from_text, load_precompiled};

/// One compiled rule set plus the rule-id offset applied to its findings.
///
/// `base` is added to every rule id the set reports, giving each source a disjoint id
/// range in the combined `rule=N` output.
struct ScanSet {
    /// Compiled set whose `line_matches` ids are attributed against `base`.
    set: RegexSet,
    /// Rule-id offset: the runtime set's rule count for the builtin, else 0.
    base: usize,
}

/// The ordered rule sets a scan runs, each contributing offset rule ids.
///
/// Built by [`load`]; consumed by the scan path, which runs every set against each
/// file's lines. Holding the sets in one value keeps the scan loop source-agnostic.
pub struct LoadedRules {
    /// Sets scanned in order: the runtime set first (when present), then the builtin.
    sets: Vec<ScanSet>,
}

/// Reads a value out of a `LoadedRules` for the scan path.
impl LoadedRules {
    /// Iterates each compiled set paired with its rule-id base offset.
    ///
    /// The scan path runs `line_matches` on each `set` and adds `base` to every rule
    /// id before emitting, so runtime and builtin findings never collide on `rule=N`.
    pub(crate) fn iter_sets(&self) -> impl Iterator<Item = (&RegexSet, usize)> {
        return self.sets.iter().map(|scan_set| return (&scan_set.set, scan_set.base))
    }
}

/// Loads the runtime rules file and, under the flag, the precompiled builtin baseline.
///
/// Reads the resolved `rules_path`, compiles it from text, and (when `builtin_rules`)
/// appends the embedded baseline rebuilt from `precompiled`. A missing implicit
/// default file is tolerated only under `--builtin-rules` (the baseline alone scans);
/// an explicitly named missing file, or any other read failure, errors. Every error
/// is redacted: an I/O error names only the path, and a compile error carries only an
/// opaque rule index plus the engine's static reason, never rule text.
pub fn load(
    rules_path: &str,
    builtin_rules: bool,
    explicit: bool,
    precompiled: &[u8],
) -> Result<LoadedRules> {
    let mut sets: Vec<ScanSet> = Vec::new();

    // Read and compile the runtime rules file. A missing implicit default under
    // `--builtin-rules` is the one tolerated absence; every other failure surfaces.
    let user_set: Option<RegexSet> = match fs::read_to_string(rules_path) {
        Ok(text) => Some(
            compile_from_text(&text)
                .map_err(|reason| return anyhow!("rules {}: {}", rules_path, reason))?,
        ),
        Err(error)
            if builtin_rules
                && !explicit
                && error.kind() == std::io::ErrorKind::NotFound =>
        {
            None
        }
        Err(error) => return Err(anyhow!("read rules {}: {}", rules_path, error)),
    };

    // The runtime set takes ids 0..user_len; the builtin baseline is offset past it.
    let mut next_base = 0;
    if let Some(set) = user_set {
        next_base = set.len();
        sets.push(ScanSet { set, base: 0 });
    }

    if builtin_rules {
        let set = load_precompiled(precompiled)
            .map_err(|reason| return anyhow!("builtin baseline: {}", reason))?;
        sets.push(ScanSet { set, base: next_base });
    }

    return Ok(LoadedRules { sets })
}

/// Registers the loader precedence and offset tests (sidecar, lint-exempt).
#[cfg(test)]
#[path = "frx_load_tests.rs"]
mod tests;
