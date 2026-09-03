import { isJsonRecord, } from './json-guard.ts';

//region OpenRouter chunk scan
// EVERY PARSED CHUNK OF A DRAINED CHAT COMPLETIONS STREAM, for the readers
// that want one field off the gateway's envelope rather than the generated
// text: the USD cost on the final chunk (`openrouter-cost.ts`) and the
// upstream endpoint named on every chunk (`openrouter-endpoint.ts`).
//
// SCANNED SEPARATELY FROM THE COMPLETION READER, which is shared with
// Synthetic and reports only text and token counts. Adding gateway-specific
// fields to `ExtractedCompletion` would make every other reader carry values
// it cannot fill.

/**
 * Prefix marking a line that carries an event payload.
 */
const DATA_PREFIX = 'data:';

/**
 * Every chunk of one drained stream that parses as a JSON object, in arrival
 * order.
 *
 * NOTHING HERE THROWS: a chunk that does not parse was already refused or
 * accepted by the completion reader, and this scan reports nothing about it.
 * The `[DONE]` sentinel, blank keep-alives and comment lines carry no JSON and
 * are skipped by the opening-brace check.
 *
 * @param bodyText - whole drained `text/event-stream` body
 *
 * @returns Parsed chunks that are objects
 *
 * @example
 * ```ts
 * const chunks = openRouterChunksOf({ bodyText: reply.bodyText, },);
 * ```
 */
export function openRouterChunksOf(
  { bodyText, }: { readonly bodyText: string; },
): readonly Readonly<Record<string, unknown>>[] {
  return bodyText
    .split('\n',)
    .flatMap(function chunkOf(rawLine,): readonly Readonly<Record<string, unknown>>[] {
      /**
       * Line without surrounding whitespace and carriage returns.
       */
      const line = rawLine.trim();
      if (!line.startsWith(DATA_PREFIX,))
        return [];
      /**
       * Payload after the prefix; the sentinel and blanks carry no JSON.
       */
      const payload = line
        .slice(DATA_PREFIX.length,)
        .trim();
      if (!payload.startsWith('{',))
        return [];
      /**
       * Parsed chunk, or nothing when the payload does not parse.
       */
      const chunk: unknown = (function parseChunk(): unknown {
        try {
          return JSON.parse(payload,);
        } catch (error) {
          // A chunk the completion reader already refused or accepted; this
          // scan only wants the envelope and reports nothing about the rest.
          void error;
          return undefined;
        }
      })();
      if (!isJsonRecord(chunk,))
        return [];
      return [chunk,];
    },);
}

//endregion OpenRouter chunk scan
