import type { AuditRepeatBand, } from './rendering-audit-settled-band.ts';
import type {
  AudienceSplit,
  AuditRelocationPair,
  VoiceRate,
} from './rendering-audit-settled-read.ts';

//region Settled audit printing
// How a persisted run reads on a terminal.
//
// SPLIT OUT OF THE REPORT so the report is orchestration and this is wording.
// Both were in one file until the repeat readings arrived and pushed it past
// its line budget; splitting was the remedy rather than raising the cap.
//
// EVERY PRINTER NAMES ITS DENOMINATOR. A count with no denominator is the
// single most quotable wrong number a telemetry probe can emit, and these
// numbers exist to be quoted into a doc.

/**
 * Width model ids are padded to, so a column of rates reads down the page.
 */
const MODEL_COLUMN = 48;

/**
 * Prints one half of the population.
 *
 * @param split - that half, summed
 *
 * @example
 * ```ts
 * printSplit({ split, },);
 * ```
 */
export function printSplit({ split, }: { readonly split: AudienceSplit; },): void {
  /**
   * Everything this half amounts to.
   */
  const {
    audits,
    subjects,
    claimed,
    subjectsWithClaims,
    corroborated,
    agreed,
    near,
    degraded,
  } = split;

  console.log(
    `  ${(audits === 'archive') ? 'ARCHIVE text' : 'FRESH   text'}  subjects=${
      String(subjects,)
    }  drew a claim=${String(subjectsWithClaims,)}  claims=${String(claimed,)}  corroborated=${
      String(corroborated,)
    }  agreed=${String(agreed,)}  near=${String(near,)}  degraded=${String(degraded,)}`,
  );
}

/**
 * Prints what each auditor thought was worth a claim.
 *
 * @param rates - one rate per auditor that answered
 *
 * @example
 * ```ts
 * printVoices({ rates, },);
 * ```
 */
export function printVoices({ rates, }: { readonly rates: readonly VoiceRate[]; },): void {
  console.log('\nWHAT EACH AUDITOR THOUGHT WAS WORTH A CLAIM',);
  rates.forEach(function printRate(rate,): void {
    /**
     * This auditor's tally.
     */
    const {
      modelId,
      asked,
      spoke,
      claims,
      dropped,
    } = rate;

    console.log(
      `  ${modelId.padEnd(
        MODEL_COLUMN,
        ' ',
      )} asked=${String(asked,)} spoke on=${String(spoke,)} claims=${
        String(claims,)
      } dropped=${String(dropped,)}`,
    );
  },);
}

/**
 * Prints the omission and addition pairs `#107` says are one relocation.
 *
 * @param pairs - candidate relocations
 *
 * @example
 * ```ts
 * printRelocations({ pairs, },);
 * ```
 */
export function printRelocations(
  { pairs, }: { readonly pairs: readonly AuditRelocationPair[]; },
): void {
  console.log(`\nRELOCATION CANDIDATES (#107): ${String(pairs.length,)}`,);
  pairs.forEach(function printPair(pair,): void {
    console.log(
      `  ${pair.runSet}/${pair.entryId}  omission at ${String(pair.omissionAt,)} <-> addition at ${
        String(pair.additionAt,)
      }`,
    );
  },);
}

/**
 * Prints the spread two audits of one text landed in.
 *
 * SAYS WHEN THERE IS NOTHING TO REPORT rather than printing zeroes. A band of
 * zero over zero pairs and a band of zero over forty pairs are opposite
 * findings, and a row of zeroes reads as the second.
 *
 * @param band - spread over the pairs found
 *
 * @param over - what was paired, named for the reader
 *
 * @example
 * ```ts
 * printBand({ band, over: 'texts audited twice inside this run', },);
 * ```
 */
export function printBand(
  {
    band,
    over,
  }: {
    readonly band: AuditRepeatBand;
    readonly over: string;
  },
): void {
  console.log(`\nINSTRUMENT BAND over ${over}`,);
  if (band.pairs === 0) {
    console.log(
      '  NOTHING PAIRED. Either no text was audited twice, or the rows predate'
        + ' the recorded text identity that pairing needs. No band is quotable'
        + ' from this run, so no comparison in it resolves anything.',
    );
    return;
  }

  console.log(
    `  pairs=${String(band.pairs,)}  same claim count=${String(band.agreedExactly,)}  widest gap=${
      String(band.widest,)
    }  total gap=${String(band.totalGap,)}  silent on one side only=${
      String(band.silentOnOneSide,)
    }`,
  );
  console.log(
    `  claims ${String(band.leftClaimed,)} against ${String(band.rightClaimed,)}`
      + `, corroborated ${String(band.leftCorroborated,)} against ${
        String(band.rightCorroborated,)
      }`,
  );
}

//endregion Settled audit printing
