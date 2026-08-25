//! Runtime rule-cache module.
//!
//! Its interface hides content hashing, platform-root resolution, envelope
//! validation, warning classification, and atomic publication. Scan callers receive
//! compiled rules plus redacted warnings; compile-command callers receive only
//! success or a redacted fatal error.

/// Registers scanner-owned envelope codec.
mod envelope;
/// Registers content key and platform cache path resolution.
mod path;
/// Registers complete read and atomic publication.
mod publish;
/// Registers closed JSON warning protocol.
mod warning;

/// Imports application-level redacted error construction.
use anyhow::{anyhow, Result};

/// Imports scanner rule compiler and compiled bundle.
use crate::{compile_rules, CompiledRules};

/// Imports envelope operations and complete artifact ceiling.
use envelope::{decode, encode, MAX_ARTIFACT_BYTES};
/// Imports source identity and cache-location operations.
use path::{
    cache_location, current_environment, current_platform, resolve_cache_root, source_digest,
    CacheRootError, SourceDigest,
};
/// Imports complete artifact IO operations.
use publish::{publish_artifact, read_artifact, ArtifactReadError};
/// Re-exports warning value for loaded-rules output.
pub(crate) use warning::CacheWarning;
/// Imports closed warning reason values.
use warning::CacheWarningReason;

/// Runtime cache result consumed by frx loader.
pub(crate) struct CacheLoad {
    /// Valid compiled rules from artifact or authoritative text.
    pub(crate) compiled: CompiledRules,
    /// Redacted cache diagnostics emitted before scan findings.
    pub(crate) warnings: Vec<CacheWarning>,
}

/// Loads compatible artifact or compiles and best-effort repairs from one text snapshot.
pub(crate) fn load_or_compile(
    rules_path: &str,
    text: &str,
) -> Result<CacheLoad> {
    let digest = source_digest(text.as_bytes()).map_err(|error| return anyhow!(error))?;
    let environment = current_environment();
    let root = match resolve_cache_root(&environment, current_platform()) {
        Ok(root) => root,
        Err(CacheRootError::InvalidOverride) => {
            return Err(anyhow!(CacheRootError::InvalidOverride));
        }
        Err(CacheRootError::Unavailable) => {
            let compiled = compile_rules(text)?;
            return Ok(CacheLoad {
                compiled,
                warnings: vec![CacheWarning::compile_from_text(
                    CacheWarningReason::CacheRootUnavailable,
                )],
            });
        }
    };
    let location = cache_location(&root, digest);
    match read_artifact(&location.artifact_path, MAX_ARTIFACT_BYTES) {
        Ok(bytes) => match decode(&bytes, digest) {
            Ok(compiled) => return Ok(CacheLoad { compiled, warnings: Vec::new() }),
            Err(error) => {
                return compile_and_repair(
                    rules_path,
                    text,
                    digest,
                    &location,
                    error.warning_reason(),
                );
            }
        },
        Err(ArtifactReadError::Missing) => {
            return compile_and_repair(
                rules_path,
                text,
                digest,
                &location,
                CacheWarningReason::Missing,
            );
        }
        Err(ArtifactReadError::Unreadable) => {
            return compile_and_repair(
                rules_path,
                text,
                digest,
                &location,
                CacheWarningReason::Unreadable,
            );
        }
    }
}

/// Compiles source snapshot and appends write warning when repair cannot publish safely.
fn compile_and_repair(
    rules_path: &str,
    text: &str,
    digest: SourceDigest,
    location: &path::CacheLocation,
    reason: CacheWarningReason,
) -> Result<CacheLoad> {
    let compiled = compile_rules(text)?;
    let mut warnings = vec![CacheWarning::compile_from_text(reason)];
    if !source_path_still_matches(rules_path, digest)
        || encode(&compiled, digest)
            .and_then(|bytes| {
                return publish_artifact(location, &bytes)
                    .map_err(|_| return envelope::EnvelopeError::Invalid)
            })
            .is_err()
    {
        warnings.push(CacheWarning::write_failed());
    }
    return Ok(CacheLoad { compiled, warnings })
}

/// Reports whether authoritative path still contains compiled snapshot bytes.
fn source_path_still_matches(rules_path: &str, expected: SourceDigest) -> bool {
    let Ok(current) = std::fs::read(rules_path) else {
        return false;
    };
    return source_digest(&current).is_ok_and(|digest| return digest == expected)
}

/// Eagerly compiles one explicit rules file into derived per-user cache artifact.
pub(crate) fn compile_rules_file_to_cache(rules_path: &str) -> Result<()> {
    let source_bytes = std::fs::read(rules_path)
        .map_err(|error| return anyhow!("read rules {}: {}", rules_path, error))?;
    let text = std::str::from_utf8(&source_bytes)
        .map_err(|_| return anyhow!("read rules {}: source is not valid UTF-8", rules_path))?;
    let digest = source_digest(&source_bytes).map_err(|error| return anyhow!(error))?;
    let root = resolve_cache_root(&current_environment(), current_platform())
        .map_err(|error| return anyhow!(error))?;
    let location = cache_location(&root, digest);

    if read_artifact(&location.artifact_path, MAX_ARTIFACT_BYTES)
        .is_ok_and(|bytes| return decode(&bytes, digest).is_ok())
    {
        if source_path_still_matches(rules_path, digest) {
            return Ok(());
        }
        return Err(anyhow!("rules {} changed while validating cache", rules_path));
    }

    let compiled = compile_rules(text)
        .map_err(|error| return anyhow!("rules {}: {}", rules_path, error))?;
    if !source_path_still_matches(rules_path, digest) {
        return Err(anyhow!("rules {} changed during compilation", rules_path));
    }
    let artifact = encode(&compiled, digest)
        .map_err(|_| return anyhow!("runtime rules cache artifact could not be encoded"))?;
    publish_artifact(&location, &artifact)
        .map_err(|_| return anyhow!("runtime rules cache artifact could not be published"))?;
    return Ok(())
}

/// Re-exports fuzz-only envelope decoder entry point.
#[cfg(feature = "fuzzing")]
pub fn decode_artifact_for_fuzzing(
    bytes: &[u8],
    source: &[u8],
) -> bool {
    let Ok(digest) = source_digest(source) else {
        return false;
    };
    return decode(bytes, digest).is_ok()
}
