// PROTOTYPE ONLY: Candidate G raw JSON duplicate-member refusal.

//region Scanner model

/**
 * Object frame retaining decoded member names at one nesting level.
 */
type ObjectFrame = {
  readonly kind: 'object';
  readonly keys: Set<string>;
  expectsKey: boolean;
};

/**
 * Array frame distinguishes commas from object member separators.
 */
type ArrayFrame = {
  readonly kind: 'array';
};

/**
 * JSON container frame used by linear lexical walk.
 */
type JsonFrame = ObjectFrame | ArrayFrame;

/**
 * Reads one JSON string token including escapes and closing quote.
 */
function stringEnd({
  text,
  startOffset,
}: {
  readonly text: string;
  readonly startOffset: number
}): number {
  let cursor = startOffset + 1;
  let escaped = false;
  while (cursor < text.length) {
    const character = text[cursor];
    if (escaped)
      escaped = false;
    else if (character === '\\')
      escaped = true;
    else if (character === '"')
      return cursor + 1;
    cursor += 1;
  }
  throw new Error('realization JSON string is unterminated');
}

/**
 * Skips JSON whitespace after token.
 */
function afterWhitespace({
  text,
  startOffset,
}: {
  readonly text: string;
  readonly startOffset: number
}): number {
  let cursor = startOffset;
  while ((cursor < text.length) && (text[cursor]
    ?.trim()
    === ''))
    cursor += 1;
  return cursor;
}

//endregion Scanner model

//region Public guard

/**
 * Refuses duplicate raw object members before ordinary JSON parsing erases them.
 * Future Candidate G response reader must invoke this before shared `parseModelJson`;
 * exporting this guard does not alter shared parser by itself.
 *
 * @example
 * ```ts
 * assertNoDuplicateJsonMembers({ text: '{"a":1}', },);
 * ```
 */
export function assertNoDuplicateJsonMembers({ text, }: { readonly text: string; }): void {
  const frames: JsonFrame[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const character = text[cursor];
    if (character === '"') {
      const endOffset = stringEnd({
        text,
        startOffset: cursor,
      });
      const frame = frames.at(-1,);
      const next = afterWhitespace({
        text,
        startOffset: endOffset,
      });
      if ((frame?.kind === 'object') && frame.expectsKey
        && (text[next] === ':')) {
        const key = JSON.parse(text.slice(
          cursor,
          endOffset,
        ),) as string;
        if (frame.keys
          .has(key,))
          throw new Error('realization JSON object member repeats');
        frame.keys
          .add(key,);
        frame.expectsKey = false;
      }
      cursor = endOffset;
      continue;
    }
    if (character === '{') {
      frames.push({
        kind: 'object',
        keys: new Set(),
        expectsKey: true,
      },);
      cursor += 1;
      continue;
    }
    if (character === '[') {
      frames.push({ kind: 'array', },);
      cursor += 1;
      continue;
    }
    if ((character === '}') || (character === ']')) {
      frames.pop();
      cursor += 1;
      continue;
    }
    if (character === ',') {
      const frame = frames.at(-1,);
      if (frame?.kind === 'object')
        frame.expectsKey = true;
    }
    cursor += 1;
  }
  JSON.parse(text,);
}

//endregion Public guard
