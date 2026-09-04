import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { ExtractedCompletion, } from './completion-shape.ts';
import type { ProviderName, } from './provider-name.ts';
import { noteRunSpend, } from './run-spend-meter.ts';

//region Spend line
// WHAT ONE CALL COST, on the one line a reader can total.
//
// WHY THIS EXISTS. Both clients already read the provider's own `usage` block
// off the completion and both already print it, to `debug`. Every run this
// project has ever made logged at `info`, so a grep for token counts across the
// whole run archive returns nothing, and the question "what did that pass
// spend" has never once been answerable from a log.
//
// IT DID NOT MATTER UNTIL IT DID. Synthetic is a flat subscription: a call
// either fits the weekly allowance or it does not, and the meter reads a
// percentage that the `METERS` line already carries. Charm Hyper is metered per
// token, at rates that differ by two orders of magnitude across the same
// roster, so a run's cost there depends on WHICH seats answered and by how much.
// Nothing recorded that.
//
// THE COMPLETION HALF IS THE EXPENSIVE HALF, AND IT IS NOT THE ANSWER. Output
// is priced two to five times input across this roster, and `completion_tokens`
// counts thinking tokens, which dominate output on these models. A reader
// pricing a run off answer length would underread it by most of the bill.
//
// SHAPED LIKE THE `METERS` LINE, `name=value` after a marker word, so a reader
// can split rather than match. See `provider-budget.ts` for that line and
// `corpus-run/meter-sample-read.ts` for the reader it grew.
//
// PRINTS IDS AND COUNTS. Never a passage: a spend line rides in the same log as
// a corpus pass, and a run log holds unlicensed wording.

/**
 * Logger root for spend reporting.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Marker word a reader finds the line by.
 *
 * EXPORTED RATHER THAN RESTATED IN THE READER, so the writer and the reader
 * cannot drift apart the way two spellings of one literal always eventually do.
 *
 * NO LEADING SPACE, unlike METERS_MARKER in corpus-run/meter-sample-read.ts.
 * That one only ever meets lines carrying a logger tag prefix, so it can demand
 * the space in front. This marker opens the line this module RETURNS, and
 * `readSpendLine` accepts it at the start of a line or after a space, so the
 * writer's own output round-trips through the reader instead of reading as
 * prose.
 */
export const SPEND_MARKER = 'SPEND ';

/**
 * Value written where the provider returned no usage block at all.
 *
 * NAMED RATHER THAN OMITTED, and the line is printed anyway. A run whose
 * provider stayed quiet and a run that spent nothing produce the same total,
 * and only this tells them apart. Leaving the line out would let a reader
 * report a cheap run when what happened was an unreported one.
 */
const UNREPORTED = 'unreported';

/**
 * Records what one completed exchange cost, on its own line.
 *
 * @param provider - meter this call drew on, since only one of the two is
 * priced per token and a reader totalling credits must not add the other
 *
 * @param label - model as the serving provider names it, matching the label
 * `reportStreamProgress` already prints so the two lines can be joined
 *
 * @param extracted - completion whose `usage` block the provider filled in,
 * or did not
 *
 * @param costUsd - USD the wire reported for this call, on the provider that
 * bills in USD and said so
 *
 * @param endpoint - upstream the gateway named as serving this call, on the
 * provider that fronts many; percent-encoded on the line because a display
 * name may hold a space and this line's grammar splits on spaces
 *
 * @returns Line that was logged, so a test can assert what a reader will parse
 * rather than a paraphrase of it
 *
 * @example
 * ```ts
 * reportSpend({ provider: 'hyper', label: 'qwen3.8-max', extracted, },);
 * ```
 */
export function reportSpend(
  {
    provider,
    label,
    extracted,
    costUsd,
    endpoint,
  }: {
    readonly provider: ProviderName;
    readonly label: string;
    readonly extracted: ExtractedCompletion;
    readonly costUsd?: number;
    readonly endpoint?: string;
  },
): string {
  /**
   * Usage block as the provider reported it, absent where it did not.
   */
  const { usage, } = extracted;

  /**
   * Prompt and completion counts, or the mark saying nobody reported them.
   */
  const counts = (usage === undefined)
    ? `prompt=${UNREPORTED} completion=${UNREPORTED}`
    : `prompt=${String(usage.prompt_tokens,)} completion=${String(usage.completion_tokens,)}`;

  /**
   * USD the wire reported for this call, as a trailing field only where a
   * provider bills in USD and said so; older lines and the other providers
   * carry no such field, and the reader treats its absence as unreported.
   */
  const cost = (costUsd === undefined)
    ? ''
    : ` cost=${String(costUsd,)}`;

  // THE SAME FIGURE FEEDS THE RUN'S METER, so the ceiling the scheduler asks
  // (`corpus-run/spend-ceiling.ts`) and the total a reader sums off these
  // lines can never disagree about what was counted.
  if (costUsd !== undefined) {
    noteRunSpend({
      provider,
      costUsd,
    },);
  }

  /**
   * Upstream that served the call, as a trailing field only where a gateway
   * named one; encoded so a name with a space stays one field.
   */
  const servedBy = (endpoint === undefined)
    ? ''
    : ` endpoint=${encodeURIComponent(endpoint,)}`;

  /**
   * Line assembled before the call so the logger chain stays one step per line.
   */
  const line = `${SPEND_MARKER}provider=${provider} model=${label} ${counts}${cost}${servedBy}`;

  /**
   * Logger tagged with this report.
   */
  const rl = tagged({
    tag: reportSpend.name,
    l,
  },);
  rl.info(line,);
  return line;
}

//endregion Spend line
