//! A byte cursor over the pattern that skips verbose-mode whitespace and comments.

/// A forward cursor over the pattern bytes.
///
/// What: holds the source bytes and a current offset, and knows how to skip the
/// always-on verbose-mode noise (unescaped whitespace and first-column `#`
/// comments). Why: every grammar rule reads through this one cursor, so the
/// verbose-mode rules live in exactly one place.
pub struct Cursor<'a> {
    /// The pattern as raw bytes; matching and parsing are both byte-oriented.
    src: &'a [u8],
    /// Current read offset into `src`.
    pos: usize,
}

/// Reading and verbose-mode skipping over the pattern bytes.
impl<'a> Cursor<'a> {
    /// Builds a cursor at the start of `src`.
    ///
    /// What: offset zero over the given bytes. Why: parsing begins at the front.
    pub fn new(src: &'a [u8]) -> Self {
        Cursor { src, pos: 0 }
    }

    /// Returns the current byte offset.
    ///
    /// What: the index used for error positions. Why: `CompileError::Syntax`
    /// reports where a problem was found.
    pub fn pos(&self) -> usize {
        self.pos
    }

    /// Reports whether the cursor is at or past the end.
    ///
    /// What: `pos >= len`. Why: loops stop when input is exhausted.
    pub fn eof(&self) -> bool {
        self.pos >= self.src.len()
    }

    /// Returns the current byte without advancing.
    ///
    /// What: `src.get(pos)`. Why: lookahead to decide which rule applies.
    pub fn peek(&self) -> Option<u8> {
        self.src.get(self.pos).copied()
    }

    /// Returns the byte `offset` ahead without advancing.
    ///
    /// What: `src.get(pos + offset)`. Why: range detection in classes and the
    /// `{n,` form need one byte of extra lookahead.
    pub fn peek_at(&self, offset: usize) -> Option<u8> {
        self.src.get(self.pos + offset).copied()
    }

    /// Returns the current byte and advances past it.
    ///
    /// What: reads then increments `pos`. Why: the consuming primitive every
    /// rule builds on.
    pub fn bump(&mut self) -> Option<u8> {
        let b = self.peek();
        if b.is_some() {
            self.pos += 1;
        }
        b
    }

    /// Reports whether the cursor sits at the first column of a line.
    ///
    /// What: true at offset zero or right after a newline. Why: a `#` comment is
    /// only a comment when it is the first character of its line.
    fn at_line_start(&self) -> bool {
        self.pos == 0 || self.src.get(self.pos - 1) == Some(&b'\n')
    }

    /// Skips verbose-mode whitespace and first-column comments.
    ///
    /// What: advances over ASCII whitespace and, at a line start, over a `#` and
    /// the rest of that line. Why: verbose mode is always on, so a rule may span
    /// many lines and carry first-column comment lines; this is where both are
    /// consumed before any token is read.
    pub fn skip_ignorable(&mut self) {
        // What: loop until neither whitespace nor a comment is next.
        // Why: whitespace and a following comment line can alternate.
        loop {
            match self.peek() {
                Some(b) if b.is_ascii_whitespace() => {
                    self.pos += 1;
                }
                Some(b'#') if self.at_line_start() => {
                    // What: drop bytes up to but not including the newline.
                    // Why: the newline is left for the whitespace arm to consume,
                    // keeping `at_line_start` correct for the next line.
                    while let Some(c) = self.peek() {
                        if c == b'\n' {
                            break;
                        }
                        self.pos += 1;
                    }
                }
                _ => break,
            }
        }
    }
}
