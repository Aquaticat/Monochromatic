import { alignHeadingsForced, } from './align-headings-forced.ts';
import type {
  ContentChunk,
  DocumentChunk,
} from './chunk-placement.ts';
import type { DocumentNode, } from './document-node.ts';
import type { RepairDocument, } from './parse-document.ts';

//region Section chunking
// Some documents send thinking models into token-ceiling spirals (run 4,
// live), while section-scale units complete in ~30 s with quality output, so
// sections bound each call's blast radius. Memorial pages open blocks with
// `##` headings on both sides; a chunk is one heading plus every node until
// the next heading, and nodes before the first heading form a preamble
// chunk. Alignment is automatic and PARTIAL: sides of equal shape pair by
// index, and anything else goes to the forced heading aligner, which pairs
// what the headings support and REFUSES the rest. A refused section has no
// pair, and is named in a finding.
//
// IT USED TO BE TOTAL, by degrading to proportional monotone merging over
// cumulative character fractions, and that is exactly why it is not any
// more: merging produced a confident WRONG pairing that slid a whole
// document by two sections, so every critic call read the wrong original and
// every issue filed on that entry was noise. Leaving a section unpaired
// cannot damage it; guessing its pair damages text that was correct.

// Re-exported rather than defined here, so every consumer that already reads a
// chunk from this file keeps its import while the shapes themselves live in
// `chunk-placement.ts`. A contiguous run of nodes is what this file BUILDS; a
// place where nodes are missing is not, and that distinction is the whole
// reason the two kinds are declared apart from the carving that produces one
// of them.
export {
  type ContentChunk,
  type DocumentChunk,
  type InsertionChunk,
  isInsertionChunk,
  makeInsertionChunk,
} from './chunk-placement.ts';

/**
 * One source chunk paired with its translation chunk.
 *
 * Each side is exactly one chunk. Merging several sections into one side was
 * the proportional fallback's doing, and that fallback is gone.
 *
 * @example
 * ```ts
 * const [pair,] = alignDocumentSections({ source, target, },).pairs;
 * ```
 */
export type ChunkPair = {
  /**
   * Original-side chunk, which is always existing text: a pair exists
   * because a source section exists.
   */
  readonly source: ContentChunk;

  /**
   * Translation-side chunk, which is content when this section is
   * translated and an insertion anchor when it is not.
   */
  readonly target: DocumentChunk;
};

/**
 * One structural observation from automatic alignment.
 *
 * @example
 * ```ts
 * const finding: AlignmentFinding = {
 *   kind: 'structure-mismatch',
 *   pairIndex: 2,
 *   detail: 'source-only (no target heading scored above the floor); has no translation to repair',
 * };
 * ```
 */
export type AlignmentFinding = {
  /**
   * Observation class, and there is one: the sides do not correspond.
   *
   * A `sections-merged` kind existed while the proportional fallback did, and
   * went with it. Artifacts settled before 2026-08-15 carry the string in their
   * findings, which is prose to every reader here; nothing in this package
   * matches on it.
   */
  readonly kind: 'structure-mismatch';

  /**
   * Index the observation attaches to, WHICH IS NOT ALWAYS A PAIR INDEX.
   *
   * Whole-document observations use zero. A refusal uses the index of the
   * unpaired chunk on its OWN side, which is the only index it has, and that
   * side's numbering need not line up with the pairs a run produced. The name
   * is kept for now because the scorecard renders it into a finding string that
   * 56 settled artifacts share, so renaming it is a comparability change rather
   * than a rename. It moves with `#99`, where what an index means is settled.
   */
  readonly pairIndex: number;

  /**
   * Concrete structural description.
   */
  readonly detail: string;
};

/**
 * PARTIAL alignment outcome: the pairs the aligner committed to, and what it
 * refused.
 *
 * NOT A COVER. A refused chunk appears in no pair, on either side, which is the
 * whole point of refusing it. A consumer counting coverage has to compare the
 * pairs against the chunk counts rather than assume them equal.
 *
 * @example
 * ```ts
 * const { pairs, findings, } = alignDocumentSections({ source, target, },);
 * ```
 */
export type SectionAlignment = {
  /**
   * Monotone chunk pairs in document order, one chunk per side.
   */
  readonly pairs: readonly ChunkPair[];

  /**
   * Sections the aligner refused, and whole-document observations.
   *
   * EMPTY DOES NOT MEAN VERIFIED. Two sides of equal shape pair by index
   * without the aligner being consulted at all, so a document that dropped one
   * section and gained an unrelated one later has equal counts, pairs straight
   * through, and reports nothing. `#98` holds that, and it waits on an aligner
   * that can score headings across languages: today, refusing those pairings
   * would discard real repair coverage to catch a case nothing can detect.
   */
  readonly findings: readonly AlignmentFinding[];
};

/**
 * Splits a parsed document into heading-bounded chunks.
 * Each `heading` node starts a fresh chunk;
 * nodes before the first heading form a preamble chunk.
 *
 * @param document - parsed document whose nodes carry absolute offsets
 *
 * @returns Chunks partitioning the document's nodes in order
 *
 * @example
 * ```ts
 * const chunks = chunkByHeadings({ document: parseDocument({ text, },), },);
 * ```
 */
export function chunkByHeadings(
  { document, }: { readonly document: RepairDocument; },
): readonly ContentChunk[] {
  /**
   * Node groups partitioned at heading boundaries;
   * built by appending in one pass so grouping stays linear.
   */
  const groups: DocumentNode[][] = [];
  for (const node of document.nodes) {
    /**
     * Currently open group, when any nodes were grouped already.
     */
    const open = groups.at(-1,);
    if ((node.kind === 'heading') || (open === undefined)) {
      groups.push([node,],);
      continue;
    }
    open.push(node,);
  }

  return groups.map(function toChunk(
    nodes: readonly DocumentNode[],
    chunkIndex,
  ): ContentChunk {
    /**
     * First node of the group, guaranteed by construction.
     */
    const [first,] = nodes;
    /**
     * Last node of the group, guaranteed by construction.
     */
    const last = nodes.at(-1,);
    if ((first === undefined) || (last === undefined))
      throw new Error('unreachable: every chunk group carries at least one node',);
    return {
      chunkIndex,
      nodes,
      startOffset: first.startOffset,
      endOffset: last.endOffset,
      text: document.text
        .slice(
        first.startOffset,
        last.endOffset,
      ),
    };
  },);
}

/**
 * Reads the label the aligner reasons over for one chunk.
 *
 * A heading chunk carries its heading text; a preamble chunk carries an EMPTY
 * label. Building units this way makes UNIT INDEX EQUAL CHUNK INDEX by
 * construction, since `chunkByHeadings` emits the preamble as chunk 0 and then
 * one chunk per heading. No offset arithmetic remains to get wrong, and offset
 * arithmetic is what an earlier adapter got wrong.
 *
 * @param chunk - chunk to label
 *
 * @returns Heading text, or empty for a preamble
 *
 * @example
 * ```ts
 * const label = chunkLabel(chunk,);
 * ```
 */
function chunkLabel(chunk: ContentChunk,): string {
  /**
   * Leading node, which is the heading when the chunk has one.
   */
  const [first,] = chunk.nodes;
  return ((first !== undefined) && (first.kind === 'heading')) ? first.text : '';
}

/**
 * Aligns two parsed documents into critic-sized section pairs, automatically
 * and PARTIALLY.
 *
 * TWO PATHS. Sides of equal shape, meaning equal chunk counts with matching
 * leading node kinds, pair by index and report nothing. Everything else goes to
 * the forced heading aligner, and only what it pairs becomes a pair: a section
 * it refuses is named in a finding and has no pair at all. When one side has no
 * content, there are no pairs and the finding says so; the pipeline decides
 * what a content-free side means.
 *
 * WHAT EQUAL SHAPE DOES NOT PROVE. For a document of ordinary heading sections
 * every leading kind is `heading`, so that half of the test holds by
 * construction and the path reduces to "the counts match". A document that
 * dropped one section and gained an unrelated one later has matching counts and
 * pairs straight through with no finding. `#98` holds it; it waits on heading
 * scoring that works across languages, since refusing every equal-count pairing
 * would discard real repair coverage to catch a case nothing here can detect.
 *
 * @param source - parsed original document
 *
 * @param target - parsed translation document
 *
 * @returns Pairs the aligner committed to, plus what it refused
 *
 * @example
 * ```ts
 * const { pairs, findings, } = alignDocumentSections({
 *   source: parseDocument({ text: zh, },),
 *   target: parseDocument({ text: en, },),
 * },);
 * ```
 */
export function alignDocumentSections(
  {
    source,
    target,
  }: {
    readonly source: RepairDocument;
    readonly target: RepairDocument;
  },
): SectionAlignment {
  /**
   * Original-side chunks.
   */
  const sourceChunks = chunkByHeadings({ document: source, },);

  /**
   * Translation-side chunks.
   */
  const targetChunks = chunkByHeadings({ document: target, },);

  if ((sourceChunks.length === 0) || (targetChunks.length === 0)) {
    if ((sourceChunks.length === 0) && (targetChunks.length === 0)) {
      return {
        pairs: [],
        findings: [],
      };
    }
    return {
      pairs: [],
      findings: [{
        kind: 'structure-mismatch',
        pairIndex: 0,
        detail: `one side has no content: source ${String(sourceChunks.length,)} chunks, target ${
          String(targetChunks.length,)
        } chunks`,
      },],
    };
  }

  /**
   * Whether both sides have equal SHAPE: equal counts, and matching leading
   * node kinds per index.
   *
   * Not "mirrored", which is what this was called and what it cannot check. It
   * says nothing about whether section 3 on one side is section 3 on the other.
   */
  const equalShape = (sourceChunks.length === targetChunks.length)
    && sourceChunks.every(function leadingKindMatches(
      chunk,
      index,
    ) {
      return chunk.nodes[0]
        ?.kind
        === targetChunks[index]
        ?.nodes[0]
        ?.kind;
    },);

  if (equalShape) {
    return {
      pairs: sourceChunks.map(function toPair(
        sourceChunk,
        index,
      ): ChunkPair {
        /**
         * Target chunk at the same index, present by the count check.
         */
        const targetChunk = targetChunks[index];
        if (targetChunk === undefined)
          throw new Error('unreachable: counts were checked equal',);
        return {
          source: sourceChunk,
          target: targetChunk,
        };
      },),
      findings: [],
    };
  }

  /**
   * Pairings the aligner commits to, plus its refusals.
   */
  const steps = alignHeadingsForced({
    sourceHeadings: sourceChunks.map(chunkLabel,),
    targetHeadings: targetChunks.map(chunkLabel,),
  },);

  // ONLY forced pairings become pairs, and a refusal is never a block. The
  // document still settles with its own text, per
  // `doc/decision/translation-repair-always-yields-output.md`. Leaving text
  // alone cannot damage it; a guessed pairing feeds critics the wrong original
  // and the repairs that follow damage text that was correct.
  //
  // THE TWO REFUSALS ARE NOT THE SAME EVENT, and the detail says which. A
  // target-only section is English nobody will look at, so it passes through
  // unrepaired. A source-only section is Chinese with NO English to pass
  // through: the translation is missing that section entirely, and this lane
  // repairs rather than writes, so there is nothing here to do about it.
  return {
    pairs: steps.flatMap(function toPair(step,): readonly ChunkPair[] {
      if (step.kind !== 'paired')
        return [];

      /**
       * Original-side chunk of this pair.
       */
      const sourceChunk = sourceChunks[step.sourceIndex];

      /**
       * Translation-side chunk of this pair.
       */
      const targetChunk = targetChunks[step.targetIndex];
      if ((sourceChunk === undefined) || (targetChunk === undefined))
        throw new Error('unreachable: the aligner paired an index outside its own input',);

      return [{
        source: sourceChunk,
        target: targetChunk,
      },];
    },),
    findings: steps.flatMap(function toFinding(step,): readonly AlignmentFinding[] {
      if (step.kind === 'paired')
        return [];

      return [{
        kind: 'structure-mismatch',
        pairIndex: (step.kind === 'source-only') ? step.sourceIndex : step.targetIndex,
        detail: `${step.kind} (${step.reason}); ${
          (step.kind === 'source-only') ? 'has no translation to repair' : 'passes through unrepaired'
        }`,
      },];
    },),
  };
}

//endregion Section chunking
