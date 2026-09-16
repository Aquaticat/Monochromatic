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
import { citedReferenceBlock, } from '../cited-reference-lookup.ts';
import { attestCitedReferences, } from '../reference-attest-stage.ts';
import { referenceCacheDir, } from '../reference-cache.ts';
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
import type { PairedReading, } from '../image-reading-pair.ts';
import { photoReferences, } from '../photo-reference.ts';
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
 The clock a lookup record is stamped with.
 
 @returns Now
 
 @example
 ```ts
 const stamped = wallClock().toISOString();
 ```
 */
function wallClock(): Date {
  return new Date();
}

/**
 Prepares one pass entry with cached roster pairing and publication safety.
 
 @param client - shared provider client
 
 @param entryId - corpus entry being settled
 
 @param entryCacheDir - entry cache root
 
 @param pipelineDigest - cache generation
 
 @param modelIds - pairing roster
 
 @param sourceText - source page
 
 @param targetText - archive page
 
 @param signal - entry deadline
 
 @param exchangeTimeoutMs - per-call ceiling
 
 @param l - entry logger
 
 @param readPictures - shared entry reader supplying picture support before archive review
 
 @returns Prepared slices and pairing findings
 
 @example
 ```ts
 const paired = await preparePassEntry({ client, entryId, entryCacheDir, pipelineDigest, modelIds, sourceText, targetText, signal, exchangeTimeoutMs, l, });
 ```
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
   Archive bytes both deciders judge, normalized before preparation so
   spans, candidates, artifact and published page all describe the same
   visible text (`pass-archive.ts`).
   */
  const archiveText = passArchiveText({
    text: targetText,
    l,
  },);
  /**
   Whose front matter the page carries, decided on the archive as inherited
   and shared by both preparations, since the block correction round never
   touches metadata.
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
   Cache for block-pairing rounds across revised archive preparations.
   */
  const pairingCache = await openPairingCache({
    dir: entryCacheDir,
    generation: pipelineDigest,
  },);
  /**
   Cache for section-pairing rounds across revised archive preparations.
   */
  const sectionCache = await openSectionPairingCache({
    dir: entryCacheDir,
    generation: pipelineDigest,
  },);
  /**
   Web-lookup evidence for the works the original names, bought once per
   title and cached durably (the owner's rule of 2026-09-02), the same lines
   for both preparations so a corrected archive does not change what the
   sheets are told about a title.
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
   What the pages the original links say (class thirty-five, the owner's
   decision of 2026-09-16), bought once per page and cached durably, the
   same block for both preparations; the critic and panel sheets read it so
   a detail the archive took from a cited reference is not deleted as an
   addition.
   */
  const referenceLines = await citedReferenceBlock({
    sourceText,
    apiKey: process.env[EXA_API_KEY_VAR] ?? '',
    dir: referenceCacheDir({ env: process.env, },),
    signal,
    fetchFn: fetch,
    now: wallClock,
    logger: l,
  },);
  /**
   Archive details a reference states, attested by the bench with quotes
   checked word for word (class thirty-seven, 2026-09-16): the repair lane
   screens addition claims against them before the panel, and every sheet
   reads them as ATTESTED lines under the references. Nothing is asked when
   the original links nowhere.
   */
  const attestation = (referenceLines === '')
    ? {
      details: [],
      lines: [],
      findings: [],
    }
    : await attestCitedReferences({
      client,
      modelIds,
      sourceText,
      archiveText,
      referenceContext: referenceLines,
      signal,
      exchangeTimeoutMs,
      l,
    },);
  /**
   Reference lines with the attested lines under them.
   */
  const referenceContext = [
    referenceLines,
    ...attestation.lines,
  ]
    .filter(function isLine(line,): boolean {
      return line !== '';
    },)
    .join('\n',);
  /**
   Preparation over one archive text, the same roster, caches, context and
   authority each time: once over the archive as inherited, once more where
   the relabel rewrote it, and once more where the block correction round
   did.
   
   @param targetText - archive text to prepare over
   
   @param pictureReadings - what reading produced per picture, once they are
   read, so the pairing sheets see them (class thirty-four)
   
   @returns Prepared slices and pairing findings
   
   @example
   ```ts
   const paired = await prepareOver({ targetText: archiveText, },);
   ```
   */
  function prepareOver(
    {
      targetText: over,
      pictureReadings,
    }: {
      readonly targetText: string;
      readonly pictureReadings?: ReadonlyMap<string, PairedReading>;
    },
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
      ...((referenceContext === '') ? {} : { referenceContext, }),
      ...((attestation.details
        .length
        === 0) ? {} : { attestedDetails: attestation.details, }),
      frontMatterAuthority,
      sealArchiveOriginal: true,
      ...((pictureReadings === undefined) ? {} : { pictureReadings, }),
    },);
  }
  /**
   Preparation over the archive as inherited.
   */
  const firstPaired = await prepareOver({ targetText: archiveText, },);
  /**
   The archive under the original's footnote labels, read off the first
   preparation's slices (the nineteenth class, 2026-09-08).
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
   Preparation the block correction round starts from: over the relabelled
   archive where the relabel changed it, since the labels moved the offsets.
   */
  const labelled = relabel.changed
    ? await prepareOver({ targetText: relabel.archiveText, },)
    : firstPaired;
  /**
   Spans the archive's translators' note sealed as the English original,
   which no slice covers and no lane writes (the owner's rule of 2026-09-08).
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
   Picture evidence precedes the pairing that decides which archive blocks are
   unclaimed, and so precedes any verdict that could remove a picture's
   translation: read off the labelled slices, which name every picture. A
   source naming no picture reads nothing and seats nobody for it.
   Pictures the source names, in document order.
   */
  const pictureNames = photoReferences({ text: sourceText, },);
  /**
   What reading produced per picture, absent for a source naming none.
   */
  const pictureReadings = (pictureNames.length === 0)
    ? undefined
    : await readPictures?.({ slices: labelled.prepared
      .slices, },);
  /**
   Readings worth showing a sheet, absent when nothing was read.
   */
  const sighted = ((pictureReadings === undefined) || (pictureReadings.size === 0))
    ? {}
    : { pictureReadings, };
  /**
   Preparation the block correction round starts from: over the same archive,
   paired again with the pictures in the sheets where there are any (class
   thirty-four, 2026-09-16), since a pairing bought blind sets an archive
   block translating a picture against the original block standing where the
   picture stands, and that block then never reaches the review as unclaimed.
   */
  const sightedPaired = ('pictureReadings' in sighted)
    ? await prepareOver({
      targetText: relabel.archiveText,
      ...sighted,
    },)
    : labelled;
  /**
   Findings so far: the preparation's and the relabel's.
   */
  const sightedFindings = [
    ...sightedPaired.findings,
    ...relabel.findings,
    ...attestation.findings,
  ];
  /**
   Unclaimed blocks not already licensed unchanged.
   */
  const pending = sightedPaired.prepared
    .unclaimedTargetBlocks;
  if (pending.length === 0) {
    return {
      prepared: sightedPaired.prepared,
      footnoteDefinitionPairs: sightedPaired.footnoteDefinitionPairs,
      findings: sightedFindings,
    };
  }
  /**
   Selected corrections and retained licenses from the single review round.
   */
  const repaired = await repairArchiveBlocks({
    client,
    modelIds,
    targetText: relabel.archiveText,
    sourceContexts: archiveBlockSourceContexts({
      prepared: sightedPaired.prepared,
      ...sighted,
    },),
    blocks: pending,
    signal,
    exchangeTimeoutMs,
    l,
  },);
  if (repaired.targetText === relabel.archiveText) {
    return {
      prepared: sightedPaired.prepared,
      footnoteDefinitionPairs: sightedPaired.footnoteDefinitionPairs,
      findings: [
        ...sightedFindings,
        ...repaired.findings,
      ],
    };
  }
  /**
   Re-preparation over the corrected archive, whose offsets the correction
   moved, with the same pictures in the sheets.
   */
  const secondPaired = await prepareOver({
    targetText: repaired.targetText,
    ...sighted,
  },);
  /**
   Blocks the single correction round could not claim.
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
