import type { AdjudicationConfig, } from './adjudicate-model.ts';
import { hashContent, } from './document-node.ts';
import type { RepairModels, } from './repair-contract.ts';

//region Repair slice key
// What makes two runs' repair slices the SAME slice, for cache purposes.
//
// Split from the driver rather than inlined there, for two reasons. The version
// constant carries the longest comment in this package, because every bump has
// to record why it was needed, and a reader of the driver does not want it. And
// the key is the one piece of the driver that can be tested without a client:
// inlined, nothing could check that a roster change moves it.
//
// Mirrors `translateRunShape` and `translateSliceKey`, deliberately. The two
// lanes cache into one directory, and a reader comparing what each folds into
// its key should be able to read them side by side.

/**
 * Slice-cache schema version, mixed into every cache key.
 *
 * The cache stores serialized `ChunkRepairOutcome` values, so a run resuming
 * across a change to that shape would splice yesterday's outcomes into today's
 * report and silently answer a question they never recorded. Cached repair
 * provenance is the live example: outcomes written before repairs existed carry
 * none, and a resumed slice would contribute ungradable items to a precision
 * sheet without anything looking wrong. Bump this whenever
 * `ChunkRepairOutcome` changes shape OR an existing field changes meaning; the
 * structural guard in the cache store catches only the first of those.
 *
 * A GATE change is the second kind and is the easiest to miss, so version 6 is
 * recorded here as the example: the footnote-integrity gate left the prompts,
 * the roster and the texts identical, so the structural guard and `runShape`
 * both matched, while a candidate the old gate shipped may be one the new gate
 * refuses. `runShape` cannot catch that by construction, because it covers what
 * the models are ASKED and a gate changes only what the code does with their
 * answers. Nothing enforces this bump; it was missed once already, on the very
 * commit that added that gate.
 *
 * Version 7 is the same lesson applied straight away: widening typography
 * restoration from the replaced region to the whole document changes the text
 * that ships, with every prompt and every roster identical. Version 8 likewise:
 * naturalness eligibility stopped counting a repaired parse as a degraded one,
 * so slices that skipped the lane now enter it.
 *
 * Version 9 is the first bump for pure TELEMETRY, and it is still required:
 * `quote-not-found` findings gained a suffix naming whether collapsing soft
 * line breaks would have located the quote. No claim changes fate, but
 * `findings` is part of the cached payload, so a resumed slice would report
 * the old bare reason and understate the count the suffix exists to produce.
 *
 * Version 10 is telemetry again, and required for the same reason: the outcome
 * gained `claimAttributions` and `heardCriticIds`. No claim changes fate and no
 * text changes, but a slice resumed from a version-9 file would carry neither,
 * so an entry would silently mix attributable and unattributable slices. That
 * is precisely the population confusion the fields exist to prevent, so
 * resolving it by tolerating the old shape would defeat them.
 *
 * Version 11 is the first bump for a BEHAVIOUR change since 8: accepted issues
 * naming one defect in one place are now merged before envelopes are cut, so a
 * chunk emits fewer issues and cuts fewer envelopes than it did. A slice
 * resumed from a version-10 file would carry the duplicates the merge exists to
 * remove, and would have spent the editor's budget on them, so the two cannot
 * be mixed within one entry. Ratified in
 * `doc/decision/translation-repair-duplicate-issue-emission.md`.
 *
 * Version 12 is behaviour again: the preservation gate now runs inside
 * `applyPatchOperations` and rejects an operation that drops content no
 * accepted issue quoted. A slice resumed from version 11 carries text an edit
 * the gate would now refuse already changed, so the two cannot be mixed.
 *
 * Versions 13 through 16 were bumped without a paragraph here, which the note
 * above says must never happen; recovered from the commits that moved the
 * constant rather than reconstructed, so each is what its own change says it
 * is. Version 13 (`4a4a8b6bc`) pairs sections only when the aligner is forced
 * to, and never blocks on a refusal, so a slice resumed from 12 was paired by a
 * different rule. Version 14 (`d1d1d874e`) stops the editor composing poetry
 * over verse. Version 15 (`2193b5877`) computes line structure instead of
 * asking the editor to notice it. Version 16 (`a14ea4f94`) records WHY the
 * apply gate refused an operation, which is the findings payload rather than
 * the text. The first three change what ships and the last changes the record,
 * and all four are the kinds this note already names.
 *
 * Version 17 is behaviour by way of WHO WAS HEARD. The channel-marker stripper
 * now matches the shape of a truncated `<|word|>` tail rather than the single
 * exact string `|>`, so replies that reached version 16 as lost voices now
 * parse. A slice resumed from version 16 was decided by a smaller panel than
 * the same slice would convene now, and a chunk whose critic went unheard is
 * not the same chunk as one whose critic spoke.
 *
 * Version 18 changes the RECORD rather than the text: every stage now emits a
 * `stage-voice-lost` finding naming the models that never answered, including
 * when quorum was met. Findings are read as a whole per entry, so an entry
 * holding version-17 and version-18 slices would under-report voice loss on
 * exactly half of itself while looking complete.
 *
 * Version 19 completes that record in two ways it was still incomplete. One
 * finding is emitted PER MODEL rather than one naming a list, so counting
 * findings counts voices lost rather than gathers that lost at least one. And
 * the selection path carries its findings at all: `selectBestCandidate` built
 * them and every caller discarded them, so a judge going silent left no trace.
 * A version-18 slice under-counts on both.
 *
 * Version 20 finishes the audit that found version 19. The introduced-defect
 * probe emitted findings and BOTH its live callers dropped them, on the
 * accuracy path and in the naturalness lane, which is the one stage where a
 * lost voice is least distinguishable from a clean result. Every producer of
 * findings is now consumed except `derivability-probe.ts`, which is reached
 * only by the recall benchmark and writes into no per-entry artifact.
 *
 * Version 21 widens what the naturalness lane may touch. Eligibility excluded
 * every paragraph containing a newline, which rejected soft source wraps along
 * with authored line breaks; it now excludes only the latter. Measured over the
 * 92 entries at the pinned corpus commit, 811 of 2067 prose paragraphs carry an
 * internal newline and 29 carry a hard break, so a version-20 slice was refined
 * over a small fraction of the prose the lane could have reached. Those cached
 * slices hold text the current lane would have been free to rewrite.
 *
 * Version 22 corrects the line-structure sentence the editor is handed. It
 * opened `This region's CURRENT TEXT IS line-structured`, while the predicate
 * behind it reads the SOURCE, and on the case it exists for the two disagree:
 * `Toka_ls`'s verse chunk is 21 source blocks at median 22 against 18 target
 * blocks at median 101. Version-21 slices were edited under a sentence that
 * asserted something untrue about the text in front of the model and then asked
 * for one output line per INPUT line, which on an already-merged translation
 * asks for the merge to be preserved.
 *
 * Version 23 moves the line-structure decision from the slice to the enclosing
 * CHUNK. Version 22 asked the predicate about each slice, and the predicate
 * needs at least five blocks before it will answer anything but false, so
 * subdivision destroyed the evidence it reads. Measured on the version-22
 * `Toka_ls` run: the verse chunk is line-structured at 21 blocks, median 22,
 * and subdivides into seven slices of which ONE still trips it, while four
 * others sit at medians 20, 22, 23 and 29, inside the verse range, and fail
 * only for want of a fifth block. Version-22 slices therefore carry the
 * corrected sentence on a seventh of the verse it was written for.
 *
 * Version 24 stops the introduced-defect screen discarding over-deletions. A
 * cached slice carries the whole `repairChunk` outcome, probe report included,
 * so version-23 slices hold tallies screened by the old rule. That rule asked
 * whether a claim restated an accepted issue by testing containment BOTH ways,
 * which is right for added wording but wrong for removals: a removal claim
 * quotes what DISAPPEARED, drawn from the same side the critic quoted, on a
 * region that exists because the critic quoted something in it. Dropped wording
 * CONTAINING the prior quote is the over-deletion signal itself, and it was
 * being read as a restatement. Measured: removal-corroborated ran 159 across
 * the original 56-entry run and 0 across every run after the reclassification
 * landed, while corroborated held its per-region rate.
 *
 * Version 25 is behaviour by way of WHO WAS HEARD and WHO DECIDED, on two user
 * decisions of 2026-08-14. The editor and refiner stages no longer wait for
 * their whole roster, so a slice cached under version 24 was settled by a
 * gather that could spend four deadlines recovering a voice this one stops
 * asking for once quorum stands. And selection now seats producers, counting a
 * ballot for the judge's own work at half weight, where version 24 removed them
 * from the roster outright: the same candidates before the same models can
 * reach a different winner. Neither change touches a prompt, which is exactly
 * why the version has to move rather than the structural guard catching it.
 *
 * WHY 2026-08-15 DID NOT MOVE IT, recorded because a version that stays put
 * needs the same account as one that moves, and this history's own rule says
 * bumps have been missed exactly by nobody writing one.
 *
 * Two changes that day moved what `changed` MEANS. `winnerChangedText` stopped
 * reading which candidate won and started reading the text, so a patch whose
 * envelope operations cancel is now recorded as a slice nothing happened in.
 * And the naturalness lane stopped stamping `changed` from the rewriter's
 * verdict, which is measured against the accuracy text, and reads the archive
 * text instead.
 *
 * NEITHER NEEDS A BUMP, for different reasons. Refinement outcomes are never
 * persisted: the cache holds the accuracy outcome, and the lane runs again on
 * every resume. And a version-25 accuracy record written before the first
 * change can only be wrong in ONE direction, since the old rule answered
 * `false` whenever the unchanged candidate won and that candidate carried the
 * archive text: it can claim a change it did not make, never deny one it did.
 * That is exactly the contradiction `sliceRecordAgrees` discards on resume, at
 * a cost of one recomputed slice, and the run says so in its findings. Bumping
 * would throw away every settled slice in the corpus to fix what the discard
 * path already fixes one slice at a time.
 *
 * Version 26 takes the SLICE INDEX out of the key, on 2026-08-15, and this one
 * does discard the corpus: every settled slice was keyed with its index in it.
 * It is spent deliberately and once. Keeping the index meant that renumbering
 * slices invalidated every slice after the change however untouched its text,
 * and `#100` renumbers by design, inserting a slice wherever a section has no
 * translation. Paying it here means that change, and every slicing change after
 * it, costs nothing IN RENUMBERING ALONE: moving a slice boundary, editing
 * either text or changing its governance still misses, because each changes
 * what the stages are asked. What a translator or an editor is asked is the source
 * text, the incumbent, the governance flag and the run shape; where the slice
 * sits is not part of the question, so it is not part of the key.
 *
 * Version 27 follows on 2026-08-15 for a change that touches no prompt and no
 * text: `locateQuote` gained a pass that collapses soft line breaks, so a critic
 * quote copied out of a wrapped paragraph now anchors where it used to be
 * dropped. `critic-wire.ts` discards a claim it cannot anchor, which means the
 * surviving issue set for a slice changed, and with it the patch and the settled
 * text. The key holds the slice texts, the governance flag and the run shape,
 * and all three are identical across the fix: the same key answers differently
 * before and after it, which is precisely what a version is for.
 *
 * IT IS NOT THE ONE-DIRECTION CASE that let version 25 stand. That record could
 * only overclaim a change, and `sliceRecordAgrees` catches an overclaim on
 * resume at the cost of recomputing one slice. This one can differ in either
 * direction and leaves no contradiction behind: a slice settled before the fix
 * with a dropped wrapped quote reads as a clean settlement, indistinguishable
 * from one where the critic found nothing. Nothing downstream can notice, so the
 * version has to.
 *
 * `TRANSLATE_SLICE_CACHE_VERSION` deliberately does NOT move with it. Anchoring
 * reaches the repair lane through `repair-stages.ts` alone; the translate lane
 * never asks a critic to quote anything, so its settled slices still agree with
 * what this code computes.
 *
 * TWO LATER ANCHORING CHANGES ALSO RODE INSIDE 27, checked rather than assumed:
 * no slice-cache file had been written under it when either landed, so there was
 * nothing on disk for them to disagree with. They are the uniqueness rule now
 * judged over the broadest accepted form of a quote, and the lane literal below.
 * Once a run settles a slice under 27, the next behavioural change to anchoring
 * takes 28.
 *
 * THE LANE LITERAL RODE ALONG WITH VERSION 27, which is the whole reason it
 * landed on this day rather than another. `translateSliceKey` has always led
 * with `'translate'` and this key led with nothing, so the isolation between the
 * lanes rested on the store's file-name prefix alone. Folding the literal in
 * changes every key, so it was recorded as waiting for a bump that was happening
 * anyway rather than spending a corpus of its own. Version 27 is that bump, and
 * no run had resumed under it when the literal went in, so it cost nothing
 * beyond what was already spent.
 *
 * VERSION 27 STAYS PUT FOR `#107`'s REPAIR-LANE WINDOW, and this file's own rule
 * is that a version holding still owes the same account as one that moves.
 *
 * The window is folded into the key BELOW rather than ridden on the version,
 * and that is what makes the version unnecessary. A slice that has a neighbour
 * now keys on its window, so it misses whatever it was worth and recomputes,
 * which is correct: the stages are being asked a different question. A slice
 * with NO neighbour, meaning a document of one slice, keys exactly as it did,
 * and resuming it is also correct, because there is no window to have shown it
 * and the question is byte-for-byte the one that was already answered.
 *
 * A VERSION BUMP WOULD BE STRICTLY WORSE HERE, not merely redundant. It would
 * discard every settled slice in the corpus including the lone-slice ones whose
 * question did not change, which is the cost version 26 paid deliberately and
 * once. Folding the evidence into the key spends only the slices whose evidence
 * actually moved.
 *
 * VERSION 28, on 2026-08-20, for the declared-name guard reaching this lane's
 * acceptance. Unlike the window, this is not a question the key can carry: the
 * declarations already ride in the run shape through `identityContext`, so a
 * slice settled before the guard existed keys identically to one settled after
 * and would resume with its refusal never asked. The guard is the reason to
 * spend the corpus, and a guard any cache hit can walk past is not a guard.
 */
export const SLICE_CACHE_VERSION = 28;
/**
 * Everything about a repair run that changes what the models are ASKED, folded
 * into every cache key.
 *
 * Without it a resumed slice could return an outcome produced under a different
 * roster, a different adjudication threshold, or a different editor addendum,
 * and nothing would look wrong: the texts match, so the key matches. That is
 * the failure a version constant cannot catch, because no shape changed.
 * Identity context belongs here for the same reason, since it is
 * front-matter-derived prompt content that varies per document pair.
 *
 * THE PER-CALL DEADLINE IS DELIBERATELY OUT, decided when the two-lane driver
 * began passing one explicitly rather than letting each lane keep its own
 * default. It changes nothing any model is asked; it changes only how long this
 * side waits before giving up on an answer. Folding it in would split the cache
 * on a scheduling knob, so raising the deadline for a slow provider would
 * discard every slice already bought under the old one, and lowering it again
 * would resurrect them.
 *
 * The counter-argument worth stating is that a deadline changes what comes
 * BACK, since a clipped call costs a voice. It does, and a key covering it
 * would still promise something this pipeline never offered: a stage that loses
 * a voice retries to a quorum and then proceeds, so the panel a slice was
 * decided by already varies run to run under a FIXED deadline. What a resumed
 * slice is owed is that the QUESTION was the same, and that is what this states.
 *
 * {@link translateRunShape} reached the same decision for the same reason. The
 * two lanes now agree in writing, which is the point of recording it here: one
 * lane keying on the deadline and the other not would mean a deadline change
 * discarded half a document's cached work and kept the other half.
 *
 * @param models - every role roster this run seats
 *
 * @param adjudicationConfig - thresholds the panel is read under
 *
 * @param identityContext - declared names travelling with every slice
 *
 * @returns Stable string for the key
 *
 * @example
 * ```ts
 * const runShape = repairRunShape({ models, adjudicationConfig, identityContext, },);
 * ```
 */
export function repairRunShape(
  {
    models,
    adjudicationConfig,
    identityContext,
  }: {
    readonly models: RepairModels;
    readonly adjudicationConfig?: AdjudicationConfig;
    readonly identityContext?: string;
  },
): string {
  return JSON.stringify([
    models.criticModelIds,
    models.panelModelIds,
    models.editorModelIds,
    models.judgeModelIds,
    models.refinerModelIds ?? [],
    models.checkerModelIds,
    models.editorRuleAddendum ?? '',
    adjudicationConfig ?? null,
    identityContext ?? '',
  ],);
}

/**
 * Cross-run key for one slice under the repair lane.
 *
 * The schema version, this run's shape and both texts, so a content change, a
 * roster change or an outcome-shape change all miss the cache and recompute.
 *
 * THE SLICE INDEX IS NOT IN IT, since version 26. Where a slice sits is not
 * part of what the stages are asked, and keeping it there meant a renumbering
 * discarded every slice below the change however untouched its text. A resumed
 * record is stamped with the index it was asked under, and the mirror of this
 * reasoning is in `translateSliceKey`, including the corpus measurement that
 * says two slices carrying identical text within one document do not occur.
 *
 * @param runShape - what this run asks, from {@link repairRunShape}
 *
 * @param sourceText - slice original
 *
 * @param targetText - translation already there
 *
 * @param lineStructured - whether the enclosing chunk is line-structured
 *
 * @param neighbouringSourceText - original of the passages either side, shown to
 * the critic, panel and editor as context they may not edit. In the key because
 * a slice judged against its neighbours was asked a different question from the
 * same slice judged alone, and nothing else records which it was
 *
 * @param neighbouringIncumbentText - archive English of those same two, which is
 * the half that shows a relocation
 *
 * @returns Hash keying this slice's outcome
 *
 * @example
 * ```ts
 * const key = repairSliceKey({ runShape, sourceText, targetText, lineStructured, },);
 * ```
 */
export function repairSliceKey(
  {
    runShape,
    sourceText,
    targetText,
    lineStructured,
    neighbouringIncumbentText,
    neighbouringSourceText,
  }: {
    readonly runShape: string;
    readonly sourceText: string;
    readonly targetText: string;
    readonly lineStructured: boolean;
    readonly neighbouringIncumbentText?: string;
    readonly neighbouringSourceText?: string;
  },
): string {
  return hashContent({
    content: JSON.stringify([
      // Mirrors the literal `translateSliceKey` has always led with. The two
      // lanes are already isolated at the STORE, which prefixes translate files
      // and leaves repair files bare, so this is a second mechanism rather than
      // the only one. It exists because two mechanisms that must agree should
      // not be able to drift: a store that ever stopped prefixing would hand one
      // lane's record to the other, and a key that names its lane cannot.
      'repair',
      SLICE_CACHE_VERSION,
      runShape,
      sourceText,
      targetText,
      // Two slices can carry identical text and still be governed differently,
      // because the verdict belongs to the enclosing chunk. It has to sit in
      // the key rather than ride on the version alone.
      lineStructured,
      // ABSENT AND EMPTY KEY ALIKE, and deliberately so, mirroring
      // `translateSliceKey`. A slice with no neighbours has no window to be
      // shown, so it is asked the same question a caller that never had the
      // parameter asked, and it should resume rather than be recomputed to
      // reach the identical answer.
      // LABELLED, because the two sides are otherwise INDISTINGUISHABLE once
      // spread into a positional array: a source-only window and an
      // incumbent-only window carrying the same text would hash identically and
      // one cached answer would serve two different questions. Asymmetric
      // windows are real here, since a neighbour that is an insertion anchor has
      // source text and no target text. `translateSliceKey` never had this
      // because it spreads NAMED properties, and mirroring its shape rather than
      // its effect is what introduced it.
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

//endregion Repair slice key
