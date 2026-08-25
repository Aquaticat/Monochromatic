//! Encodes and validates scanner-owned runtime cache envelopes.
//!
//! Framing is explicit little-endian data around the engine's existing bincode
//! bytes. Every declared size is checked against a fixed ceiling and remaining
//! input before allocation or slicing. The decoder accepts no trailing bytes.

/// Imports compiled rule bundle reconstructed by cache decoder.
use crate::CompiledRules;

/// Imports content digest and compile compatibility identities.
use super::path::{
    digest_bytes, platform_identity, scanner_version, source_digest, SourceDigest,
};
/// Imports redacted warning reason mapping.
use super::warning::CacheWarningReason;

/// Exact eight-byte artifact marker.
const MAGIC: &[u8; 8] = b"FSRULES\0";
/// Scanner-owned outer envelope schema version.
const SCHEMA_VERSION: u32 = 1;
/// Maximum complete artifact accepted before reading or decoding: 512 MiB.
pub(super) const MAX_ARTIFACT_BYTES: u64 = 512 * 1024 * 1024;
/// Maximum rule identities decoded into memory.
const MAX_RULE_COUNT: u32 = 1_000_000;
/// Maximum UTF-8 bytes in one section name.
const MAX_RULE_NAME_BYTES: u32 = 4_096;
/// Maximum UTF-8 bytes in version or platform identity.
const MAX_IDENTITY_BYTES: u16 = 128;
/// Marker for unnamed legacy rule identity.
const NAME_ABSENT: u8 = 0;
/// Marker for named tail-format rule identity.
const NAME_PRESENT: u8 = 1;

/// Redacted envelope rejection category.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum EnvelopeError {
    /// Schema, scanner version, or platform identity differs.
    Incompatible,
    /// Embedded source digest disagrees with current source.
    SourceMismatch,
    /// Framing, names, counts, or engine bytes are malformed.
    Invalid,
}

/// Converts envelope rejection into closed warning protocol reason.
impl EnvelopeError {
    /// Returns corresponding scanner cache-warning reason.
    pub(super) fn warning_reason(self) -> CacheWarningReason {
        if self == EnvelopeError::Incompatible {
            return CacheWarningReason::Incompatible;
        }
        if self == EnvelopeError::SourceMismatch {
            return CacheWarningReason::SourceMismatch;
        }
        return CacheWarningReason::Invalid
    }
}

/// Cursor over borrowed artifact bytes with checked forward-only reads.
struct Cursor<'a> {
    /// Complete immutable artifact bytes.
    bytes: &'a [u8],
    /// Next unread byte offset.
    position: usize,
}

/// Checked cursor operations used by envelope decoder.
impl<'a> Cursor<'a> {
    /// Creates cursor at beginning of artifact bytes.
    fn new(bytes: &'a [u8]) -> Self {
        return Self { bytes, position: 0 }
    }

    /// Borrows exact next byte count or rejects truncation and overflow.
    fn take(&mut self, count: usize) -> Result<&'a [u8], EnvelopeError> {
        let end = self.position.checked_add(count).ok_or(EnvelopeError::Invalid)?;
        let value = self.bytes.get(self.position..end).ok_or(EnvelopeError::Invalid)?;
        self.position = end;
        return Ok(value)
    }

    /// Reads one byte.
    fn read_u8(&mut self) -> Result<u8, EnvelopeError> {
        return self.take(1).map(|bytes| return bytes[0])
    }

    /// Reads little-endian 16-bit integer.
    fn read_u16(&mut self) -> Result<u16, EnvelopeError> {
        let bytes: [u8; 2] = self.take(2)?.try_into().map_err(|_| return EnvelopeError::Invalid)?;
        return Ok(u16::from_le_bytes(bytes))
    }

    /// Reads little-endian 32-bit integer.
    fn read_u32(&mut self) -> Result<u32, EnvelopeError> {
        let bytes: [u8; 4] = self.take(4)?.try_into().map_err(|_| return EnvelopeError::Invalid)?;
        return Ok(u32::from_le_bytes(bytes))
    }

    /// Reads little-endian 64-bit integer.
    fn read_u64(&mut self) -> Result<u64, EnvelopeError> {
        let bytes: [u8; 8] = self.take(8)?.try_into().map_err(|_| return EnvelopeError::Invalid)?;
        return Ok(u64::from_le_bytes(bytes))
    }

    /// Reads bounded UTF-8 identity string.
    fn read_identity(&mut self) -> Result<&'a str, EnvelopeError> {
        let length = self.read_u16()?;
        if length == 0 || length > MAX_IDENTITY_BYTES {
            return Err(EnvelopeError::Invalid);
        }
        return std::str::from_utf8(self.take(usize::from(length))?)
            .map_err(|_| return EnvelopeError::Invalid)
    }

    /// Reports whether all artifact bytes were consumed.
    fn is_finished(&self) -> bool {
        return self.position == self.bytes.len()
    }
}

/// Appends length-prefixed compatibility identity.
fn append_identity(output: &mut Vec<u8>, value: &str) -> Result<(), EnvelopeError> {
    let length = u16::try_from(value.len()).map_err(|_| return EnvelopeError::Invalid)?;
    if length == 0 || length > MAX_IDENTITY_BYTES {
        return Err(EnvelopeError::Invalid);
    }
    output.extend_from_slice(&length.to_le_bytes());
    output.extend_from_slice(value.as_bytes());
    return Ok(())
}

/// Reports whether decoded name obeys strict tail-format section-name grammar.
fn valid_rule_name(name: &str) -> bool {
    let mut characters = name.chars();
    let Some(first) = characters.next() else {
        return false;
    };
    if !first.is_ascii_lowercase() && !first.is_ascii_digit() {
        return false;
    }
    return characters.all(|character| {
        return character.is_ascii_lowercase()
            || character.is_ascii_digit()
            || character == '.'
            || character == '-'
    })
}

/// Encodes names and engine bytes into one scanner-owned artifact.
pub(super) fn encode(
    compiled: &CompiledRules,
    digest: SourceDigest,
) -> Result<Vec<u8>, EnvelopeError> {
    let rule_count = u32::try_from(compiled.names.len()).map_err(|_| return EnvelopeError::Invalid)?;
    if rule_count > MAX_RULE_COUNT || compiled.set.len() != compiled.names.len() {
        return Err(EnvelopeError::Invalid);
    }
    let engine_bytes = compiled.set.to_bytes().map_err(|_| return EnvelopeError::Invalid)?;
    let engine_digest = source_digest(&engine_bytes).map_err(|_| return EnvelopeError::Invalid)?;
    let engine_length = u64::try_from(engine_bytes.len()).map_err(|_| return EnvelopeError::Invalid)?;
    if engine_length > MAX_ARTIFACT_BYTES {
        return Err(EnvelopeError::Invalid);
    }

    let mut output = Vec::new();
    output.extend_from_slice(MAGIC);
    output.extend_from_slice(&SCHEMA_VERSION.to_le_bytes());
    append_identity(&mut output, scanner_version())?;
    append_identity(&mut output, &platform_identity())?;
    output.extend_from_slice(&digest_bytes(digest));
    output.extend_from_slice(&rule_count.to_le_bytes());
    for name in &compiled.names {
        if let Some(name) = name {
            let name_length = u32::try_from(name.len()).map_err(|_| return EnvelopeError::Invalid)?;
            if name_length > MAX_RULE_NAME_BYTES || !valid_rule_name(name) {
                return Err(EnvelopeError::Invalid);
            }
            output.push(NAME_PRESENT);
            output.extend_from_slice(&name_length.to_le_bytes());
            output.extend_from_slice(name.as_bytes());
        } else {
            output.push(NAME_ABSENT);
        }
    }
    output.extend_from_slice(&digest_bytes(engine_digest));
    output.extend_from_slice(&engine_length.to_le_bytes());
    output.extend_from_slice(&engine_bytes);
    if u64::try_from(output.len()).map_err(|_| return EnvelopeError::Invalid)? > MAX_ARTIFACT_BYTES {
        return Err(EnvelopeError::Invalid);
    }
    return Ok(output)
}

/// Decodes and validates one complete envelope against current source identity.
pub(super) fn decode(
    bytes: &[u8],
    expected_digest: SourceDigest,
) -> Result<CompiledRules, EnvelopeError> {
    if u64::try_from(bytes.len()).map_err(|_| return EnvelopeError::Invalid)? > MAX_ARTIFACT_BYTES {
        return Err(EnvelopeError::Invalid);
    }
    let mut cursor = Cursor::new(bytes);
    if cursor.take(MAGIC.len())? != MAGIC {
        return Err(EnvelopeError::Invalid);
    }
    if cursor.read_u32()? != SCHEMA_VERSION {
        return Err(EnvelopeError::Incompatible);
    }
    if cursor.read_identity()? != scanner_version() {
        return Err(EnvelopeError::Incompatible);
    }
    if cursor.read_identity()? != platform_identity() {
        return Err(EnvelopeError::Incompatible);
    }
    if cursor.take(32)? != digest_bytes(expected_digest) {
        return Err(EnvelopeError::SourceMismatch);
    }

    let rule_count = cursor.read_u32()?;
    if rule_count > MAX_RULE_COUNT {
        return Err(EnvelopeError::Invalid);
    }
    let remaining_after_count = bytes.len().saturating_sub(cursor.position);
    if usize::try_from(rule_count).map_err(|_| return EnvelopeError::Invalid)? > remaining_after_count {
        return Err(EnvelopeError::Invalid);
    }
    let mut names = Vec::new();
    for _ in 0..rule_count {
        let marker = cursor.read_u8()?;
        if marker == NAME_ABSENT {
            names.push(None);
            continue;
        }
        if marker != NAME_PRESENT {
            return Err(EnvelopeError::Invalid);
        }
        let name_length = cursor.read_u32()?;
        if name_length == 0 || name_length > MAX_RULE_NAME_BYTES {
            return Err(EnvelopeError::Invalid);
        }
        let name_bytes = cursor.take(
            usize::try_from(name_length).map_err(|_| return EnvelopeError::Invalid)?,
        )?;
        let name = std::str::from_utf8(name_bytes).map_err(|_| return EnvelopeError::Invalid)?;
        if !valid_rule_name(name) {
            return Err(EnvelopeError::Invalid);
        }
        names.push(Some(name.to_string()));
    }

    let expected_engine_digest: [u8; 32] = cursor
        .take(32)?
        .try_into()
        .map_err(|_| return EnvelopeError::Invalid)?;
    let engine_length = cursor.read_u64()?;
    if engine_length > MAX_ARTIFACT_BYTES {
        return Err(EnvelopeError::Invalid);
    }
    let engine_bytes = cursor.take(
        usize::try_from(engine_length).map_err(|_| return EnvelopeError::Invalid)?,
    )?;
    if !cursor.is_finished() {
        return Err(EnvelopeError::Invalid);
    }
    let (engine_digest_result, set_result) = rayon::join(
        || return source_digest(engine_bytes),
        || return crate::load_precompiled(engine_bytes),
    );
    let actual_engine_digest = engine_digest_result.map_err(|_| return EnvelopeError::Invalid)?;
    if digest_bytes(actual_engine_digest) != expected_engine_digest {
        return Err(EnvelopeError::Invalid);
    }
    let set = set_result.map_err(|_| return EnvelopeError::Invalid)?;
    if set.len() != names.len() {
        return Err(EnvelopeError::Invalid);
    }
    return Ok(CompiledRules { set, names })
}

/// Registers envelope framing and corruption tests.
#[cfg(test)]
#[path = "envelope_tests.rs"]
mod tests;
