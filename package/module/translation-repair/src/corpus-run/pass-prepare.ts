import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import {
  type PairedPreparation,
  prepareDocumentPairWithRoster,
} from '../prepare-with-pairing.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import { lookupCacheDir, } from '../lookup-cache.ts';
import { workTitleLookupLines, } from '../work-title-lookup.ts';
import { EXA_API_KEY_VAR, } from '../work-title-search.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';
import {
  openPairingCache,
  openSectionPairingCache,
} from './slice-cache-store.ts';
import { repairArchiveBlocks, } from './archive-block-repair.ts';
import { archiveBlockSourceContexts, } from './archive-block-source-context.ts';
import { passArchiveText, } from './pass-archive.ts';
import { frontMatterAuthorityOf, } from './archive-front-matter.ts';
import { relabelArchiveFootnotes, } from './pass-footnote-relabel.ts';
import type { PassVisualEvidenceReader, } from './pass-visual-evidence.ts';

//region Pass preparation
// Corpus-specific shell owns pairing cache namespaces and reviews inherited
// blocks outside source claims before any later quality-stage purchase.
//
// LINEAR BY DESIGN: one preparation, at most one relabel of the archive's
// footnote labels to the original's with its re-preparation, at most one
// archive correction round, one re-preparation over the corrected archive.
// Each re-preparation is the structural consequence of having edited the
// archive, not a rejection-driven re-ask; blocks still unclaimed after the
// last become findings (doc/planning/translation-repair-no-loop-design.md).

/**
 * The clock a lookup record is stamped with.
 *
 * @returns Now
 *
 * @example
 * ```ts
 * const stamped = wallClock().toISOString();
 * ```
 */
function wallClock(): Date {
  return new Date();
}

/**
 * Prepares one pass entry with cached roster pairing and publication safety.
 *
 * @param client - shared provider client
 *
 * @param entryId - corpus entry being settled
 *
 * @param entryCacheDir - entry cache root
 *
 * @param pipelineDigest - cache generation
 *
 * @param modelIds - pairing roster
 *
 * @param sourceText - source page
 *
 * @param targetText - archive page
 *
 * @param signal - entry deadline
 *
 * @param exchangeTimeoutMs - per-call ceiling
 *
 * @param l - entry logger
 *
 * @param readPictures - shared entry reader supplying picture support before archive review
 *
 * @returns Prepared slices and pairing findings
 *
 * @example
 * ```ts
 * const paired = await preparePassEntry({ client, entryId, entryCacheDir, pipelineDigest, modelIds, sourceText, targetText, signal, exchangeTimeoutMs, l, });
 * ```
 */
export async function preparePassEntry(
  {
    client,
    entryId,
    entryCacheDir,
    pipelineDigest,
    modelIds,
    sourceText,
    targetText,
    signal,
    exchangeTimeoutMs,
    l,
    readPictures,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly entryId: string;
    readonly entryCacheDir: string;
    readonly pipelineDigest: PipelineDigest;
    readonly modelIds: readonly RosterModelId[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly l: Logger;
    readonly readPictures?: PassVisualEvidenceReader;
  }>,
): Promise<PairedPreparation> {
  l.debug(`${preparePassEntry.name}: preparing entry ${entryId}`,);
  /**
   * Archive bytes both deciders judge, normalized before preparation so
   * spans, candidates, artifact and published page all describe the same
   * visible text (`pass-archive.ts`).
   */
  const archiveText = passArchiveText({
    text: targetText,
    l,
  },);
  /**
   * Whose front matter the page carries, decided on the archive as inherited
   * and shared by both preparations, since the block correction round never
   * touches metadata.
   */
  const frontMatterAuthority = frontMatterAuthorityOf({
    entryId,
    sourceText,
    archiveText,
  },);
  l.info(
    `FRONT MATTER entry=${entryId} authority=${frontMatterAuthority}: ${
      (frontMatterAuthority === 'archive')
        ? 'the archive translated it, so it ships as it stands and no lane writes it'
        : 'the archive never translated it, so the lanes render slice zero'
    }`,
  );
  /**
   * Cache for block-pairing rounds across revised archive preparations.
   */
  const pairingCache = await openPairingCache({
    dir: entryCacheDir,
    generation: pipelineDigest,
  },);
  /**
   * Cache for section-pairing rounds across revised archive preparations.
   */
  const sectionCache = await openSectionPairingCache({
    dir: entryCacheDir,
    generation: pipelineDigest,
  },);
  /**
   * Web-lookup evidence for the works the original names, bought once per
   * title and cached durably (the owner's rule of 2026-09-02), the same lines
   * for both preparations so a corrected archive does not change what the
   * sheets are told about a title.
   */
  const contextLines = await workTitleLookupLines({
    sourceText,
    apiKey: process.env[EXA_API_KEY_VAR] ?? '',
    dir: lookupCacheDir({ env: process.env, },),
    signal,
    fetchFn: fetch,
    now: wallClock,
    logger: l,
  },);
  /**
   * Preparation over one archive text, the same roster, caches, context and
   * authority each time: once over the archive as inherited, once more where
   * the relabel rewrote it, and once more where the block correction round
   * did.
   *
   * @param targetText - archive text to prepare over
   *
   * @returns Prepared slices and pairing findings
   *
   * @example
   * ```ts
   * const paired = await prepareOver({ targetText: archiveText, },);
   * ```
   */
  function prepareOver(
    { targetText: over, }: { readonly targetText: string; },
  ): Promise<PairedPreparation> {
    return prepareDocumentPairWithRoster({
      client,
      modelIds,
      pairingCache,
      sectionCache,
      sourceText,
      targetText: over,
      signal,
      exchangeTimeoutMs,
      l,
      contextLines,
      frontMatterAuthority,
      sealArchiveOriginal: true,
    },);
  }
  /**
   * Preparation over the archive as inherited.
   */
  const firstPaired = await prepareOver({ targetText: archiveText, },);
  /**
   * The archive under the original's footnote labels, read off the first
   * preparation's slices (the nineteenth class, 2026-09-08).
   */
  const relabel = relabelArchiveFootnotes({
    entryId,
    slices: firstPaired.prepared
      .slices,
    definitionPairs: firstPaired.footnoteDefinitionPairs,
    sourceText,
    archiveText,
    l,
  },);
  /**
   * Preparation the block correction round starts from: over the relabelled
   * archive where the relabel changed it, since the labels moved the offsets.
   */
  const labelled = relabel.changed
    ? await prepareOver({ targetText: relabel.archiveText, },)
    : firstPaired;
  /**
   * Findings so far: the preparation's and the relabel's.
   */
  const labelledFindings = [
    ...labelled.findings,
    ...relabel.findings,
  ];
  /**
   * Spans the archive's translators' note sealed as the English original,
   * which no slice covers and no lane writes (the owner's rule of 2026-09-08).
   */
  const sealedSpans = labelled.prepared
    .archiveOriginalSpans
    ?? [];
  for (const [at, span,] of sealedSpans.entries()) {
    l.info(
      `ARCHIVE ORIGINAL entry=${entryId} span=${String(at,)} [${String(span.startOffset,)}, ${
        String(span.endOffset,)
      }) of the archive ships as it stands under the note: ${span.note}`,
    );
  }
  /**
   * Unclaimed blocks not already licensed unchanged.
   */
  const pending = labelled.prepared
    .unclaimedTargetBlocks;
  if (pending.length === 0) {
    return {
      prepared: labelled.prepared,
      footnoteDefinitionPairs: labelled.footnoteDefinitionPairs,
      findings: labelledFindings,
    };
  }
  /**
   * Picture evidence precedes any verdict that could remove its archive translation.
   */
  const pictureReadings = await readPictures?.({ slices: labelled.prepared
    .slices, },);
  /**
   * Selected corrections and retained licenses from the single review round.
   */
  const repaired = await repairArchiveBlocks({
    client,
    modelIds,
    targetText: relabel.archiveText,
    sourceContexts: archiveBlockSourceContexts({
      prepared: labelled.prepared,
      ...((pictureReadings === undefined) ? {} : { pictureReadings, }),
    },),
    blocks: pending,
    signal,
    exchangeTimeoutMs,
    l,
  },);
  if (repaired.targetText === relabel.archiveText) {
    return {
      prepared: labelled.prepared,
      footnoteDefinitionPairs: labelled.footnoteDefinitionPairs,
      findings: [
        ...labelledFindings,
        ...repaired.findings,
      ],
    };
  }
  /**
   * Re-preparation over the corrected archive, whose offsets the correction moved.
   */
  const secondPaired = await prepareOver({ targetText: repaired.targetText, },);
  /**
   * Blocks the single correction round could not claim.
   */
  const remaining = secondPaired.prepared
    .unclaimedTargetBlocks;
  return {
    prepared: secondPaired.prepared,
    footnoteDefinitionPairs: secondPaired.footnoteDefinitionPairs,
    findings: [
      ...secondPaired.findings,
      ...relabel.findings,
      ...repaired.findings,
      ...(remaining.length === 0
        ? []
        : [`unclaimed archive blocks remain after the single correction round: ${String(remaining.length,)}`,]),
    ],
  };
}

//endregion Pass preparation
