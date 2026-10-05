//! What: In-process scanning of caller-owned candidate snapshots.
//! Why: cli-git must scan the selected version's exact bytes and logical name without temporary content files or text parsing.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Load one scanner, then scan immutable candidate identities, names and bytes.
//! ```

/// Import the existing loader, content matcher, pathname masker and redacted result model.
use crate::frx_load::{self, LoadedRules};
use crate::frx_scan::scan_content;
use crate::path_scan::{PathScanRecords, scan_path_records};
use crate::{BUILTIN_NAMES, BUILTIN_PRECOMPILED, BIN_PROBE_SIZE, ScanFinding};
/// Import the incumbent load-error channel and fixed-token cache diagnostics.
use anyhow::Result;
use crate::runtime_cache::CacheWarning;
/// Native paths preserve operating-system encoding until matching/display boundaries.
use std::path::Path;

/// What: Caller-owned identity plus safely displayable results from one exact candidate snapshot.
/// Why: Matching pathname components may have identical masked labels; identity must remain independent of display text.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type CandidateScan = { identity: number; displayPath: string; findings: ScanFinding[]; scannedBytes: number };
/// ```
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CandidateScan {
    /// Opaque identity chosen by the caller, not derived from any possibly redacted pathname.
    pub identity: usize,
    /// Logical pathname with matching components masked and protocol-sensitive characters escaped.
    pub display_path: String,
    /// Structured content/name matches and explicit processing failures.
    pub findings: Vec<ScanFinding>,
    /// Number of bytes inspected after applying the existing binary-prefix policy.
    pub scanned_bytes: usize,
}

/// One loaded ruleset reused across candidate snapshots.
pub struct Scanner {
    /// The incumbent loader retains hybrid runtime rules, embedded baseline and cache warnings.
    loaded: LoadedRules,
}

/// Load once and scan exact snapshots without reading candidate files from the live worktree.
impl Scanner {
    /// What: Load runtime rules and the optional shipped baseline through the incumbent cache/validation path.
    /// Why: The embedding adapter does not create a second compiler, cache or builtin-rules loader.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function loadScanner(runtimeRulesPath, builtinRules, explicitlySelectedPath): Scanner;
    /// ```
    pub fn load(runtime_rules_path: &str, builtin_rules: bool, explicit: bool) -> Result<Scanner> {
        // Propagate the loader's existing redacted failure instead of accepting an incomplete ruleset.
        let loaded: LoadedRules = frx_load::load(runtime_rules_path, builtin_rules, explicit, BUILTIN_PRECOMPILED, BUILTIN_NAMES)?;
        return Ok(Scanner { loaded });
    }

    /// Borrow fixed-token cache warnings without recovering their fields from serialized terminal text.
    pub fn cache_warnings(&self) -> &[CacheWarning] {
        return self.loaded.cache_warnings();
    }

    /// What: Scan a candidate's logical pathname and exact immutable bytes.
    /// Why: Historical/index candidates must never substitute the current worktree file or its temporary materialization name.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// function scan(identity, logicalPath, exactBytes): CandidateScan;
    /// ```
    pub fn scan(&self, identity: usize, logical_path: &Path, bytes: &[u8]) -> CandidateScan {
        // Canonical pathname records own a safe display path before content diagnostics are attached.
        let pathname: PathScanRecords = scan_path_records(logical_path, &self.loaded);
        // Mirror the standalone reader: binary files retain their first 8 KiB, not an invented clean/skip result.
        let probe_length: usize = bytes.len().min(BIN_PROBE_SIZE);
        let probe: &[u8] = &bytes[..probe_length];
        let content: &[u8] = if memchr::memchr(0, probe).is_some() { probe } else { bytes };
        let mut findings: Vec<ScanFinding> = pathname.findings;
        findings.extend(scan_content(content, &self.loaded));
        return CandidateScan {
            identity,
            display_path: pathname.display,
            findings,
            scanned_bytes: content.len(),
        };
    }
}

/// Embedded-consumer controls use cache-free, disposable rule fixtures.
#[cfg(test)]
#[path = "scanner_tests.rs"]
mod tests;
