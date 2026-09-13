import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import { archiveOriginalReadingOf, } from './archive-original-note.ts';
import { alignDocumentSections, type ChunkPair, } from './chunk-document.ts';
import type { CorpusPin, } from './corpus-source.ts';
import { passArchiveWithOrigins, } from './corpus-run/pass-archive.ts';
import { hashContent, } from './document-node.ts';
import { parseDocument, type RepairDocument, } from './parse-document.ts';
import { readPreparationRootCorpusPair, } from './preparation-root-corpus-read.ts';
import { preparationRootParent, } from './preparation-root-parent.ts';
import type { PreparationRootEntry, PreparationRootParent, PreparationRootRawDocument, } from './preparation-root-population-model.ts';
import type { PreparationRootExclusion, } from './preparation-root-reference-model.ts';

//region Native policy eligibility before frozen-parent lookup

/**
 * Eligibility outcomes are domain states; unexpected read failures throw instead of becoming exclusions.
 *
 * @example
 * ```ts
 * const current = await readPreparationRootEntry({ pin, entryId, l });
 * ```
 */
export type PreparationRootEntryRead = {
  /** Existing missing-object or whole-page-original policy declined this entry. */
  readonly kind: 'excluded';
  /** Exact current exclusion compared with frozen population evidence. */
  readonly exclusion: PreparationRootExclusion;
  /** Successfully read sides still retain raw-byte provenance. */
  readonly rawDocuments: readonly PreparationRootRawDocument[];
} | {
  /** Native policy permits population accounting, not writer or acquisition admission. */
  readonly kind: 'eligible';
  /** Serializable current entry provenance. */
  readonly entry: PreparationRootEntry;
  /** Exact historical parent representation, before any frozen selection lookup. */
  readonly parents: readonly PreparationRootParent[];
  /** Transient current parse used only by the owning collector. */
  readonly source: RepairDocument;
  /** Transient normalized parse, never an earlier archive coordinate system. */
  readonly target: RepairDocument;
  /** Native deterministic alignment, without model-backed section correspondence. */
  readonly pairs: readonly ChunkPair[];
  /** Raw and effective identities remain separate from parent-local hashes. */
  readonly rawDocuments: readonly PreparationRootRawDocument[];
};

/**
 * Reconstructs exactly the production original-English policy and native parent population for one entry.
 * No size/shape filter, archive-prose repair, provider or replacement sampler is introduced.
 *
 * @param pin - independent already-resolved corpus pin
 *
 * @param entryId - checked current corpus entry component
 *
 * @param l - caller logger retaining root scope
 *
 * @returns Current eligible parent inventory or explicit policy exclusion
 *
 * @throws PreparationRootError when pinned bytes cannot be read for reasons other than absence
 *
 * @example
 * ```ts
 * const current = await readPreparationRootEntry({ pin, entryId, l });
 * ```
 */
export async function readPreparationRootEntry({ pin, entryId, l, }: {
  readonly pin: CorpusPin;
  readonly entryId: string;
  readonly l: Logger;
},): Promise<PreparationRootEntryRead> {
  /** Each entry remains attributable without logging its source text. */
  const pl = tagged({ tag: readPreparationRootEntry.name, l, },);
  /** Raw object reads distinguish corpus absence from infrastructure failure. */
  const read = await readPreparationRootCorpusPair({ pin, entryId, l: pl, },);
  if (read.kind === 'missing')
    return { kind: 'excluded', exclusion: { entryId, kind: 'missing-corpus-side', }, rawDocuments: read.rawDocuments, };
  /** Source and archive identities are retained before any eligibility branch returns. */
  const rawDocuments = [read.source.identity, read.archive.identity,];
  /** The raw archive declaration has precedence over normalized placement. */
  const inherited = archiveOriginalReadingOf({ document: parseDocument({ text: read.archive.text, },), },);
  if (inherited.kind === 'whole-page') {
    pl.info(`excluding whole-page archive original before normalization: ${JSON.stringify(entryId,)}`,);
    return { kind: 'excluded', exclusion: { entryId, kind: 'production-whole-page-original', archiveHash: read.archive.identity.effectiveHash,
      noteHash: hashContent({ content: inherited.note, },), }, rawDocuments, };
  }
  /** Shared pass normalization owns invisible variants, stubs and retained pinned-line origins. */
  const archive = passArchiveWithOrigins({ text: read.archive.text, l: pl, },);
  /** Current normalized archive coordinates are rebuilt before any parent identity is read. */
  const target = parseDocument({ text: archive.text, },);
  /** Normalized original-English declarations retain their independent eligibility role. */
  const normalized = archiveOriginalReadingOf({ document: target, },);
  if (normalized.kind === 'whole-page') {
    pl.info(`excluding normalized whole-page archive original: ${JSON.stringify(entryId,)}`,);
    return { kind: 'excluded', exclusion: { entryId, kind: 'normalized-whole-page-original', archiveHash: read.archive.identity.effectiveHash,
      targetHash: target.documentHash, noteHash: hashContent({ content: normalized.note, },), }, rawDocuments, };
  }
  /** Original coordinates always come from the complete current source. */
  const source = parseDocument({ text: read.source.text, },);
  /** Parent construction uses only the native deterministic section path. */
  const alignment = alignDocumentSections({ source, target, },);
  /** Protected spans annotate the population rather than filtering ordinary correction tasks. */
  const spans = normalized.kind === 'spans' ? normalized.spans : [];
  /** The exact legacy parent shape makes population and selected-pool comparisons independent of caller tables. */
  const parents = alignment.pairs.map(function parent(pair, pairIndex,): PreparationRootParent {
    return preparationRootParent({ entryId, pairIndex, pair, spans, },);
  },);
  pl.info(`reconstructed ${String(parents.length,)} deterministic parents for ${JSON.stringify(entryId,)} without call authority`,);
  return { kind: 'eligible', rawDocuments, source, target, pairs: alignment.pairs, parents,
    entry: { entryId, sourceText: read.source.text, archiveText: read.archive.text, targetText: archive.text,
      sourceHash: source.documentHash, archiveHash: read.archive.identity.effectiveHash, targetHash: target.documentHash,
      originalPolicy: { inherited: inherited.kind, normalized: normalized.kind, spans, }, archiveLines: archive.lines,
      sourceFindings: source.parseFindings, targetFindings: target.parseFindings, alignmentFindings: alignment.findings, }, };
}

//endregion Native policy eligibility before frozen-parent lookup
