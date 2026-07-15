//! Per-file lint context built from rust-analyzer syntax trees.

// What:     `use ra_ap_syntax::{...}` imports four names from rust-analyzer's
//           lossless-syntax-tree crate:
//             - `Edition`: an enum picking which Rust edition's grammar to parse
//               with (siblings inside it: Edition2015/2018/2021/2024). We use
//               `Edition::CURRENT`.
//             - `NodeOrToken`: a two-variant enum; every element of the tree is
//               either a `Node` (an inner grouping) or a `Token` (a leaf piece of
//               text such as an identifier, a comment, or whitespace).
//             - `SourceFile`: the typed root of a parsed Rust file.
//             - `SyntaxKind`: the big enum naming every token/node kind; we only
//               look at `COMMENT` and `WHITESPACE`.
//             - `SyntaxNode`: a handle to one inner node of the parsed tree (the
//               whole file's root is one of these). It is reference-counted
//               (cloning it just bumps a counter, like a TS object reference),
//               so we can keep the root around for AST-based rules to walk.
// Why:      These are the exact pieces needed to turn source text into a token
//           stream and ask each token "are you a comment, whitespace, or code?",
//           and to hand later rules the parsed tree without re-reading the file.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Edition, NodeOrToken, SourceFile, SyntaxKind, SyntaxNode } from "<rust-parser>";
// ```
/// Imports rust-analyzer syntax tree types used to parse and classify Rust source.
use ra_ap_syntax::{Edition, NodeOrToken, SourceFile, SyntaxKind, SyntaxNode};

// What:     `pub struct LintContext { ... }` is the per-file bundle handed to
//           every rule: the file path, its full source text, and the precomputed
//           set of line numbers that contain real code.
// Why:      Rules should not re-read or re-parse the file; the runner builds this
//           once per file and lends it to each rule.
//
// In TS you'd write (pseudocode):
// ```ts
// type LintContext = { path: string; source: string; codeLines: number[] };
// ```
/// Parsed source bundle shared by every lint rule for one file.
pub struct LintContext {
    // What:     `pub path: String`. OWNED string of the file path. Sibling: `&str`.
    // Why:      Diagnostics print it; owning it frees the context from the
    //           lifetime of whoever discovered the path.
    /// File path displayed in diagnostics.
    pub path: String,

    // What:     `pub source: String`. OWNED full file contents.
    // Why:      Kept so future rules can inspect raw text; also the basis of the
    //           line computations below.
    /// Full source text read from disk.
    pub source: String,

    // What:     `code_lines: Vec<usize>`. `Vec<usize>` is a heap-allocated,
    //           growable array of `usize` (pointer-wide unsigned int). Siblings:
    //           `&[usize]` (a borrowed slice) and `[usize; N]` (a fixed array).
    //           Private (no `pub`). Holds the sorted, distinct 1-based line
    //           numbers that contain at least one non-comment, non-whitespace
    //           token.
    // Why:      This is exactly oxlint's "lines after skipping blanks and
    //           comments"; computing it once lets max-lines just read its length.
    /// One-based line numbers that contain Rust code after skipping blanks and comments.
    code_lines: Vec<usize>,

    // What:     `syntax: SyntaxNode`. The root node of the parsed lossless tree,
    //           kept (not dropped) after construction. `SyntaxNode` is
    //           reference-counted internally, so storing it is cheap and cloning
    //           it just bumps a counter. Private (no `pub`); rules reach it
    //           through the `syntax_node()` accessor below.
    // Why:      AST-based rules (such as require-rustdoc) need to walk the tree;
    //           parsing once here and lending the result avoids re-reading and
    //           re-parsing the file inside every rule.
    /// Parsed syntax tree root reused by AST-based rules.
    syntax: SyntaxNode,

    // What:     `line_starts: Vec<usize>`. The byte offset at which each line
    //           begins (line 0 starts at offset 0, then one entry just past every
    //           `\n`). Sibling shapes: `&[usize]` (borrowed view), `[usize; N]`
    //           (fixed array). Private.
    // Why:      Turn an AST node's byte offset into a 1-based line number for
    //           diagnostics, via the `line_at_offset()` accessor below; computed
    //           once and reused.
    /// Byte offsets where each source line begins.
    line_starts: Vec<usize>,
}

// What:     `impl LintContext { ... }` attaches the constructor and accessors.
// Why:      Group the per-file behaviour with the per-file data.
//
// In TS you'd write (pseudocode):
// ```ts
// class LintContext { /* ... */ }
// ```
/// Constructors and accessors for per-file lint context.
impl LintContext {
    // What:     `pub fn new(path: String, source: String) -> Self`. Takes
    //           OWNERSHIP of both strings (no `&`), parses, and returns a new
    //           `Self` (shorthand for `LintContext`).
    // Why:      One place builds the context; the heavy parse happens here, once.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static create(path: string, source: string): LintContext { /* ... */ }
    // ```
    /// Parse source text and precompute reusable per-file indexes.
    pub fn new(path: String, source: String) -> Self {
        // What:     `let line_starts = compute_line_starts(&source);`. `&source`
        //           lends the string read-only to the helper (we are not giving
        //           the helper ownership; we still need `source` afterwards).
        //           `line_starts` is a `Vec<usize>` of byte offsets.
        // Why:      Map a byte offset to a line number later.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const lineStarts = computeLineStarts(source);
        // ```
        let line_starts = compute_line_starts(&source);

        // What:     `let parse = SourceFile::parse(&source, Edition::CURRENT);`.
        //           Runs the real Rust parser over the borrowed source.
        //           `Edition::CURRENT` selects the newest edition's grammar;
        //           comment and whitespace tokenization is edition-independent, so
        //           this choice does not affect the line count.
        // Why:      Parse exactly once here; both the code-line classifier and any
        //           AST rule read the resulting tree.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const parse = parser.parse(source);
        // ```
        let parse = SourceFile::parse(&source, Edition::CURRENT);

        // What:     `let syntax = parse.syntax_node();`. Pulls the root
        //           `SyntaxNode` out of the parse result. It is reference-counted,
        //           so this is a cheap handle, not a copy of the tree.
        // Why:      Keep the root so rules can walk it later, and so the classifier
        //           below reuses it instead of re-parsing.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const syntax = parse.rootNode;
        // ```
        let syntax = parse.syntax_node();

        // What:     `let code_lines = compute_code_lines(&syntax, &line_starts);`.
        //           `&` lends both the tree and the line table read-only to the
        //           helper.
        // Why:      Classify lines from the already-parsed tree and keep only the
        //           result.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const codeLines = computeCodeLines(syntax, lineStarts);
        // ```
        let code_lines = compute_code_lines(&syntax, &line_starts);

        // What:     `Self { path, source, code_lines, syntax, line_starts }` builds
        //           the struct using field shorthand (each local has the same name
        //           as its field). No trailing `;`, so this is the function's tail
        //           expression and becomes the returned value. `path`, `source`,
        //           `syntax`, and `line_starts` are moved into the struct here.
        // Why:      Hand back the fully built context, tree and all.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { path, source, codeLines, syntax, lineStarts };
        // ```
        Self {
            path,
            source,
            code_lines,
            syntax,
            line_starts,
        }
    }

    // What:     `pub fn code_line_count(&self) -> usize`. Borrows self read-only,
    //           returns how many code lines there are.
    // Why:      max-lines compares this against its budget.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // codeLineCount(): number { return this.codeLines.length; }
    // ```
    /// Return count of lines that contain Rust code.
    pub fn code_line_count(&self) -> usize {
        // What:     `self.code_lines.len()`. `.len()` returns the element count as
        //           `usize`. Tail expression, so it is returned.
        // Why:      The count IS the post-skip line total.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.codeLines.length;
        // ```
        self.code_lines.len()
    }

    // What:     `pub fn code_line_at(&self, index: usize) -> Option<usize>`.
    //           Returns the 1-based line number of the `index`-th code line, or
    //           the absent variant if `index` is out of range. `Option<usize>`
    //           is Rust's "maybe a usize" (siblings of its variants: `Some(v)`
    //           and `None`), used instead of `null`.
    // Why:      max-lines wants the location of the FIRST over-budget code line so
    //           the diagnostic points somewhere useful.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // codeLineAt(i: number): number | undefined { return this.codeLines[i]; }
    // ```
    /// Return one-based source line for code-line index.
    pub fn code_line_at(&self, index: usize) -> Option<usize> {
        // What:     `self.code_lines.get(index).copied()`. `.get(index)` returns
        //           `Option<&usize>` (a borrowed maybe-reference, no panic on
        //           out-of-range, unlike `self.code_lines[index]`). `.copied()`
        //           turns `Option<&usize>` into `Option<usize>` by copying the
        //           small integer out. Tail expression, so it is returned.
        // Why:      Safe lookup that yields `None` instead of crashing when the
        //           index is past the end.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.codeLines[i];
        // ```
        self.code_lines.get(index).copied()
    }

    // What:     `pub fn syntax_node(&self) -> &SyntaxNode`. Borrows self read-only
    //           and hands back a borrowed reference to the stored parse-tree root.
    //           Returning `&SyntaxNode` (a borrow) rather than `SyntaxNode` (an
    //           owned clone) lets the caller walk the tree without bumping the
    //           reference count; the tree lives as long as the context does.
    // Why:      AST-based rules call this to walk the file's items instead of
    //           re-parsing the source themselves.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // syntaxNode(): SyntaxNode { return this.syntax; }
    // ```
    /// Return borrowed parsed syntax tree root.
    pub fn syntax_node(&self) -> &SyntaxNode {
        // What:     `&self.syntax`. Lends out the stored root node. Tail
        //           expression, so it is returned.
        // Why:      Give rules read access to the parsed tree.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this.syntax;
        // ```
        &self.syntax
    }

    // What:     `pub fn line_at_offset(&self, offset: usize) -> usize`. Maps a byte
    //           offset within the source to the 1-based line number that contains
    //           it. `usize` is the pointer-wide unsigned integer (siblings `u32`,
    //           `u64`); offsets and line numbers are both counts, so `usize` keeps
    //           them index-compatible without casts.
    // Why:      An AST node knows its byte range, not its line; diagnostics print a
    //           1-based line, so rules convert through this helper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // lineAtOffset(offset: number): number { return lineIndex(offset, this.lineStarts) + 1; }
    // ```
    /// Convert a byte offset into a one-based source line.
    pub fn line_at_offset(&self, offset: usize) -> usize {
        // What:     `line_index(offset, &self.line_starts) + 1`. `line_index`
        //           returns the 0-based line index for the offset (binary search
        //           over the line-start table); adding 1 converts it to the 1-based
        //           line number humans and editors use. Tail expression.
        // Why:      Hand back a line number ready to print in a diagnostic.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return lineIndex(offset, this.lineStarts) + 1;
        // ```
        line_index(offset, &self.line_starts) + 1
    }
}

// What:     `fn compute_line_starts(source: &str) -> Vec<usize>`. Private helper
//           (no `pub`). `&str` is a borrowed string slice (it does NOT own its
//           bytes; sibling: owned `String`). Returns an owned `Vec<usize>`.
// Why:      Build the lookup table that turns a byte offset into a line number.
//
// In TS you'd write (pseudocode):
// ```ts
// function computeLineStarts(source: string): number[] { /* ... */ }
// ```
/// Compute byte offsets where each source line begins.
fn compute_line_starts(source: &str) -> Vec<usize> {
    // What:     `let mut starts = vec![0usize];`. `vec![...]` is the macro that
    //           builds a `Vec`. `mut` marks the binding mutable (we will push to
    //           it). `0usize` is the literal `0` typed as `usize`. Line 0 starts
    //           at byte offset 0.
    // Why:      Every file has a first line beginning at offset 0.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const starts: number[] = [0];
    // ```
    let mut starts = vec![0usize];

    // What:     `for (offset, byte) in source.bytes().enumerate()`. `.bytes()`
    //           iterates the raw bytes (`u8`); `.enumerate()` pairs each with its
    //           index, yielding `(usize, u8)` tuples destructured into
    //           `offset` and `byte`.
    // Why:      We scan bytes (not chars) because byte offsets are what the
    //           parser's token ranges use.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (let offset = 0; offset < bytes.length; offset++) { const byte = bytes[offset]; /* ... */ }
    // ```
    for (offset, byte) in source.bytes().enumerate() {
        // What:     `if byte == b'\n'`. `b'\n'` is a BYTE literal: the single
        //           newline byte (value 10), not a string. We compare the current
        //           byte to it.
        // Why:      A line begins right after each newline.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (byte === 0x0a) { starts.push(offset + 1); }
        // ```
        if byte == b'\n' {
            // What:     `starts.push(offset + 1);`. Append the offset just past
            //           the newline as the next line's start.
            // Why:      Record where the following line begins.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // starts.push(offset + 1);
            // ```
            starts.push(offset + 1);
        }
    }

    // What:     `starts`. Bare variable as the tail expression: it is returned.
    // Why:      Hand the table back to the caller.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return starts;
    // ```
    starts
}

// What:     `fn line_index(offset: usize, line_starts: &[usize]) -> usize`. Maps a
//           byte offset to a 0-based line index. `&[usize]` is a borrowed slice
//           view over the `Vec<usize>` (sibling: owned `Vec<usize>`).
// Why:      Token ranges are byte offsets; we need their line numbers.
//
// In TS you'd write (pseudocode):
// ```ts
// function lineIndex(offset: number, lineStarts: number[]): number { /* ... */ }
// ```
/// Convert a byte offset into a zero-based line index.
fn line_index(offset: usize, line_starts: &[usize]) -> usize {
    // What:     `line_starts.partition_point(|&s| s <= offset)`. `partition_point`
    //           does a binary search over the sorted slice and returns the count
    //           of leading elements for which the closure is true. `|&s| s <=
    //           offset` is a closure (an inline function): `|...|` are its
    //           parameters; `&s` pattern-copies each element out of its reference.
    //           Subtracting 1 converts "how many starts are <= offset" into the
    //           0-based index of the line containing `offset`. Tail expression.
    // Why:      Fast, allocation-free offset-to-line lookup.
    // Gotcha:   `|&s|` is a closure parameter pattern, not a bitwise-and; it means
    //           "bind `s` to the value the reference points at".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let count = 0; for (const s of lineStarts) if (s <= offset) count++;
    // return count - 1;
    // ```
    line_starts.partition_point(|&s| s <= offset) - 1
}

// What:     `fn compute_code_lines(node: &SyntaxNode, line_starts: &[usize]) ->
//           Vec<usize>`. Walks an already-parsed tree and returns the sorted,
//           distinct, 1-based line numbers that contain at least one non-trivia
//           token. `&SyntaxNode` borrows the root the caller already parsed;
//           sibling shape: an owned `SyntaxNode` (we take a borrow to avoid the
//           reference-count bump).
// Why:      This is the whole point: code lines = total minus blank minus comment,
//           computed via the real Rust lexer so `//` inside a string never counts.
//           Taking the parsed node (instead of re-parsing the source string) keeps
//           parsing to exactly once per file.
//
// In TS you'd write (pseudocode):
// ```ts
// function computeCodeLines(node: SyntaxNode, lineStarts: number[]): number[] { /* ... */ }
// ```
/// Compute one-based lines that contain nontrivia Rust tokens.
fn compute_code_lines(node: &SyntaxNode, line_starts: &[usize]) -> Vec<usize> {
    // What:     `let mut is_code = vec![false; line_starts.len()];`. Builds a
    //           growable boolean array, one slot per line, all initially false.
    //           `mut` because we flip slots to true below.
    // Why:      Mark which lines hold code; we count the trues at the end.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const isCode = new Array(lineStarts.length).fill(false);
    // ```
    let mut is_code = vec![false; line_starts.len()];

    // What:     `for element in node.descendants_with_tokens()`. This iterator
    //           yields every element of the tree, INCLUDING leaf tokens (the
    //           plain `.descendants()` would skip tokens). Each `element` is a
    //           `NodeOrToken` (node-or-token enum).
    // Why:      We must see tokens (comments, whitespace, identifiers, literals)
    //           to classify lines.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const element of node.descendantsWithTokens()) { /* ... */ }
    // ```
    for element in node.descendants_with_tokens() {
        // What:     `if let NodeOrToken::Token(token) = element { ... }`. A
        //           one-arm pattern match: if `element` is the `Token` variant,
        //           bind its inner `SyntaxToken` to `token` and run the block;
        //           otherwise skip (it was an inner `Node`).
        // Why:      Only leaf tokens carry the kind/text we classify on.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (element.isToken) { const token = element.asToken; /* ... */ }
        // ```
        if let NodeOrToken::Token(token) = element {
            // What:     `let kind = token.kind();`. Returns the `SyntaxKind` of
            //           this leaf (e.g. COMMENT, WHITESPACE, IDENT, STRING).
            // Why:      We branch on whether it is trivia.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const kind = token.kind;
            // ```
            let kind = token.kind();

            // What:     `if kind == SyntaxKind::COMMENT || kind ==
            //           SyntaxKind::WHITESPACE { continue; }`. `||` is logical OR.
            //           `continue` skips to the next loop iteration.
            // Why:      Comments and whitespace are "trivia": they do NOT make a
            //           line count as code, so we ignore them entirely. Crucially,
            //           a `//` or `/* */` appearing inside a string literal is NOT
            //           a COMMENT token (it is part of a STRING token), so such
            //           lines correctly stay code.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (kind === "comment" || kind === "whitespace") continue;
            // ```
            if kind == SyntaxKind::COMMENT || kind == SyntaxKind::WHITESPACE {
                continue;
            }

            // What:     `let range = token.text_range();`. Returns a `TextRange`,
            //           the half-open byte span `[start, end)` the token occupies.
            // Why:      We need its start/end to find which lines it touches.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const range = token.range;
            // ```
            let range = token.text_range();

            // What:     `let start: usize = usize::from(range.start());`.
            //           `range.start()` returns a `TextSize` (a newtype wrapper
            //           around a 32-bit offset); `usize::from(...)` converts it to
            //           a plain `usize` we can use as an index.
            // Why:      Get the first byte offset of the token as a number.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const start = range.start;
            // ```
            let start: usize = usize::from(range.start());

            // What:     `let end: usize = usize::from(range.end());`. The
            //           exclusive end offset, converted the same way.
            // Why:      Bound the line range the token spans.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const end = range.end;
            // ```
            let end: usize = usize::from(range.end());

            // What:     `if end <= start { continue; }`. Guard against an empty
            //           token range before subtracting below.
            // Why:      `end - 1` would underflow on a zero-width token; skip it.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // if (end <= start) continue;
            // ```
            if end <= start {
                continue;
            }

            // What:     `let first = line_index(start, line_starts);` and
            //           `let last = line_index(end - 1, line_starts);`. The first
            //           and last 0-based line indices the token covers. `end - 1`
            //           is the token's last byte (since `end` is exclusive); a
            //           multi-line string literal therefore marks every line it
            //           spans.
            // Why:      A token can straddle several lines; all of them are code.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const first = lineIndex(start, lineStarts);
            // const last = lineIndex(end - 1, lineStarts);
            // ```
            let first = line_index(start, line_starts);
            let last = line_index(end - 1, line_starts);

            // What:     `is_code[first..=last].fill(true);`. `is_code[first..=last]`
            //           takes a MUTABLE sub-slice covering the inclusive line range
            //           (`..=` includes `last`). `.fill(true)` sets every element of
            //           that sub-slice to `true` in one call, with no loop or index
            //           variable.
            // Why:      Mark every line the token touches as code; a multi-line
            //           token (such as a multi-line string literal) marks all the
            //           lines it spans.
            // Gotcha:   `slice[a..=b]` yields a sub-slice VIEW, not one element;
            //           out-of-range bounds would panic, but `first`/`last` always
            //           come from real byte offsets within this file.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // for (let line = first; line <= last; line++) isCode[line] = true;
            // ```
            is_code[first..=last].fill(true);
        }
    }

    // What:     `let mut result: Vec<usize> = Vec::new();`. An empty owned vector
    //           that will collect the 1-based code line numbers. The explicit
    //           `: Vec<usize>` annotation states the element type.
    // Why:      Gather the marked lines into the return value.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const result: number[] = [];
    // ```
    let mut result: Vec<usize> = Vec::new();

    // What:     `for (index, marked) in is_code.iter().enumerate()`. `.iter()`
    //           borrows each element; `.enumerate()` pairs it with its 0-based
    //           index. `marked` is a `&bool` (a borrowed reference to the slot).
    // Why:      Walk every line slot and keep the ones marked as code.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (let index = 0; index < isCode.length; index++) { const marked = isCode[index]; /* ... */ }
    // ```
    for (index, marked) in is_code.iter().enumerate() {
        // What:     `if *marked { result.push(index + 1); }`. `*marked`
        //           dereferences the `&bool` to the `bool` value. `index + 1`
        //           converts the 0-based line index to a 1-based line number
        //           (what editors and humans use).
        // Why:      Collect human-facing line numbers of code lines.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (marked) result.push(index + 1);
        // ```
        if *marked {
            result.push(index + 1);
        }
    }

    // What:     `result`. Tail expression: the collected vector is returned. It is
    //           already ascending because we built it by ascending index.
    // Why:      Hand back the sorted, distinct code line numbers.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return result;
    // ```
    result
}
