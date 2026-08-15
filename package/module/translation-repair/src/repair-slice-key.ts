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
 */
export const SLICE_CACHE_VERSION = 25;
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
 * The schema version, this run's shape, the slice index and both texts, so a
 * slicing change, a content change, a roster change or an outcome-shape change
 * all miss the cache and recompute.
 *
 * @param runShape - what this run asks, from {@link repairRunShape}
 *
 * @param chunkIndex - global slice index
 *
 * @param sourceText - slice original
 *
 * @param targetText - translation already there
 *
 * @param lineStructured - whether the enclosing chunk is line-structured
 *
 * @returns Hash keying this slice's outcome
 *
 * @example
 * ```ts
 * const key = repairSliceKey({ runShape, chunkIndex, sourceText, targetText, lineStructured, },);
 * ```
 */
export function repairSliceKey(
  {
    runShape,
    chunkIndex,
    sourceText,
    targetText,
    lineStructured,
  }: {
    readonly runShape: string;
    readonly chunkIndex: number;
    readonly sourceText: string;
    readonly targetText: string;
    readonly lineStructured: boolean;
  },
): string {
  return hashContent({
    content: JSON.stringify([
      SLICE_CACHE_VERSION,
      runShape,
      chunkIndex,
      sourceText,
      targetText,
      // Two slices can carry identical text and still be governed differently,
      // because the verdict belongs to the enclosing chunk. It has to sit in
      // the key rather than ride on the version alone.
      lineStructured,
    ],),
  },);
}

//endregion Repair slice key
