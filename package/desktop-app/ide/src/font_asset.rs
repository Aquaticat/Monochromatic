//! Unmodified variable fonts share stable identities across shaping contexts and glyph caches.

/// Fontique's immutable font blob is already used by Parley and Slint.
use parley::fontique::Blob;
/// LazyLock constructs each font identity once; Arc retains immutable embedded bytes across threads.
use std::sync::{Arc, LazyLock};

/// JetBrains Mono variable roman, with its original wght axis and OpenType features.
pub const CODE_ROMAN: &[u8] = include_bytes!("../asset/font/JetBrainsMono-Variable.ttf");
/// Genuine JetBrains Mono italic design, not a skew transform of the roman face.
pub const CODE_ITALIC: &[u8] = include_bytes!("../asset/font/JetBrainsMono-VariableItalic.ttf");
/// Inter's variable text/display optical-size and weight design.
pub const UI_ROMAN: &[u8] = include_bytes!("../asset/font/InterVariable.ttf");
/// Genuine Inter italic with its own optical-size and weight axes.
pub const UI_ITALIC: &[u8] = include_bytes!("../asset/font/InterVariable-Italic.ttf");

/// Shared roman identity lets cache tests distinguish variation coordinates rather than new font IDs.
static CODE_ROMAN_BLOB: LazyLock<Blob<u8>> =
    LazyLock::new(|| return Blob::new(Arc::new(CODE_ROMAN)));
/// The italic face has a distinct identity while sharing its bytes across all views.
static CODE_ITALIC_BLOB: LazyLock<Blob<u8>> =
    LazyLock::new(|| return Blob::new(Arc::new(CODE_ITALIC)));

/// Return shared handles for both real code faces; cloning retains each blob's ID.
pub(crate) fn code_faces() -> [Blob<u8>; 2] {
    return [CODE_ROMAN_BLOB.clone(), CODE_ITALIC_BLOB.clone()];
}
