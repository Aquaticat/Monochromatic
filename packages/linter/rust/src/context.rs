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
// Why:      These are the exact pieces needed to turn source text into a token
//           stream and ask each token "are you a comment, whitespace, or code?".
//
// In TS you'd write (pseudocode):
// ```ts
// import { Edition, NodeOrToken, SourceFile, SyntaxKind } from "<rust-parser>";
// ```
use ra_ap_syntax::{Edition, NodeOrToken, SourceFile, SyntaxKind};

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
pub struct LintContext {
    // What:     `pub path: String`. OWNED string of the file path. Sibling: `&str`.
    // Why:      Diagnostics print it; owning it frees the context from the
    //           lifetime of whoever discovered the path.
    pub path: String,

    // What:     `pub source: String`. OWNED full file contents.
    // Why:      Kept so future rules can inspect raw text; also the basis of the
    //           line computations below.
    pub source: String,

    // What:     `code_lines: Vec<usize>`. `Vec<usize>` is a heap-allocated,
    //           growable array of `usize` (pointer-wide unsigned int). Siblings:
    //           `&[usize]` (a borrowed slice) and `[usize; N]` (a fixed array).
    //           Private (no `pub`). Holds the sorted, distinct 1-based line
    //           numbers that contain at least one non-comment, non-whitespace
    //           token.
    // Why:      This is exactly oxlint's "lines after skipping blanks and
    //           comments"; computing it once lets max-lines just read its length.
    code_lines: Vec<usize>,
}

// What:     `impl LintContext { ... }` attaches the constructor and accessors.
// Why:      Group the per-file behaviour with the per-file data.
//
// In TS you'd write (pseudocode):
// ```ts
// class LintContext { /* ... */ }
// ```
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

        // What:     `let code_lines = compute_code_lines(&source, &line_starts);`.
        //           Again `&` lends both values read-only to the helper.
        // Why:      Do the parse-and-classify work and keep only the result.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const codeLines = computeCodeLines(source, lineStarts);
        // ```
        let code_lines = compute_code_lines(&source, &line_starts);

        // What:     `Self { path, source, code_lines }` builds the struct using
        //           field shorthand (each local has the same name as its field).
        //           No trailing `;`, so this is the function's tail expression
        //           and becomes the returned value. `path` and `source` are moved
        //           into the struct here.
        // Why:      Hand back the fully built context.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return { path, source, codeLines };
        // ```
        Self {
            path,
            source,
            code_lines,
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

// What:     `fn compute_code_lines(source: &str, line_starts: &[usize]) ->
//           Vec<usize>`. Parses the source and returns the sorted, distinct,
//           1-based line numbers that contain at least one non-trivia token.
// Why:      This is the whole point: code lines = total minus blank minus comment,
//           computed via the real Rust lexer so `//` inside a string never counts.
//
// In TS you'd write (pseudocode):
// ```ts
// function computeCodeLines(source: string, lineStarts: number[]): number[] { /* ... */ }
// ```
fn compute_code_lines(source: &str, line_starts: &[usize]) -> Vec<usize> {
    // What:     `let parse = SourceFile::parse(source, Edition::CURRENT);`. Calls
    //           the parser. `Edition::CURRENT` selects the newest edition's
    //           grammar; comment and whitespace tokenization is edition-
    //           independent, so this choice does not affect the count.
    // Why:      Turn text into a lossless token tree.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const parse = parser.parse(source);
    // ```
    let parse = SourceFile::parse(source, Edition::CURRENT);

    // What:     `let node = parse.syntax_node();`. Pulls the root `SyntaxNode` out
    //           of the parse result so we can walk it.
    // Why:      The walk below starts from this root.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const node = parse.rootNode;
    // ```
    let node = parse.syntax_node();

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
