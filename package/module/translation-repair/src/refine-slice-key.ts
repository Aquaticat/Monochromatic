import { hashContent, } from './document-node.ts';
import type { AdjudicatedIssue, } from './adjudicate-model.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Refine slice key
// What makes two runs' refinements the SAME refinement, for cache purposes.
//
// Split from the phase for the reason `consolidate-key.ts` gives: the key is the
// one piece of a stage testable without a client, and a reader of the phase does
// not want the cache reasoning in the middle of it.
//
// WHY THIS CACHE EXISTS AT ALL. The naturalness lane runs after the accuracy
// pass has already persisted its slices, and it was never cached, so a resumed
// run replayed the accuracy pass from disk and then bought the whole lane again
// with fresh model calls. Measured across the band pair, that published
// different text at 7 of 18 repair-lane slices on identical inputs.
//
// AND WHY MARKING THE OUTCOME WOULD NOT HAVE DONE. `refine-phase.ts` records
// `refined: true` only where a rewrite both changed the text and kept every
// confirmed issue, so the flag reads false both for a slice refinement declined
// and for a slice refinement never saw. Skipping on that flag would still rebuy
// the lane at exactly the slices that flipped between runs, which is where the
// divergence came from. Only a key over the question can settle it.

/**
 Generation of the refinement cache.

 MOVES WHEN THE QUESTION MOVES: the rewriter sheet, the judge sheet, the
 envelope derivation, the retention recheck, or the introduced-defect probe.
 Each of those changes what a voice is asked or how its answer is read.

 IT MOVES FOR THE PROBE TOO, which is the case worth naming. The probe is
 shadow telemetry and decides nothing, but its findings ride in the cached
 record, so a resumed slice would otherwise carry an audit the current prober
 never performed.

 MOVED TO 2 WHEN THE PROBE GAINED ITS WINDOW. The `nearby-source` and
 `nearby-incumbent` fields already change every key that carries one, so this bump decides nothing on
 its own; it is here because the MOVES WHEN THE QUESTION MOVES rule says the version moves when the
 probe's question moves, and a reader checking that rule against this change
 has to find it kept rather than argued around. It also covers the slices
 whose window is empty, which the fields deliberately cannot.

 VERSION 3 makes source-grammar calques and partially polished paragraphs
 explicit rewriter work. Earlier replies answered a weaker naturalness question.

 VERSION 4 moves because refinement output is re-admitted under lane-contest
 winner contributor floor;
 old cached rewrite could bypass new admission question.

 VERSION 5 (2026-09-27) moves with the retention recheck: one cast checker
 ballot no longer resolves an issue (`MIN_RESOLUTION_BALLOTS`), so a
 refinement retained on one confirming ballot is now rolled back.

 EVERY CHANGE TO THE REFINER'S QUESTION SINCE VERSION 5 RIDES INSIDE IT,
 checked on 2026-09-28 rather than assumed, since none moved the number when
 it landed (ledger M28): the house rules the refiner's sheet carries keeping
 OD unnamed as a means (`112b399a5`), one DECLARED NAMES label fenced on every
 sheet (`ed9b37403`), the judge precedence sentence (`fa892a7da`), the refiner
 no longer keeping what the house rules render (`81962c75a`) and treating a
 house correction as an improvement (`091307d14`), one house-form list
 (`fa949b78f`), the introduced-defect probe's reading (`b6df6d5ee`), and the
 meter beside the metre (ledger K13, `403db3c6e`). It costs nothing: the
 newest slice-cache file under the agent runs was written at 04:26 UTC on
 2026-09-27, before version 5 landed at 07:34 UTC.

 The glossary audit's grammatical English house rule, which now states the
 doubled preposition (ledger R5, `357f534b7`), reaches the refiner's sheet and
 rides inside 5 too, checked on 2026-09-28 against the newest slice-cache file
 under the agent runs, still 04:26 UTC on 2026-09-27 (eighteen files after 04:20 UTC
 that day, none after 04:27 UTC). The refiner reads no glossary floor and no
 COMMUNITY RENDERINGS block; the glossary's terms, renderings and whys reach
 it through the identity context, which the key hashes.

 Rides inside 5 too, through the retention recheck's checker round: a panel
 ballot or checker report carrying no usable verdict on its sheet is no heard
 voice, so the gather re-asks the seat rather than closing the round on it
 (ledger L8, `abfc69393`); checked on 2026-09-28: still no slice-cache file
 newer than 04:26 UTC on 2026-09-27.

 Rides inside 5 too: every gather now keeps a seat that answered unreadably
 out of the same-prompt retry rounds and re-asks each such seat, whichever
 round it came in, in the nudged recovery round (ledger P2, `005692e11`),
 which changes whose voices a round closes on; checked on 2026-09-28: still no
 slice-cache file newer than 04:26 UTC on 2026-09-27.

 Rides inside 5 too: a reply whose complete JSON value more text follows is
 read rather than lost (ledger P8, `cac097368`), which changes whose voices
 every round hears; checked on 2026-09-28: still no slice-cache file newer
 than 04:26 UTC on 2026-09-27.

 Rides inside 5 too: a decision seat whose state the endpoint refuses
 as past its context, or that a stage cannot ask, now reads as out of reach
 for that ballot rather than as a lost voice (ledger P13, `a991ef1e1`), which
 changes the quorum a select round closes on; checked on 2026-09-28: still no
 slice-cache file newer than 04:26 UTC on 2026-09-27.

 Rides inside 5 too: the retention recheck now also rules on every accepted
 issue `T1` leaves open, which is every accepted issue of a rewrite of the
 archive after a lost patch, and rolls the slice back on one worse ballot
 (ledger L11, `462c514ee`), so a stored settlement may now be a rollback and
 carries that round's readings; checked on 2026-09-28: still no slice-cache
 file newer than 04:26 UTC on 2026-09-27.

 Rides inside 5 too: a rewrite the damage probe admits a claim against now
 keeps the text before it, with no report attached (ledger L11, `d41ad44c4`),
 so a stored settlement may be that rollback; checked on 2026-09-28: still no
 slice-cache file newer than 04:26 UTC on 2026-09-27.

 Rides inside 5 too: a reply that could not be used is re-asked once,
 nudged, of the same model on another provider through the uniqueness
 wrapper's claims (ledger P9, `7011d72cc`), which changes whose voices every
 round hears; checked on 2026-09-28: still no slice-cache file newer than
 04:26 UTC on 2026-09-27.

 Rides inside 5 too: Bedrock reads dry with 1.33 USD still left, and its
 ledger holds every billed attempt at its bound (ledger P1, `2a108dfb3`,
 `107763dbb` and `7cfd5ae4b`), so a Gemma call moves to OpenRouter sooner
 as Bedrock nears its credit, which changes whose voices a round hears;
 checked on 2026-09-28: still no slice-cache file newer than 04:26 UTC on
 2026-09-27.

 Rides inside 5 too: the recovery round re-asks a reply the length
 limit cut with a nudge naming the cut, apart from one off the shape
 (ledger P10, `ce0ef7b51`), which changes what such a seat is asked and
 whose voices a round hears; checked on 2026-09-28: still no slice-cache
 file newer than 04:26 UTC on 2026-09-27.

 THE PRE-LAUNCH CHECK OF 2026-09-28 (ledger M28): 5 was set
 in `30e66051e` at 07:34 UTC on 2026-09-27, after the newest slice-cache file under the
 agent runs (04:26 UTC on 2026-09-27), and no slice-cache file has been written
 since, so no answer cached under an earlier question can be served under
 this number. Every source commit since then rides inside it, those the
 accounts in this TSDoc name and those they do not (`corpus-run/cache-account-audit.ts`, ledger M28).

 Rides inside 5 too: the declared-identity rule says a footnote marker
 carries its note, and it reaches the introduced-defect probe the refine
 phase runs (ledger L5, `868e848d3`). Checked on 2026-09-28 after
 TianqiChen66621: that run wrote slice-cache files from 10:26 to 10:49 UTC on 2026-09-28 and
 the pass retired them when its artifact landed, so still no slice-cache file
 newer than 04:26 UTC on 2026-09-27 remains to be served under this number.

 Rides inside 5 too: patch application, which the naturalness rewrite goes
 through, clamps each replacement line to the deepest quote its context
 allows (class one hundred eighty-seven, `58287ebe3` and `05a18ed02`); same
 check, same result.

 Rides inside 5 too: the recheck's checkers read the declared names with
 their rules, the cited references and each claim's quotes (ledger L14,
 `resolution-sheet-evidence.ts`), and one worse ballot rolls the rewrite
 back; checked again on 2026-09-28: the only slice-cache file not older than
 04:26 UTC on 2026-09-27 is the consolidation entry written that minute.

 Rides inside 5 too: a slice whose non-translation votes stand is refined
 like any other (ledger L15, `f77363387`), where a stored settlement for one
 records the lane skipped; same check, same result.

 Rides inside 5 too: claim summaries fold onto one line on the probe and
 recheck sheets the phase sends (ledger L14(d), `3be658509`); same check, same
 result.

 Rides inside 5 too: the declared-name guard and the preservation gate's
 tokenizer read text by code point, so a handle written in letters beyond
 the first plane is checked rather than projected to nothing, and an
 ideograph beyond it is a token (ledger B21, `declared-name-survival.ts`,
 `preservation-tokens.ts`); over the pinned archives and settled pages no
 survival answer changes, and neither carries such an ideograph; checked on
 2026-09-29: still no slice-cache file newer than 04:26 UTC on 2026-09-27.

 Rides inside 5 too: the declared-name guard a rewrite passes carries a
 declared name only where it stands as a name, a letter meeting a digit and a
 small letter meeting a capital counting as edges (ledger B23,
 `name-projection.ts`, `11d029fde`); no stored rewrite was replayed, so the
 effect is read from the translate replay, where four wordings of two slices
 now drop a declared form; checked on 2026-09-29: still no slice-cache file
 newer than 04:26 UTC on 2026-09-27.

 Rides inside 5 too: the introduced-defect screen reads a prober's quote and
 an accepted issue's through the evidence fold (ledger B24,
 `introduced-defect-screen.ts`); of the 650 stored claims one turns from
 unanchored to corroborated; checked on 2026-09-29: the newest slice-cache
 file is still the one of 04:26 UTC on 2026-09-27.

 Rides inside 5 too: the introduced-defect probe a rewrite passes carries the
 narrative bound beside the apparatus kinds it excuses a drop by (ledger B28,
 `introduced-defect-wire.ts`); checked on 2026-09-29: still no slice-cache
 file written after 04:27 UTC on 2026-09-27, where a control from midnight
 finds 494.

 Rides inside 5 too: the refine slates show their judges the declared names
 the refiner reads, labelled with the rule a slate needs (ledger B28,
 `declared-names-evidence.ts`); the key already hashes the identity, and the
 same find, rerun for this change, finds none after 04:27 UTC on 2026-09-27
 against a control of 494.

 Rides inside 5 too: a recheck that heard fewer checkers than its stage's
 quorum rolls the rewrite back under `refine-recheck-unheard` and carries
 the checker stage's findings, where it passed the rewrite as checked and
 let the settlement be stored (`refine-recheck.ts`); and the rewriter
 stage keeps what the resolver dropped from a reply as findings. A record
 the unfixed gate wrote could hold a rewrite shipped on such a round, but
 none was written under this number: checked on 2026-10-05 with
 `cache-account-audit --runs-under` over the agent runs, 13,714 slice-cache
 records under 391 runs directories, the newest written at 04:26 UTC on
 2026-09-27, before every cache version's current value was set.

 Rides inside 5 too: a damage probe that heard fewer probers than its
 stage's quorum rolls the rewrite back under `refine-probe-unheard`, where
 it shipped the rewrite (`refine-probe-verdict.ts`); a recheck that met its
 quorum but cast fewer ballots than it on one issue rolls back under
 `refine-recheck-unheard` naming the issue, where it passed the rewrite or
 named a confirmed issue as one the rewrite broke (`refine-recheck.ts`); and
 the rewriter stage records each rewrite the atom gate refused as a finding.
 The probe's short round kept its settlement out of the cache before the
 change too, by the probe stage's own `stage-quorum-unmet` finding; a record
 the unfixed recheck wrote could hold a rewrite shipped on an issue short of
 ballots, but none was written under this number: checked on 2026-10-05 with
 `cache-account-audit --runs-under` over the agent runs, 13,503 slice-cache
 records under 382 runs directories, the newest written at 04:26 UTC on
 2026-09-27, before every cache version's current value was set; three
 directories another user owns, which the audit could not list, are left
 out of that count.
 */
export const REFINE_CACHE_VERSION = 5;

/**
 Everything about this run that changes what the voices are ASKED.

 Without it a resumed slice could return a rewrite reached by a different
 roster and nothing would look wrong, since the texts match and so the key
 matches.

 THE CHECKERS BELONG HERE even though they never rewrite anything. They decide
 whether a refinement is rolled back for breaking a confirmed issue, so a
 different checker roster can ship a rewrite this one refused.

 `perCallTimeoutMs` is deliberately ABSENT, on the reasoning every other lane
 gives: it changes how long a voice has to answer, not what it is asked.

 @param refinerModelIds - voices asked to rewrite

 @param judgeModelIds - voices asked which rewrite wins

 @param checkerModelIds - voices deciding whether a rewrite kept what was
 already proved, and auditing what it damaged

 @param identityContext - names and handles both documents declare

 @param referenceContext - what the pages the original cites say, with
 their rule, when the original cites any (class forty-one)

 @returns Stable string for the key

 @example
 ```ts
 const runShape = refineRunShape({ refinerModelIds, judgeModelIds, checkerModelIds, identityContext, },);
 ```
 */
export function refineRunShape(
  {
    refinerModelIds,
    judgeModelIds,
    checkerModelIds,
    identityContext,
    referenceContext,
  }: {
    readonly refinerModelIds: readonly RosterModelId[];
    readonly judgeModelIds: readonly RosterModelId[];
    readonly checkerModelIds: readonly RosterModelId[];
    readonly identityContext?: string;
    readonly referenceContext?: string;
  },
): string {
  return JSON.stringify([
    refinerModelIds,
    judgeModelIds,
    checkerModelIds,
    identityContext ?? '',
    // AFTER THE IDENTITY, so a key written before class forty-one and one
    // written without references differ only when references exist.
    ...(((referenceContext ?? '') === '') ? [] : [referenceContext,]),
  ],);
}

/**
 Cross-run key for one refined slice.

 THE DEFINITIONS ARE IN IT, which is what separates this key from the accuracy
 pass's own. `refine-phase.ts` collects link and footnote definitions from the
 WHOLE assembled document so a paragraph's references resolve while it is being
 gated, which means a neighbouring slice settling differently changes what this
 slice's rewriter is shown. That is the window lesson the repair slice key taught: a
 per-slice key omitting context the model saw resumes a stale rewrite after a
 neighbour moves.

 THE ISSUES ARE IN IT WHOLE rather than as identifiers. Their text is shown to
 the checkers deciding whether a rewrite kept what was already proved, so two
 slices carrying the same issue identifiers over different wording are not the
 same question.

 THE SLICE INDEX IS NOT IN IT, matching every other lane. Where a slice sits
 changes nothing a voice is asked, and keeping the index would discard every
 settled refinement after a renumbering.

 THE INCUMBENT IS IN IT THOUGH IT REACHES NO PROMPT, which reads like a
 mistake until the stored record is read. No rewriter, judge or checker is
 ever shown the archive wording. The RECORD is computed from it:
 `settleRefinedSlice` sets `changed` by comparing its rewrite against the
 incumbent, and drops `resolvedIssueIds` wherever the two match, so two runs
 over one source and one repaired text but different archive wording settle
 differently and would otherwise share a key. `consolidate-key.ts` covers the
 standing text for the same reason.

 NOTHING PINS THE INCUMBENT TO THE REPAIRED TEXT one to one. Even where no
 current path yields a moved incumbent under an unchanged repaired text, that
 is a coincidence of what other stages happen to do rather than an invariant
 anything asserts, and what it leaves is not a self-healing rebuy:
 `repair-refine-step.ts` throws on any resumed slice whose stored `changed`
 disagrees with the incumbent the current run computed.

 @param runShape - what this run asks, from {@link refineRunShape}

 @param sourceText - slice original, which is the faithfulness anchor

 @param repairedText - what the accuracy pass settled, which is what gets
 rewritten and what the probe measures damage against

 @param incumbentText - archive wording a rewrite may land back on, which
 reaches no prompt and decides both the stored `changed` flag and the
 resolutions that flag gates

 @param definitions - link and footnote definitions of the assembled document,
 which vary with what every OTHER slice settled

 @param declaredNames - attributions a rewrite may not invent or drop

 @param issues - claims the accuracy pass filed, shown to the checkers

 @param resolvedIssueIds - subset the checkers had already confirmed, which
 decides what a rollback is measured against

 @param nonTranslationStanding - whether critics ruled this slice untranslated;
 it skipped the lane until ledger L15 and is evidence only since; it stays in the
 key, where it only splits slices more finely than the question does

 @param neighbouringSourceText - original of the passages either side, shown to
 the probe auditing what this rewrite damaged. In the key because a rewrite
 audited against its neighbours was asked a different question from the same
 rewrite audited alone, and the audit rides in the cached record

 @param neighbouringIncumbentText - archive English of those same two, which is
 the half a relocation shows

 @returns Hash keying this slice's refinement

 @example
 ```ts
 const key = refineSliceKey({ runShape, sourceText, repairedText, incumbentText, definitions, declaredNames, issues, resolvedIssueIds, nonTranslationStanding, },);
 ```
 */
export function refineSliceKey(
  {
    runShape,
    sourceText,
    repairedText,
    incumbentText,
    definitions,
    declaredNames,
    issues,
    resolvedIssueIds,
    nonTranslationStanding,
    neighbouringSourceText,
    neighbouringIncumbentText,
  }: {
    readonly runShape: string;
    readonly sourceText: string;
    readonly repairedText: string;
    readonly incumbentText: string;
    readonly definitions: string;
    readonly declaredNames: readonly string[];
    readonly issues: readonly AdjudicatedIssue[];
    readonly resolvedIssueIds: readonly string[];
    readonly nonTranslationStanding: boolean;
    readonly neighbouringSourceText?: string;
    readonly neighbouringIncumbentText?: string;
  },
): string {
  return hashContent({
    content: JSON.stringify([
      'refine',
      REFINE_CACHE_VERSION,
      runShape,
      sourceText,
      repairedText,
      incumbentText,
      definitions,
      declaredNames,
      issues,
      resolvedIssueIds,
      nonTranslationStanding,
      // ABSENT AND EMPTY KEY ALIKE, matching `repairSliceKey` and for the same
      // reason: `introduced-defect-wire.ts` renders no nearby block for either,
      // so a slice with no neighbours is asked exactly what a caller without
      // the parameter asked and should resume rather than be rebought to reach
      // the identical answer.
      //
      // LABELLED for the reason the repair slice key learned. Spread bare into a positional
      // array, a source-only window and an incumbent-only window carrying the
      // same text hash identically, and one cached audit would then serve two
      // different questions. Asymmetric windows are real: a neighbour that is
      // an insertion anchor has source text and no archive text.
      ...(((neighbouringSourceText === undefined) || (neighbouringSourceText === ''))
        ? []
        : [
          'nearby-source',
          neighbouringSourceText,
        ]),
      ...(((neighbouringIncumbentText === undefined) || (neighbouringIncumbentText === ''))
        ? []
        : [
          'nearby-incumbent',
          neighbouringIncumbentText,
        ]),
    ],),
  },);
}

//endregion Refine slice key
