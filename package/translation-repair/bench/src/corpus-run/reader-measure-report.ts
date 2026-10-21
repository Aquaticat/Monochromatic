import { wordForCount, } from '@monochromatic-dev/translation-repair-typography/ts';
import {
  type CandidateRates,
  type MeasureVerdict,
  MINIMUM_PRODUCED_READINGS,
  type SeatedBand,
} from './reader-measure-score.ts';

//region Reader measure report
// WHAT THE PERSON WHO RAN `reader-measure` WITH A KEY READS: the model and
// route measured, the seated band, the candidate's rates, the verdict on each
// clause, and the one edit a pass calls for, so the next step is never a
// question. Raw output, deliberately: this is text a person reads, not
// pipeline logging.

/**
 Hold the card carries until this measurement passes.
 */
const HOLD = 'openrouter-pictures-unmeasured';

/**
 Two decimals of a share.

 @param value - share between zero and one

 @returns The share with two decimals

 @example
 ```ts
 twoPlaces({ value: 0.8, },); // '0.80'
 ```
 */
function twoPlaces({ value, }: { readonly value: number; },): string {
  return value.toFixed(2,);
}

/**
 Lines of the verdict and what follows from it.

 @param modelId - candidate measured

 @param verdict - what the measurement decides

 @returns The verdict lines

 @example
 ```ts
 const lines = verdictLines({ modelId, verdict, },);
 ```
 */
function verdictLines(
  {
    modelId,
    verdict,
  }: {
    readonly modelId: string;
    readonly verdict: MeasureVerdict;
  },
): readonly string[] {
  if (verdict.kind === 'meets-both-clauses') {
    return [
      'RESULT: both clauses met.',
      `NEXT: remove '${HOLD}' from the holds of ${modelId} in shared-contract/src/model-cards.ts, rebuild, and run the package checks;`
      + ' that seats it as a picture reader on OpenRouter (zero data retention on every request).',
    ];
  }
  if (verdict.kind === 'inconclusive') {
    return [
      `RESULT: not measured: ${String(verdict.produced,)} of the ${
        String(MINIMUM_PRODUCED_READINGS,)
      } readings a verdict needs were produced.`,
      `NEXT: keep the hold '${HOLD}'; ask again with a larger --sample, or read the per-picture reasons the run printed.`,
    ];
  }
  return [
    ...verdict.clauses
      .map(function failed(clause,): string {
      return `RESULT: ${clause} clause failed.`;
    },),
    `NEXT: keep the hold '${HOLD}' on ${modelId}.`,
  ];
}

/**
 Lines the measurement prints.

 @param modelId - candidate measured

 @param matched - pictures matched to a trusted record and asked

 @param band - how the seated readers corroborate one another

 @param candidate - how the candidate's readings fared

 @param verdict - what the measurement decides

 @returns The report, one line per element

 @example
 ```ts
 console.log(renderMeasureReport({ modelId, matched, band, candidate, verdict, },).join('\n',),);
 ```
 */
export function renderMeasureReport(
  {
    modelId,
    matched,
    band,
    candidate,
    verdict,
  }: {
    readonly modelId: string;
    readonly matched: number;
    readonly band: SeatedBand;
    readonly candidate: CandidateRates;
    readonly verdict: MeasureVerdict;
  },
): readonly string[] {
  return [
    `MEASURED: ${modelId} through OpenRouter (zero data retention), ${String(matched,)} ${
      wordForCount({
        count: matched,
        one: 'picture',
        many: 'pictures',
      },)
    } matched,`
    + ` ${String(candidate.produced,)} readings produced.`,
    `SEATED: ${String(band.readings,)} readings; seated floor ${twoPlaces({ value: band.floorCorroboratedByAll, },)}`
    + ` corroborated by all, seated ceiling ${twoPlaces({ value: band.ceilingCorroboratedByNone, },)} corroborated by none.`,
    `CANDIDATE: ${twoPlaces({ value: candidate.corroboratedByAll, },)} corroborated by all,`
    + ` ${twoPlaces({ value: candidate.corroboratedByNone, },)} by none, mean overlap ${
      twoPlaces({ value: candidate.meanOverlap, },)
    }.`,
    ...verdictLines({
      modelId,
      verdict,
    },),
  ];
}

//endregion Reader measure report
