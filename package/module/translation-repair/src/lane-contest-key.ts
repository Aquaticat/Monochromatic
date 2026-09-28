import type { SliceSyntax, } from './chunk-document.ts';
import { hashContent, } from './document-node.ts';
import type { IncumbentKind, } from './translate-absence.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Lane contest key
// What makes two runs` contests the SAME contest, for cache purposes.
//
// Split from the driver for the same reasons `repair-slice-key.ts` and
// `translate-slice-key.ts` were: the key is the one piece of a driver that can
// be tested without a client, and a reader of the driver does not want the
// cache reasoning in the middle of it.

/**
 Generation of the contest cache.
 
 MOVES WHEN THE QUESTION MOVES: the prompt, the schema, the ballot reader, the
 quorum, or anything else that changes what a judge is asked or how its answer
 is read. It does NOT move for a change to how a settled outcome is RECORDED,
 since the ballots on disk still answer the question that bought them.
 
 VERSION 2 adds target-authoritative contributor spelling to metadata policy.
 Version 1 ballots never answered that question and cannot settle it now.
 
 VERSION 3 tells judges which syntax candidates deterministic publication
 guard rejects. Earlier ballots spent votes on candidates unable to ship.
 
 VERSION 4 starts straggler grace at exact-half participation even when
 deterministic eligibility excludes one lane.
 
 VERSION 5 excludes candidate that drops target-authoritative contributor form.

 VERSION 6 (2026-09-28): version 5 landed on 2026-08-29, and nothing moved it
 through a month of changes to what the judges are asked and how their
 rounds close (ledger M28): the rewrite probe's corroborated claims
 (`b2a39c09a`, `2530537a2`), the eligibility floor's named findings
 (`558b46e11`, `1ff4cb31d`), windowed rounds (`33a023445`) and rounds sized on
 the seats that could answer (`a107c7486`, `29baade8f`), the community
 glossary and rendered line structure (`b7a0b4f5f`, `1a6ebbf62`, `a0fd3cc7c`,
 `070db03dd`), cited references (`20a7272dc`), the dispute note (`85ed2881f`,
 `07170adf0`), apparatus (`7ad1b8ec7`, `2472ec48e`, `e7e3f9c17`), the size note
 (`d94f6787b`), declared names inside linked titles (`645ed9d62`), Canadian
 spelling (`b45000747`), every house rule the judging sheet carries, and the
 prose ranges the eligibility floor's Han-residue check reads (ledger K7).
 Contest ballots were cached under version 5 on fifteen days between
 2026-09-07 and 2026-09-27, each under that day's sheet, so a resumed run
 could read ballots cast on a question no longer asked.

 The glossary audit's corrections ride inside 6 too (ledger C3 to R16,
 `357f534b7`), checked on 2026-09-28 against the newest slice-cache file under
 the agent runs, still 00:26 on 2026-09-27 (eighteen files after 00:20 that
 day, none after 00:27): the eligibility floor refuses and passes other forms,
 the COMMUNITY RENDERINGS block on the contest sheet counts a rendering
 inflected and bounded, and the grammatical English house rule states the
 doubled preposition. The terms, renderings and whys reach the identity
 context, which the key hashes.

 Rides inside 6 too: the contest sheet no longer shows the accuracy probe's
 claims on a slice whose patch lost, since the repair candidate there never
 carried the patched text (ledger L7); checked on 2026-09-28: still no
 slice-cache file newer than 00:26 on 2026-09-27.

 Rides inside 6 too: every gather now keeps a seat that answered unreadably
 out of the same-prompt retry rounds and re-asks each such seat, whichever
 round it came in, in the nudged recovery round (ledger P2, `005692e11`),
 which changes whose voices a round closes on; checked on 2026-09-28: still no
 slice-cache file newer than 00:26 on 2026-09-27.

 Rides inside 6 too: a reply whose complete JSON value more text follows is
 read rather than lost (ledger P8, `cac097368`), which changes whose voices
 every round hears; checked on 2026-09-28: still no slice-cache file newer
 than 00:26 on 2026-09-27.

 Rides inside 6 too: a reply that could not be used is re-asked once,
 nudged, of the same model on another provider through the uniqueness
 wrapper's claims (ledger P9, `7011d72cc`), which changes whose voices every
 round hears; checked on 2026-09-28: still no slice-cache file newer than
 00:26 on 2026-09-27.
 */
export const LANE_CONTEST_CACHE_VERSION = 6;

/**
 Everything about this run that changes what the judges are ASKED, folded into
 every contest key.
 
 Without it a resumed slice could return ballots cast by a different roster,
 and nothing would look wrong: the texts match, so the key matches. Identity
 context belongs here for the same reason, since it is front-matter-derived
 prompt content that varies per pair and measurably changes the answer.
 
 `perCallTimeoutMs` is deliberately ABSENT, on the same reasoning the other
 two lanes give: it changes how long a voice has to answer, not what it is
 asked, and including it would discard every settled contest on a deadline
 change.
 
 @param modelIds - roster asked to judge
 
 @param identityContext - names and handles both documents declare

 @param referenceContext - what the pages the original cites say, folded in
 only when the original cites any, so an entry that cites nothing keys as
 before
 
 @returns Stable string for the key
 
 @example
 ```ts
 const runShape = laneContestRunShape({ modelIds, identityContext, },);
 ```
 */
export function laneContestRunShape(
  {
    modelIds,
    identityContext,
    referenceContext,
  }: {
    readonly modelIds: readonly RosterModelId[];
    readonly identityContext?: string;
    readonly referenceContext?: string;
  },
): string {
  return JSON.stringify([
    modelIds,
    identityContext ?? '',
    ...(((referenceContext ?? '') === '') ? [] : [referenceContext,]),
  ],);
}

/**
 Cross-run key for one contested slice.
 
 THE SLICE INDEX IS NOT IN IT, matching both lanes. A key is what makes two
 runs` slices the same slice, and what a contest judge is asked is the
 original, the archive rendering and the two candidates. Where the slice
 happens to sit changes none of it, and keeping the index would discard every
 settled contest after any renumbering.
 
 THE ARCHIVE RENDERING IS IN IT even though the contest never ships it. The
 judge is shown it as evidence about what the passage has said before, so two
 contests over identical candidates and different archive wording are not the
 same question.
 
 @param runShape - what this run asks, from {@link laneContestRunShape}
 
 @param sourceText - slice original, which is the standard
 
 @param incumbentText - archive rendering shown as evidence
 
 @param incumbentKind - whether the archive has wording here at all
 
 @param syntax - syntax role changing judge policy
 
 @param repairText - what the repair lane would ship
 
 @param translateText - what the translate lane would ship

 @param repairDamageClaims - corroborated claims shown against the repair
 candidate, absent when none

 @param archiveDisputeNote - accepted additions shown against the archive
 rendering, absent on an undisputed slice (class one hundred eight)

 @param lineStructured - whether the line rule governs the slice, which
 puts the judge line clause on the sheet (ledger S15)
 
 @returns Hash keying this slice`s ballots
 
 @example
 ```ts
 const key = laneContestSliceKey({ runShape, sourceText, incumbentText, incumbentKind, repairText, translateText, },);
 ```
 */
export function laneContestSliceKey(
  {
    runShape,
    sourceText,
    incumbentText,
    incumbentKind,
    syntax,
    repairText,
    translateText,
    repairDamageClaims = [],
    archiveDisputeNote,
    lineStructured,
  }: {
    readonly runShape: string;
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly incumbentKind: IncumbentKind;
    readonly syntax?: SliceSyntax;
    readonly repairText: string;
    readonly translateText: string;
    readonly repairDamageClaims?: readonly string[];
    readonly archiveDisputeNote?: string;
    readonly lineStructured: boolean;
  },
): string {
  return hashContent({
    content: JSON.stringify([
      'lane-contest',
      LANE_CONTEST_CACHE_VERSION,
      runShape,
      sourceText,
      incumbentKind,
      incumbentText,
      ...((syntax === undefined)
        ? []
        : [
          'syntax',
          syntax,
        ]),
      repairText,
      translateText,
      // Claims change what the judges were shown, so ballots bought without
      // them must not answer for a question asked with them; a slice with no
      // claim keys exactly as before.
      ...((repairDamageClaims.length === 0)
        ? []
        : [
          'damage',
          ...repairDamageClaims,
        ]),
      // A dispute note changes the question the same way (class one hundred
      // eight); an undisputed slice keys exactly as before.
      ...((archiveDisputeNote === undefined)
        ? []
        : [
          'dispute',
          archiveDisputeNote,
        ]),
      // The line clause changes the question the same way (ledger S15); a
      // prose slice keys exactly as before.
      ...(lineStructured ? ['line-structured',] : []),
    ],),
  },);
}

//endregion Lane contest key
