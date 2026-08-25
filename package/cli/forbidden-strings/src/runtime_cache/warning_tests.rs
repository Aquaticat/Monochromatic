//! Cache-warning JSON protocol tests.

use super::{CacheRecovery, CacheWarning, CacheWarningReason};

/// Every load failure renders exact closed JSON without dynamic data.
#[test]
fn load_failure_reasons_render_exact_json() {
    let cases = [
        (CacheWarningReason::Missing, "missing"),
        (CacheWarningReason::CacheRootUnavailable, "cache-root-unavailable"),
        (CacheWarningReason::Unreadable, "unreadable"),
        (CacheWarningReason::SourceMismatch, "source-mismatch"),
        (CacheWarningReason::Incompatible, "incompatible"),
        (CacheWarningReason::Invalid, "invalid"),
    ];
    for (reason, token) in cases {
        let warning = CacheWarning::compile_from_text(reason);
        assert_eq!(warning.reason(), reason);
        assert_eq!(warning.recovery(), CacheRecovery::CompileFromText);
        assert_eq!(
            warning.to_string(),
            format!(
                "{{\"type\":\"forbidden-strings/cache-warning\",\"schemaVersion\":1,\"reason\":\"{token}\",\"recovery\":\"compile-from-text\"}}",
            ),
        );
    }
}

/// Write failure uses only valid continue-with-compiled-rules pairing.
#[test]
fn write_failure_renders_exact_json() {
    let warning = CacheWarning::write_failed();
    assert_eq!(warning.reason(), CacheWarningReason::WriteFailed);
    assert_eq!(warning.recovery(), CacheRecovery::ContinueWithCompiledRules);
    assert_eq!(
        warning.to_string(),
        "{\"type\":\"forbidden-strings/cache-warning\",\"schemaVersion\":1,\"reason\":\"write-failed\",\"recovery\":\"continue-with-compiled-rules\"}",
    );
}
