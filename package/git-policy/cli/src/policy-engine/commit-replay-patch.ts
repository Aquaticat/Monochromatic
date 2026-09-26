/**
 Parser of the unified patches replay's subsumption check reads.

 Patches come from `git diff-tree -p` over single-level trees whose entries are named by decimal index,
 so a section header never carries a user path.
 Text is Latin-1 decoded,
 so every byte maps to one character and comparisons stay byte-exact.

 @module
 */

//region Types

/**
 One patch line.
 */
export type PatchLine = Readonly<{
  /**
   Context, removal, or addition.
   */
  op: ' ' | '-' | '+';
  /**
   Line bytes with their newline, without it for an incomplete last line.
   */
  text: string;
}>;

/**
 One unified-diff hunk.
 */
export type PatchHunk = Readonly<{
  /**
   First line of the old side, `0` for an empty old side.
   */
  oldStart: number;
  /**
   First line of the new side, `0` for an empty new side.
   */
  newStart: number;
  /**
   Hunk lines in order.
   */
  lines: readonly PatchLine[];
}>;

/**
 Patch output does not have the shape `git diff-tree -p` writes.
 */
export class ReplayPatchFormatError extends Error {
  /**
   Creates the error.

   @param message - what did not parse
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'ReplayPatchFormatError';
  }
}

//endregion Types

//region Lines

/**
 Decodes Git output byte for byte, so every byte maps to one character and encodes back exactly.

 @param bytes - output bytes

 @returns Latin-1 text

 @example
 ```ts
 decodeLatin1(new Uint8Array([0xE9])); // 'é'
 ```
 */
export function decodeLatin1(bytes: Uint8Array,): string {
  return Buffer.from(
    bytes.buffer,
    bytes.byteOffset,
    bytes.byteLength,
  )
    .toString('latin1',);
}

/**
 Section header of one file.
 */
const SECTION_HEADER = 'diff --git a/';

/**
 Hunk header prefix.
 */
const HUNK_HEADER = '@@ -';

/**
 Text before a hunk header's ranges.
 */
const HUNK_RANGES_START = '@@ '.length;

/**
 Splits text into lines, each keeping its newline.

 @param text - Latin-1 text

 @returns lines in order

 @example
 ```ts
 splitKeepingNewlines('a\nb'); // ['a\n', 'b']
 ```
 */
export function splitKeepingNewlines(text: string,): readonly string[] {
  /**
   Lines found so far.
   */
  const lines: string[] = [];
  // The cursor walks the text once, so splitting is linear in its length.
  for (let start = 0; start < text.length;) {
    /**
     Newline ending this line.
     */
    const end = text.indexOf(
      '\n',
      start,
    );
    /**
     End of this line, newline included.
     */
    const stop = end === (-1) ? text.length : end + 1;
    lines.push(text.slice(
      start,
      stop,
    ),);
    start = stop;
  }
  return lines;
}

//endregion Lines

//region Hunks

/**
 Parses one `-start[,count]` or `+start[,count]` range.

 @param range - range text

 @returns start and count

 @throws {@link ReplayPatchFormatError} when a number is malformed
 */
function parseRange(range: string,): Readonly<{
  start: number;
  count: number;
}> {
  /**
   Start and optional count.
   */
  const [startText = '', countText = '1',] = range.slice(1,)
    .split(',',);
  /**
   Parsed start.
   */
  const start = Number(startText,);
  /**
   Parsed count.
   */
  const count = Number(countText,);
  if ((!Number.isSafeInteger(start,)) || (!Number.isSafeInteger(count,))
    || (start < 0)
    || (count < 0))
    throw new ReplayPatchFormatError(`malformed hunk range ${JSON.stringify(range,)}`,);
  return {
    start,
    count,
  };
}

/**
 Drops the newline of the last parsed line, as a following `\ No newline at end of file` marker says.

 @param parsed - hunk lines so far, changed in place
 */
function markIncomplete(parsed: PatchLine[],): void {
  /**
   Line the marker follows.
   */
  const last = parsed.pop();
  if (last === undefined)
    throw new ReplayPatchFormatError('an incomplete-line marker precedes every hunk line',);
  parsed.push({
    op: last.op,
    text: last.text
      .endsWith('\n',) ? last.text
        .slice(
          0,
          -1,
        ) : last.text,
  },);
}

/**
 Classifies one hunk body line.

 @param line - body line

 @returns its diff marker; a bare newline is an empty context line under `diff.suppressBlankEmpty`

 @throws {@link ReplayPatchFormatError} for a line without a marker
 */
function lineMarker(line: string,): PatchLine['op'] | '\\' {
  /**
   First byte.
   */
  const first = line === '\n' ? ' ' : line.charAt(0,);
  if ((first !== ' ') && (first !== '-')
    && (first !== '+')
    && (first !== '\\'))
    throw new ReplayPatchFormatError(`hunk line ${JSON.stringify(line,)} has no diff marker`,);
  return first;
}

/**
 Parses one hunk starting at its header.

 @param lines - every patch line

 @param start - index of the hunk header

 @returns hunk and the index after it

 @throws {@link ReplayPatchFormatError} when the hunk is malformed or truncated
 */
function parseHunk({
  lines,
  start,
}: Readonly<{
  lines: readonly string[];
  start: number;
}>,): Readonly<{
  hunk: PatchHunk;
  next: number;
}> {
  /**
   Header line.
   */
  const header = lines[start] ?? '';
  /**
   Ranges between `@@ ` and ` @@`.
   */
  const [oldRange = '', newRange = '',] = header.slice(
    HUNK_RANGES_START,
    header.indexOf(
      ' @@',
      HUNK_RANGES_START,
    ),
  )
    .split(' ',);
  /**
   Old range.
   */
  const oldSide = parseRange(oldRange,);
  /**
   New range.
   */
  const newSide = parseRange(newRange,);
  /**
   Parsed body lines.
   */
  const parsed: PatchLine[] = [];
  /**
   Remaining old-side and new-side line counts, and the next line to read.
   */
  const state = {
    old: oldSide.count,
    new: newSide.count,
    cursor: start + 1,
  };
  // Each iteration consumes one body line; the counts reach zero after exactly the lines the header names.
  while ((state.old > 0) || (state.new > 0)) {
    /**
     Current line.
     */
    const line = lines[state.cursor];
    if (line === undefined)
      throw new ReplayPatchFormatError(`hunk ${JSON.stringify(header.trimEnd(),)} is truncated`,);
    state.cursor += 1;
    /**
     Line marker.
     */
    const marker = lineMarker(line,);
    if (marker === '\\') {
      markIncomplete(parsed,);
      continue;
    }
    state.old -= marker === '+' ? 0 : 1;
    state.new -= marker === '-' ? 0 : 1;
    parsed.push({
      op: marker,
      text: line === '\n' ? '\n' : line.slice(1,),
    },);
  }
  if (lines[state.cursor]
    ?.startsWith('\\',)
    === true) {
    markIncomplete(parsed,);
    state.cursor += 1;
  }
  return {
    hunk: {
      oldStart: oldSide.start,
      newStart: newSide.start,
      lines: parsed,
    },
    next: state.cursor,
  };
}

/**
 Parses `git diff-tree -p` output over index-named single-level trees into hunks per entry name.

 @param text - Latin-1 patch output

 @returns hunks per entry name; an entry without a section has no change

 @throws {@link ReplayPatchFormatError} when a hunk is malformed

 @example
 ```ts
 parseIndexedPatch('diff --git a/0 b/0\n--- a/0\n+++ b/0\n@@ -1 +1 @@\n-a\n+b\n');
 ```
 */
export function parseIndexedPatch(text: string,): ReadonlyMap<string, readonly PatchHunk[]> {
  /**
   Patch lines.
   */
  const lines = splitKeepingNewlines(text,);
  /**
   Hunks per entry name.
   */
  const files = new Map<string, PatchHunk[]>();
  /**
   Hunks of the section being read, and the next line.
   */
  const state = {
    section: [] as PatchHunk[],
    cursor: 0,
  };
  // Header lines advance by one; a hunk advances past all of its lines, so every line is read once.
  while (state.cursor < lines.length) {
    /**
     Current line.
     */
    const line = lines[state.cursor] ?? '';
    if (line.startsWith(HUNK_HEADER,)) {
      /**
       Parsed hunk.
       */
      const parsed = parseHunk({
        lines,
        start: state.cursor,
      },);
      state.section
        .push(parsed.hunk,);
      state.cursor = parsed.next;
      continue;
    }
    if (line.startsWith(SECTION_HEADER,)) {
      state.section = [];
      files.set(
        line.slice(
          SECTION_HEADER.length,
          line.indexOf(
            ' ',
            SECTION_HEADER.length,
          ),
        ),
        state.section,
      );
    }
    state.cursor += 1;
  }
  return files;
}

//endregion Hunks
