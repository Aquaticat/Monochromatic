//! Redacted cache diagnostics shared by scanner output and cli-git parsing.
//!
//! Every value is a closed enum rendered as one compact JSON line. The renderer
//! interpolates only fixed ASCII tokens, so rule text, source paths, cache paths,
//! digests, and operating-system errors cannot reach stderr through this module.

/// Cache condition that forced text compilation or prevented artifact publication.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum CacheWarningReason {
    /// Expected content-addressed artifact did not exist.
    Missing,
    /// Per-user cache root could not be resolved or used.
    CacheRootUnavailable,
    /// Existing artifact could not be read completely.
    Unreadable,
    /// Envelope digest disagreed with current source content.
    SourceMismatch,
    /// Envelope belongs to another schema, scanner, or platform.
    Incompatible,
    /// Envelope framing, names, or engine bytes failed validation.
    Invalid,
    /// Compiled snapshot remained usable but atomic publication failed.
    WriteFailed,
}

/// Recovery action taken after a cache warning.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum CacheRecovery {
    /// Scanner compiled authoritative text before scanning.
    CompileFromText,
    /// Scanner retained already compiled in-memory rules after a write failure.
    ContinueWithCompiledRules,
}

/// One valid cache-warning record with a reason and its permitted recovery.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct CacheWarning {
    /// Closed cache condition.
    reason: CacheWarningReason,
    /// Closed recovery paired with condition.
    recovery: CacheRecovery,
}

/// Cache-warning constructors and fixed-token rendering.
impl CacheWarning {
    /// Builds a warning for any condition recovered by compiling authoritative text.
    pub(crate) fn compile_from_text(reason: CacheWarningReason) -> Self {
        debug_assert!(reason != CacheWarningReason::WriteFailed);
        return Self { reason, recovery: CacheRecovery::CompileFromText }
    }

    /// Builds the only warning recovered by retaining already compiled rules.
    pub(crate) fn write_failed() -> Self {
        return Self {
            reason: CacheWarningReason::WriteFailed,
            recovery: CacheRecovery::ContinueWithCompiledRules,
        }
    }

    /// Returns warning reason for tests and protocol adapters.
    pub(crate) fn reason(&self) -> CacheWarningReason {
        return self.reason
    }

    /// Returns warning recovery for tests and protocol adapters.
    pub(crate) fn recovery(&self) -> CacheRecovery {
        return self.recovery
    }
}

/// Returns fixed JSON token for one warning reason.
fn reason_token(reason: CacheWarningReason) -> &'static str {
    if reason == CacheWarningReason::Missing {
        return "missing";
    }
    if reason == CacheWarningReason::CacheRootUnavailable {
        return "cache-root-unavailable";
    }
    if reason == CacheWarningReason::Unreadable {
        return "unreadable";
    }
    if reason == CacheWarningReason::SourceMismatch {
        return "source-mismatch";
    }
    if reason == CacheWarningReason::Incompatible {
        return "incompatible";
    }
    if reason == CacheWarningReason::Invalid {
        return "invalid";
    }
    return "write-failed"
}

/// Returns fixed JSON token for one recovery action.
fn recovery_token(recovery: CacheRecovery) -> &'static str {
    if recovery == CacheRecovery::CompileFromText {
        return "compile-from-text";
    }
    return "continue-with-compiled-rules"
}

/// Renders compact single-line JSON without accepting arbitrary values.
impl std::fmt::Display for CacheWarning {
    /// Writes exact schema-version-1 protocol record.
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        return write!(
            formatter,
            "{{\"type\":\"forbidden-strings/cache-warning\",\"schemaVersion\":1,\"reason\":\"{}\",\"recovery\":\"{}\"}}",
            reason_token(self.reason),
            recovery_token(self.recovery),
        )
    }
}

/// Registers closed-protocol tests.
#[cfg(test)]
#[path = "warning_tests.rs"]
mod tests;
