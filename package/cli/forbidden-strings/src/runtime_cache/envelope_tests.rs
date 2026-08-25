//! Scanner-owned envelope round-trip and hostile-framing tests.

use super::{decode, encode, EnvelopeError, MAGIC};
use crate::runtime_cache::path::source_digest;

/// Encodes one named tail-format fixture.
fn named_artifact() -> (Vec<u8>, crate::runtime_cache::path::SourceDigest) {
    let source = "==> qqq-one <==\nALPHA_LITERAL_LONG\n==> qqq-two <==\n/BETA[0-9]{2}/\n";
    let digest = source_digest(source.as_bytes()).expect("digest");
    let compiled = crate::compile_rules(source).expect("compile");
    return (encode(&compiled, digest).expect("encode"), digest)
}

/// Named rules retain exact identities and matching behavior.
#[test]
fn named_rules_round_trip() {
    let (bytes, digest) = named_artifact();
    let decoded = decode(&bytes, digest).expect("decode");
    assert_eq!(
        decoded.names,
        vec![Some("qqq-one".to_string()), Some("qqq-two".to_string())],
    );
    assert!(decoded.set.is_match(b"ALPHA_LITERAL_LONG"));
    assert!(decoded.set.is_match(b"BETA42"));
    assert!(!decoded.set.is_match(b"clean"));
}

/// Legacy rules retain unnamed identity markers.
#[test]
fn legacy_rules_round_trip() {
    let source = "ALPHA_LITERAL_LONG\n/BETA[0-9]{2}/\n";
    let digest = source_digest(source.as_bytes()).expect("digest");
    let compiled = crate::compile_rules(source).expect("compile");
    let decoded = decode(&encode(&compiled, digest).expect("encode"), digest).expect("decode");
    assert_eq!(decoded.names, vec![None, None]);
}

/// Every truncated prefix rejects rather than reading beyond input.
#[test]
fn every_truncation_is_invalid() {
    let (bytes, digest) = named_artifact();
    for end in 0..bytes.len() {
        assert!(decode(&bytes[..end], digest).is_err(), "accepted truncation at {end}");
    }
}

/// Trailing bytes reject instead of being silently ignored.
#[test]
fn trailing_bytes_are_invalid() {
    let (mut bytes, digest) = named_artifact();
    bytes.push(0);
    assert_eq!(
        decode(&bytes, digest).err().expect("trailing bytes"),
        EnvelopeError::Invalid,
    );
}

/// Wrong source digest rejects before matcher use.
#[test]
fn source_digest_mismatch_is_distinct() {
    let (bytes, _) = named_artifact();
    let other = source_digest(b"different").expect("digest");
    assert_eq!(
        decode(&bytes, other).err().expect("source mismatch"),
        EnvelopeError::SourceMismatch,
    );
}

/// Schema changes are compatibility failures.
#[test]
fn schema_mismatch_is_incompatible() {
    let (mut bytes, digest) = named_artifact();
    let schema_offset = MAGIC.len();
    bytes[schema_offset..schema_offset + 4].copy_from_slice(&2_u32.to_le_bytes());
    assert_eq!(
        decode(&bytes, digest).err().expect("schema mismatch"),
        EnvelopeError::Incompatible,
    );
}

/// Scanner-version identity changes are compatibility failures.
#[test]
fn scanner_version_mismatch_is_incompatible() {
    let (mut bytes, digest) = named_artifact();
    let version_start = MAGIC.len() + 4 + 2;
    bytes[version_start] = if bytes[version_start] == b'0' { b'1' } else { b'0' };
    assert_eq!(
        decode(&bytes, digest).err().expect("version mismatch"),
        EnvelopeError::Incompatible,
    );
}

/// Bad marker cannot manufacture a rule identity.
#[test]
fn unknown_name_marker_is_invalid() {
    let (mut bytes, digest) = named_artifact();
    let version_length = usize::from(u16::from_le_bytes(
        bytes[MAGIC.len() + 4..MAGIC.len() + 6].try_into().expect("version length"),
    ));
    let platform_length_offset = MAGIC.len() + 6 + version_length;
    let platform_length = usize::from(u16::from_le_bytes(
        bytes[platform_length_offset..platform_length_offset + 2]
            .try_into()
            .expect("platform length"),
    ));
    let first_name_marker = platform_length_offset + 2 + platform_length + 32 + 4;
    bytes[first_name_marker] = 9;
    assert_eq!(
        decode(&bytes, digest).err().expect("name marker"),
        EnvelopeError::Invalid,
    );
}
