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

/// Locates engine-length field in valid fixture envelope.
fn engine_length_offset(bytes: &[u8]) -> usize {
    let mut offset = MAGIC.len() + 4;
    let version_length = usize::from(u16::from_le_bytes(
        bytes[offset..offset + 2].try_into().expect("version length"),
    ));
    offset += 2 + version_length;
    let platform_length = usize::from(u16::from_le_bytes(
        bytes[offset..offset + 2].try_into().expect("platform length"),
    ));
    offset += 2 + platform_length + 32;
    let rule_count = u32::from_le_bytes(
        bytes[offset..offset + 4].try_into().expect("rule count"),
    );
    offset += 4;
    for _ in 0..rule_count {
        let marker = bytes[offset];
        offset += 1;
        if marker == 1 {
            let name_length = usize::try_from(u32::from_le_bytes(
                bytes[offset..offset + 4].try_into().expect("name length"),
            ))
            .expect("name length fits");
            offset += 4 + name_length;
        }
    }
    return offset + 32
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

/// Trailing bytes inside declared engine payload reject as noncanonical serialization.
#[test]
fn trailing_engine_bytes_are_invalid() {
    let (mut bytes, digest) = named_artifact();
    let length_offset = engine_length_offset(&bytes);
    let original_length = u64::from_le_bytes(
        bytes[length_offset..length_offset + 8]
            .try_into()
            .expect("engine length"),
    );
    bytes[length_offset..length_offset + 8]
        .copy_from_slice(&(original_length + 1).to_le_bytes());
    bytes.push(0);
    assert_eq!(
        decode(&bytes, digest).err().expect("trailing engine bytes"),
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
