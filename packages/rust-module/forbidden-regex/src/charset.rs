//! A 256-bit set of bytes, the leaf alphabet of the engine.

/// Number of `u64` words needed to hold one bit per possible byte value (256/64).
const WORDS: usize = 4;

/// Bit width of one `u64`, used to split a byte value into word and bit indices.
const BITS_PER_WORD: usize = 64;

/// An immutable-by-convention set of byte values, stored as a 256-bit bitmap.
///
/// What: `[u64; 4]` where bit `b` is set when byte `b` is a member. Why: byte
/// classes, `.`, single literals, and the `\d \w \s` shorthands are all just
/// byte sets; membership and complement are O(1) word operations.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct ByteSet {
    /// Bitmap words; `words[b / 64]`'s bit `b % 64` is set iff `b` is present.
    words: [u64; WORDS],
}

/// Construction, mutation, and queries for a `ByteSet`.
impl ByteSet {
    /// Builds the empty set.
    ///
    /// What: all words zero. Why: the starting point every class builds up from.
    pub fn empty() -> Self {
        ByteSet { words: [0; WORDS] }
    }

    /// Adds a single byte to the set.
    ///
    /// What: sets the bit for `b`. Why: literals and explicit class members.
    pub fn insert(&mut self, b: u8) {
        // What: locate the word and bit for `b`, then OR the bit in.
        // Why: standard bitmap set; `as usize` widens the byte for indexing.
        let idx = b as usize;
        self.words[idx / BITS_PER_WORD] |= 1u64 << (idx % BITS_PER_WORD);
    }

    /// Adds every byte in the inclusive range `lo..=hi` to the set.
    ///
    /// What: iterates the range and inserts each. Why: class ranges like `a-z`.
    pub fn insert_range(&mut self, lo: u8, hi: u8) {
        // What: `for b in lo..=hi` walks the inclusive byte range.
        // Why: small, bounded (at most 256), so a direct loop is clearest.
        for b in lo..=hi {
            self.insert(b);
        }
    }

    /// Merges another set into this one in place.
    ///
    /// What: bitwise-ORs each word. Why: combining shorthands and members inside
    /// one character class.
    pub fn union_with(&mut self, other: &ByteSet) {
        // What: OR matching words. Why: union of two bitmaps.
        for i in 0..WORDS {
            self.words[i] |= other.words[i];
        }
    }

    /// Returns the complement of this set over all 256 byte values.
    ///
    /// What: bitwise-NOT each word. Why: negated classes `[^...]` and the
    /// negated shorthands `\D \W \S`.
    pub fn negate(&self) -> ByteSet {
        // What: NOT every word; all 256 bits are meaningful so no masking needed.
        // Why: the universe is exactly 256 bytes, matching the bitmap width.
        let mut out = ByteSet::empty();
        for i in 0..WORDS {
            out.words[i] = !self.words[i];
        }
        out
    }

    /// Reports whether a byte is a member.
    ///
    /// What: tests the bit for `b`. Why: the leaf step of a derivative on a class.
    pub fn contains(&self, b: u8) -> bool {
        let idx = b as usize;
        (self.words[idx / BITS_PER_WORD] >> (idx % BITS_PER_WORD)) & 1 == 1
    }

    /// Reports whether the set has no members.
    ///
    /// What: all words zero. Why: an empty class is the `Fail` language.
    pub fn is_empty(&self) -> bool {
        self.words.iter().all(|w| *w == 0)
    }
}

/// Reports whether a byte is an ASCII word character `[A-Za-z0-9_]`.
///
/// What: the predicate shared by `\w`, `\b`, and byte-class equivalence. Why:
/// one definition keeps the shorthand, the boundary assertion, and class
/// signatures consistent.
pub fn is_word_byte(b: u8) -> bool {
    b.is_ascii_alphanumeric() || b == b'_'
}

/// Builds the set matched by `.`: every byte except the newline.
///
/// What: full universe minus `\n`. Why: dot is non-dotall, matching any single
/// byte that is not a line terminator.
pub fn dot_set() -> ByteSet {
    let mut set = ByteSet::empty();
    set.insert_range(0, 255);
    // What: clear the newline bit. Why: `.` must not cross a line boundary.
    let mut nl = ByteSet::empty();
    nl.insert(b'\n');
    set = intersect_complement(&set, &nl);
    set
}

/// Returns `a` with every member of `b` removed.
///
/// What: `a AND NOT b` per word. Why: used to carve `\n` out of the dot set.
fn intersect_complement(a: &ByteSet, b: &ByteSet) -> ByteSet {
    let mut out = ByteSet::empty();
    for i in 0..WORDS {
        out.words[i] = a.words[i] & !b.words[i];
    }
    out
}

/// Builds the `\d` set, ASCII digits `[0-9]`.
///
/// What: inserts the digit range. Why: the `\d` shorthand and its negation.
pub fn digit_set() -> ByteSet {
    let mut set = ByteSet::empty();
    set.insert_range(b'0', b'9');
    set
}

/// Builds the `\w` set, ASCII word characters `[A-Za-z0-9_]`.
///
/// What: letters, digits, underscore. Why: the `\w` shorthand and its negation,
/// kept identical to `is_word_byte`.
pub fn word_set() -> ByteSet {
    let mut set = ByteSet::empty();
    set.insert_range(b'A', b'Z');
    set.insert_range(b'a', b'z');
    set.insert_range(b'0', b'9');
    set.insert(b'_');
    set
}

/// Builds the `\s` set, ASCII whitespace `[ \t\n\r\x0c\x0b]`.
///
/// What: space, tab, newline, carriage return, form feed, vertical tab. Why: the
/// `\s` shorthand and its negation.
pub fn space_set() -> ByteSet {
    let mut set = ByteSet::empty();
    set.insert(b' ');
    set.insert(b'\t');
    set.insert(b'\n');
    set.insert(b'\r');
    set.insert(0x0c);
    set.insert(0x0b);
    set
}

/// Builds a singleton set holding exactly one byte.
///
/// What: empty set plus `b`. Why: every literal byte becomes a one-member class.
pub fn singleton(b: u8) -> ByteSet {
    let mut set = ByteSet::empty();
    set.insert(b);
    set
}
