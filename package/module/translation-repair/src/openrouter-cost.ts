import { isJsonRecord, } from './json-guard.ts';

//region OpenRouter cost
// WHAT ONE CALL COST IN USD, read off the wire rather than priced from a table.
//
// OpenRouter's final streamed chunk carries a `usage` block with `cost`, the
// USD the account was charged for that call, beside the token counts
// (captured 2026-09-03: `"usage":{...,"cost":0.000126255304,...}`). A price
// table would have to be re-read whenever an upstream's rate moved, and this
// provider routes each call to one of many upstreams at different rates, so
// the table would be wrong per call rather than per day. The wire figure is
// the source; the public listing's rates are only for planning.
//
// SCANNED SEPARATELY FROM THE COMPLETION READER, which is shared with
// Synthetic and reports only token counts. Adding a provider-specific field
// to `ExtractedCompletion` would make every other reader carry a value it
// cannot fill.

/**
 * Prefix marking a line that carries an event payload.
 */
const DATA_PREFIX = 'data:';

/**
 * Reading given when no chunk carried a cost.
 */
export const COST_UNREPORTED = 'unreported';

/**
 * USD one completed stream reports it was charged.
 *
 * THE LAST `usage.cost` WINS. The block arrives once, on the final chunk,
 * and a gateway that sent it more than once would report a running figure
 * whose last value is the total.
 *
 * @param bodyText - whole drained `text/event-stream` body
 *
 * @returns Cost in USD, or that no chunk reported one
 *
 * @example
 * ```ts
 * const cost = openRouterCostOf({ bodyText: reply.bodyText, },);
 * ```
 */
export function openRouterCostOf(
  { bodyText, }: { readonly bodyText: string; },
): number | typeof COST_UNREPORTED {
  /**
   * Costs each chunk reported, in arrival order.
   */
  const costs = bodyText
    .split('\n',)
    .flatMap(function costOf(rawLine,): readonly number[] {
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
          // scan only wants the cost and reports nothing about the rest.
          void error;
          return undefined;
        }
      })();
      if (!isJsonRecord(chunk,))
        return [];
      /**
       * Usage block, absent on every chunk but the last.
       */
      const { usage, } = chunk;
      if (!isJsonRecord(usage,))
        return [];
      /**
       * Cost as reported, of unknown type until checked.
       */
      const { cost, } = usage;
      if ((typeof cost) !== 'number')
        return [];
      if (!Number.isFinite(cost,))
        return [];
      return [cost,];
    },);

  return costs.at(-1,) ?? COST_UNREPORTED;
}

//endregion OpenRouter cost
