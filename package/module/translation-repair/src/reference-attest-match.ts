import { foldedLine, } from './entry-notes.ts';
import type { AttestationItemWire, } from './reference-attest-wire.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Reference attestation matching
// Pure text: which attested items verify against the archive and the
// reference lines, how items from several voices merge into one detail, how
// a detail reads on a sheet, and whether a claim's quote overlaps one. No
// provider, no disk (class thirty-seven, 2026-09-16).

/**
 What `indexOf` answers when nothing is found.
 */
const NOT_FOUND = -1;

/**
 Text with every whitespace character removed, so a quote is compared word
 for word and nothing else. Measured on Mio22 (2026-09-16): one of three
 voices attesting the sister wrote the reference's Chinese with spaces
 around its Latin tokens, and a check that only folded whitespace lost the
 quorum on that space.

 @param text - text to compact

 @returns Text without whitespace

 @example
 ```ts
 compacted({ text: 'Mio 的姐姐也是 MtF。', },);
 // => 'Mio的姐姐也是MtF。'
 ```
 */
export function compacted(
  { text, }: { readonly text: string; },
): string {
  return foldedLine({ text, },)
    .split(' ',)
    .join('',);
}

/**
 One detail the bench attested: archive words a reference states, with the
 reference's words and how many voices said so.

 @example
 ```ts
 const detail: AttestedDetail = {
   archiveQuote: 'She has an older sister who is also a tabby.',
   reference: 1,
   referenceQuote: 'Mittens had an older sister who was also a tabby.',
   voices: 3,
   heard: 4,
 };
 ```
 */
export type AttestedDetail = {
  /**
   Exact words of the archive carrying the detail, the longest span any
   attesting voice quoted.
   */
  readonly archiveQuote: string;
  /**
   Which reference states it, numbered from one.
   */
  readonly reference: number;
  /**
   Exact words of that reference stating it.
   */
  readonly referenceQuote: string;
  /**
   Distinct voices whose verified quotes overlap this one.
   */
  readonly voices: number;
  /**
   Voices heard in all, so the count reads as a share.
   */
  readonly heard: number;
};

/**
 One verified item, with the voice that gave it.
 */
export type VerifiedAttestation = {
  /**
   Voice that answered.
   */
  readonly modelId: RosterModelId;
  /**
   Item as answered.
   */
  readonly item: AttestationItemWire;
};

/**
 Whether one quote is found, whitespace ignored, inside one text.

 @param quote - words to find

 @param text - text to find them in

 @returns Whether the compacted quote is non-empty and a substring of the
 compacted text

 @example
 ```ts
 quoteIsIn({ quote: 'older  sister', text: 'an older sister who', },);
 // => true
 ```
 */
export function quoteIsIn(
  {
    quote,
    text,
  }: {
    readonly quote: string;
    readonly text: string;
  },
): boolean {
  /**
   Quote without its whitespace.
   */
  const compact = compacted({ text: quote, },);
  if (compact === '')
    return false;
  return compacted({ text, },)
    .includes(compact,);
}

/**
 Items of one reply whose quotes are found character for character, the
 archive quote in the archive and the reference quote in the reference
 lines.

 @param modelId - voice that answered

 @param items - items as answered

 @param archiveText - archive rendering the quotes are read against

 @param referenceContext - reference lines

 @returns Items that verify, in answer order

 @example
 ```ts
 const verified = verifiedAttestations({ modelId, items, archiveText, referenceContext, },);
 ```
 */
export function verifiedAttestations(
  {
    modelId,
    items,
    archiveText,
    referenceContext,
  }: {
    readonly modelId: RosterModelId;
    readonly items: readonly AttestationItemWire[];
    readonly archiveText: string;
    readonly referenceContext: string;
  },
): readonly VerifiedAttestation[] {
  return items
    .filter(function verifies(item,): boolean {
      return quoteIsIn({
        quote: item.archiveQuote,
        text: archiveText,
      },) && quoteIsIn({
        quote: item.referenceQuote,
        text: referenceContext,
      },);
    },)
    .map(function withVoice(item,): VerifiedAttestation {
      return {
        modelId,
        item,
      };
    },);
}

/**
 One verified item placed in the folded archive.
 */
type PlacedAttestation = VerifiedAttestation & {
  /**
   Where the folded archive quote starts.
   */
  readonly start: number;
  /**
   Where it ends, exclusive.
   */
  readonly end: number;
};

/**
 Merges verified items from every voice into details, one per run of
 overlapping archive quotes, keeping those enough distinct voices gave.

 @param verified - verified items from every voice

 @param archiveText - archive rendering the quotes are placed in

 @param heard - voices heard in all

 @param needed - distinct voices a detail needs

 @returns Details in archive order

 @example
 ```ts
 const details = mergedAttestations({ verified, archiveText, heard: 4, needed: 2, },);
 ```
 */
export function mergedAttestations(
  {
    verified,
    archiveText,
    heard,
    needed,
  }: {
    readonly verified: readonly VerifiedAttestation[];
    readonly archiveText: string;
    readonly heard: number;
    readonly needed: number;
  },
): readonly AttestedDetail[] {
  /**
   Compacted archive every quote is placed in.
   */
  const folded = compacted({ text: archiveText, },);
  /**
   Items placed in the archive, in start order.
   */
  const placed = verified
    .map(function place(entry,): PlacedAttestation {
      /**
       Compacted archive quote.
       */
      const quote = compacted({ text: entry.item
        .archiveQuote, },);
      /**
       Where it starts; verification found it, so never absent.
       */
      const start = folded.indexOf(quote,);
      return {
        ...entry,
        start,
        end: start + quote.length,
      };
    },)
    .filter(function isPlaced(entry,): boolean {
      return entry.start !== NOT_FOUND;
    },)
    .toSorted(function byStart(
      left,
      right,
    ): number {
      return left.start - right.start;
    },);
  /**
   Runs of overlapping placements.
   */
  const runs: PlacedAttestation[][] = [];
  for (const entry of placed) {
    /**
     Run this placement continues, when it overlaps the run's reach.
     */
    const current = runs.at(-1,);
    if ((current !== undefined) && (entry.start < Math.max(...current.map(function endOf(member,): number {
      return member.end;
    },),))) {
      current.push(entry,);
      continue;
    }
    runs.push([entry,],);
  }
  return runs
    .map(function toDetail(run,): AttestedDetail {
      /**
       Distinct voices in the run.
       */
      const voices = new Set(run.map(function voiceOf(member,): RosterModelId {
        return member.modelId;
      },),).size;
      /**
       Widest quote of the run, which covers the most of the detail.
       */
      const widest = run.reduce(function wider(
        best,
        member,
      ): PlacedAttestation {
        return ((member.end - member.start) > (best.end - best.start)) ? member : best;
      },);
      return {
        archiveQuote: widest.item
          .archiveQuote,
        reference: widest.item
          .reference,
        referenceQuote: widest.item
          .referenceQuote,
        voices,
        heard,
      };
    },)
    .filter(function enough(detail,): boolean {
      return detail.voices >= needed;
    },);
}

/**
 Lines the sheets carry for the attested details, after the reference lines.

 @param details - attested details

 @returns One line per detail

 @example
 ```ts
 const lines = attestedDetailLines({ details, },);
 ```
 */
export function attestedDetailLines(
  { details, }: { readonly details: readonly AttestedDetail[]; },
): readonly string[] {
  return details.map(function lineOf(detail,): string {
    return `- attested: the ARCHIVE's "${foldedLine({ text: detail.archiveQuote, },)}" is stated by reference ${
      String(detail.reference,)
    } ("${foldedLine({ text: detail.referenceQuote, },)}"), ${String(detail.voices,)} of ${
      String(detail.heard,)
    } voices checked word for word`;
  },);
}

/**
 Whether a claim's quoted words overlap an attested archive quote: one
 contains the other, or both sit in the text and their spans intersect.

 @param quote - words a claim quotes from the archive side

 @param text - text both are read in, ordinarily the slice

 @param details - attested details

 @returns Details overlapped, in their order; none when nothing overlaps

 @example
 ```ts
 const hits = attestedDetailsOverlapping({ quote, text, details, },);
 ```
 */
export function attestedDetailsOverlapping(
  {
    quote,
    text,
    details,
  }: {
    readonly quote: string;
    readonly text: string;
    readonly details: readonly AttestedDetail[];
  },
): readonly AttestedDetail[] {
  /**
   Compacted claim quote.
   */
  const claimQuote = compacted({ text: quote, },);
  if (claimQuote === '')
    return [];
  /**
   Compacted text the spans are placed in.
   */
  const folded = compacted({ text, },);
  /**
   Where the claim quote sits, when it does.
   */
  const claimStart = folded.indexOf(claimQuote,);
  return details.filter(function overlaps(detail,): boolean {
    /**
     Compacted attested quote.
     */
    const attestedQuote = compacted({ text: detail.archiveQuote, },);
    if (attestedQuote.includes(claimQuote,) || claimQuote.includes(attestedQuote,))
      return true;
    if (claimStart === NOT_FOUND)
      return false;
    /**
     Where the attested quote sits in the same text, when it does.
     */
    const attestedStart = folded.indexOf(attestedQuote,);
    if (attestedStart === NOT_FOUND)
      return false;
    return (claimStart < (attestedStart + attestedQuote.length))
      && (attestedStart < (claimStart + claimQuote.length));
  },);
}

//endregion Reference attestation matching
