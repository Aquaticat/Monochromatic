import type { ArchiveOriginalSpan, } from '../archive-original-note.ts';
import { withholdLoneContainerHalves, } from '../assembly-container-halves.ts';
import { guardFootnoteAssembly, } from '../assembly-integrity.ts';
import type { ChunkPair, } from '../chunk-document.ts';
import type { SliceReplacement, } from '../splice-slices.ts';
import {
  type PagePassesOutcome,
  runPagePasses,
} from './page-assembly-passes.ts';

//region Page assembly rounds
// THE PAGE PASSES READ THE PAGE THE GUARD LEAVES (ledger K5). A lane row the
// footnote guard takes back, or a container half withheld because its partner
// ships nothing, leaves the archive's text standing at that slice; but the
// passes had read the lane's row there, so the archive text shipped as no pass
// had read it: a day-first date an untouched slice would carry month first
// stayed day first. And a cross-slice pass (a handle's gloss placed at its
// first appearance) could decide on a row the page no longer carries (A15).
// So the passes and the guard run again over the rows left, until a round
// takes nothing back; each round's input lacks every row taken back before,
// so the rounds are at most one more than the rows.

/**
 A round took back a row it was never given, which would stop the rounds from
 ever settling.

 @example
 ```ts
 throw new PageAssemblyRoundError({ sliceIndex: 4, round: 2, },);
 ```
 */
export class PageAssemblyRoundError extends Error {
  /**
   Declares this message safe to forward: it names a slice index and a round
   number.
   */
  readonly messageNamesOnly: true = true;

  /**
   Builds the unsettled-rounds failure.

   @param sliceIndex - slice the round took back

   @param round - round that took it back, from one
   */
  constructor(
    {
      sliceIndex,
      round,
    }: {
      readonly sliceIndex: number;
      readonly round: number;
    },
  ) {
    super(
      `page assembly round ${String(round,)} took back slice ${String(sliceIndex,)}, whose row an earlier round had already taken back`,
    );
    this.name = 'PageAssemblyRoundError';
  }
}

/**
 One round: the container halves, every page pass, and the footnote guard.

 @example
 ```ts
 const round: PageAssemblyRound = assembleRound({ slices, sourceText, targetText, replacements, archiveOriginalSpans, incumbentBySlice, },);
 ```
 */
export type PageAssemblyRound = {
  /**
   Container halves withheld and why.
   */
  readonly halves: ReturnType<typeof withholdLoneContainerHalves>;

  /**
   What the passes made of the rows left.
   */
  readonly passes: PagePassesOutcome;

  /**
   The footnote guard's reading of the page the passes left.
   */
  readonly guarded: ReturnType<typeof guardFootnoteAssembly>;
};

/**
 Runs one round over a set of lane rows.

 @param slices - preparation defining replacement spans

 @param sourceText - the original document

 @param targetText - archive text the replacement spans address

 @param replacements - lane rows this round starts from

 @param archiveOriginalSpans - spans sealed as the English original

 @param incumbentBySlice - archive text of every slice, by index

 @returns The round's halves, passes and guard

 @example
 ```ts
 const round = assembleRound({ slices, sourceText, targetText, replacements, archiveOriginalSpans, incumbentBySlice, },);
 ```
 */
function assembleRound(
  {
    slices,
    sourceText,
    targetText,
    replacements,
    archiveOriginalSpans,
    incumbentBySlice,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly replacements: readonly SliceReplacement[];
    readonly archiveOriginalSpans: readonly ArchiveOriginalSpan[];
    readonly incumbentBySlice: ReadonlyMap<number, string>;
  },
): PageAssemblyRound {
  /**
   Rows less any container half whose partner ships nothing (class
   fifty-seven), so the guard never reads a closing tag with no opening.
   */
  const halves = withholdLoneContainerHalves({
    slices,
    replacements,
  },);
  /**
   What every page-assembly pass made of those rows.
   */
  const passes = runPagePasses({
    slices,
    sourceText,
    targetText,
    replacements: halves.replacements,
    archiveOriginalSpans,
  },);
  return {
    halves,
    passes,
    guarded: guardFootnoteAssembly({
      targetText,
      slices,
      replacements: passes.replacements
        .filter(function stillChanges(replacement,): boolean {
          // A restoration that brings a slice back to the archive's exact
          // wording is no change for the assembler; its override row still
          // says what the page carries.
          return replacement.replacementText !== incumbentBySlice.get(replacement.sliceIndex,);
        },),
    },),
  };
}

/**
 Slices one round took back.

 @param round - round to read

 @returns Withheld halves, then the guard's withdrawals

 @example
 ```ts
 const taken = takenBackIn({ round, },);
 ```
 */
function takenBackIn({ round, }: { readonly round: PageAssemblyRound; },): readonly number[] {
  return [
    ...round.halves
      .withheld,
    ...round.guarded
      .revertedChunkIndices,
  ];
}

/**
 Whether one round took anything back.
 
 @param round - round to read
 
 @returns True when it withheld a half or withdrew a row
 
 @example
 ```ts
 if (tookBack({ round, },)) rerun();
 ```
 */
function tookBack({ round, }: { readonly round: PageAssemblyRound; },): boolean {
  /**
   Slices it took back.
   */
  const taken = takenBackIn({ round, },);
  return taken.length > 0;
}

/**
 Runs rounds until one takes nothing back.

 @param slices - preparation defining replacement spans

 @param sourceText - the original document

 @param targetText - archive text the replacement spans address

 @param replacements - lane rows the page would write

 @param archiveOriginalSpans - spans sealed as the English original

 @param incumbentBySlice - archive text of every slice, by index

 @returns The settling round, every slice taken back in round order, and the
 findings of the rounds that took them back

 @throws {@link PageAssemblyRoundError} when a round takes back a row an
 earlier round already had

 @example
 ```ts
 const { final, takenBack, earlierFindings, } = settlePageRounds({ slices, sourceText, targetText, replacements, archiveOriginalSpans, incumbentBySlice, },);
 ```
 */
export function settlePageRounds(
  {
    slices,
    sourceText,
    targetText,
    replacements,
    archiveOriginalSpans,
    incumbentBySlice,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly replacements: readonly SliceReplacement[];
    readonly archiveOriginalSpans: readonly ArchiveOriginalSpan[];
    readonly incumbentBySlice: ReadonlyMap<number, string>;
  },
): {
  readonly final: PageAssemblyRound;
  readonly takenBack: readonly number[];
  readonly earlierFindings: readonly string[];
} {
  /**
   Slices taken back so far, in round order.
   */
  const takenBack: number[] = [];
  /**
   Findings of the rounds that took something back.
   */
  const earlierFindings: string[] = [];
  /**
   The latest round and its number, from one: A NAMED CELL, since the loop
   replaces both.
   */
  const state = {
    roundNumber: 1,
    round: assembleRound({
      slices,
      sourceText,
      targetText,
      replacements,
      archiveOriginalSpans,
      incumbentBySlice,
    },),
  };
  while (tookBack({ round: state.round, },)) {
    for (const sliceIndex of takenBackIn({ round: state.round, },)) {
      if (takenBack.includes(sliceIndex,)) {
        throw new PageAssemblyRoundError({
          sliceIndex,
          round: state.roundNumber,
        },);
      }
      takenBack.push(sliceIndex,);
    }
    /**
     What the round that took them back found.
     */
    const {
      halves,
      guarded,
    } = state.round;
    earlierFindings.push(
      ...halves.findings,
      ...guarded.findings,
    );
    state.roundNumber += 1;
    state.round = assembleRound({
      slices,
      sourceText,
      targetText,
      replacements: replacements.filter(function stillStanding(replacement,): boolean {
        return !takenBack.includes(replacement.sliceIndex,);
      },),
      archiveOriginalSpans,
      incumbentBySlice,
    },);
  }
  return {
    final: state.round,
    takenBack,
    earlierFindings,
  };
}

//endregion Page assembly rounds
