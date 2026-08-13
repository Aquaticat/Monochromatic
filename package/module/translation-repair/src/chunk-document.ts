import { alignHeadingsForced, } from './align-headings-forced.ts';
import type { DocumentNode, } from './document-node.ts';
import type { RepairDocument, } from './parse-document.ts';

//region Section chunking
// Some documents send thinking models into token-ceiling spirals (run 4,
// live), while section-scale units complete in ~30 s with quality output, so
// sections bound each call's blast radius. Memorial pages open blocks with
// `##` headings on both sides; a chunk is one heading plus every node until
// the next heading, and nodes before the first heading form a preamble
// chunk. Alignment is total and automatic: mirrored structures pair by
// index, and any mismatch degrades to proportional monotone merging
// (Gale-Church style, over cumulative character fractions) so every chunk
// lands in exactly one pair. Mismatches surface as findings, never as
// refusals; the pipeline must handle malformed and mismatched texts on its
// own.

/**
 * One contiguous run of nodes forming a critic-sized unit of work.
 *
 * @example
 * ```ts
 * const chunk: DocumentChunk = {
 *   chunkIndex: 0,
 *   nodes,
 *   startOffset: 0,
 *   endOffset: 120,
 *   text: '## 简介\n\n猫猫喜欢晒太阳。\n',
 * };
 * ```
 */
export type DocumentChunk = {
  /**
   * Position of this chunk within its document, from zero.
   */
  readonly chunkIndex: number;

  /**
   * Nodes of this chunk in source order;
   * every document node belongs to exactly one chunk.
   */
  readonly nodes: readonly DocumentNode[];

  /**
   * Absolute offset of the chunk's first node in the document text.
   */
  readonly startOffset: number;

  /**
   * Absolute exclusive end of the chunk's last node.
   */
  readonly endOffset: number;

  /**
   * Chunk text sliced from the document text;
   * inter-node blank lines within the chunk are preserved.
   */
  readonly text: string;
};

/**
 * One source chunk paired with its translation chunk;
 * either side may span several original sections after automatic merging.
 *
 * @example
 * ```ts
 * const [pair,] = alignDocumentSections({ source, target, },).pairs;
 * ```
 */
export type ChunkPair = {
  /**
   * Original-side chunk.
   */
  readonly source: DocumentChunk;

  /**
   * Translation-side chunk.
   */
  readonly target: DocumentChunk;
};

/**
 * One structural observation from automatic alignment.
 *
 * @example
 * ```ts
 * const finding: AlignmentFinding = {
 *   kind: 'sections-merged',
 *   pairIndex: 2,
 *   detail: 'target sections 2 through 3 merged against source section 2',
 * };
 * ```
 */
export type AlignmentFinding = {
  /**
   * Observation class:
   * whole-document structure mismatch, or one pair built by merging.
   */
  readonly kind: 'structure-mismatch' | 'sections-merged';

  /**
   * Pair the observation attaches to;
   * whole-document observations attach to pair zero.
   */
  readonly pairIndex: number;

  /**
   * Concrete structural description.
   */
  readonly detail: string;
};

/**
 * Total alignment outcome:
 * pairs always cover every chunk on both sides,
 * and findings describe any degradation from mirrored pairing.
 *
 * @example
 * ```ts
 * const { pairs, findings, } = alignDocumentSections({ source, target, },);
 * ```
 */
export type SectionAlignment = {
  /**
   * Monotone chunk pairs in document order;
   * merged sides span several original sections.
   */
  readonly pairs: readonly ChunkPair[];

  /**
   * Degradation observations;
   * empty when both sides mirrored exactly.
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
): readonly DocumentChunk[] {
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
  ): DocumentChunk {
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
 * Merges one consecutive chunk run into a single spanning chunk.
 *
 * @param chunks - consecutive chunks of one document, in order
 *
 * @param documentText - owning document's text for the spanning slice
 *
 * @param chunkIndex - pair index the merged chunk represents
 *
 * @returns Chunk spanning the run's nodes and offsets
 *
 * @example
 * ```ts
 * const merged = mergeChunkRun({ chunks: run, documentText, chunkIndex: 2, },);
 * ```
 */
function mergeChunkRun(
  {
    chunks,
    documentText,
    chunkIndex,
  }: {
    readonly chunks: readonly DocumentChunk[];
    readonly documentText: string;
    readonly chunkIndex: number;
  },
): DocumentChunk {
  /**
   * First chunk of the run, guaranteed by callers.
   */
  const [first,] = chunks;
  /**
   * Last chunk of the run, guaranteed by callers.
   */
  const last = chunks.at(-1,);
  if ((first === undefined) || (last === undefined))
    throw new Error('unreachable: merge runs always carry at least one chunk',);
  return {
    chunkIndex,
    nodes: chunks.flatMap(function toNodes(chunk,) {
      return chunk.nodes;
    },),
    startOffset: first.startOffset,
    endOffset: last.endOffset,
    text: documentText.slice(
      first.startOffset,
      last.endOffset,
    ),
  };
}

/**
 * Sums the text lengths of chunks for proportional pacing.
 *
 * @param chunks - chunks whose lengths accumulate
 *
 * @returns Total characters across the chunks
 *
 * @example
 * ```ts
 * const total = totalChunkChars({ chunks, },);
 * ```
 */
function totalChunkChars(
  { chunks, }: { readonly chunks: readonly DocumentChunk[]; },
): number {
  return chunks.reduce(
    function addLength(
      sum,
      chunk,
    ) {
      return sum
        + chunk.text
        .length;
    },
    0,
  );
}

/**
 * Aligns mismatched chunk lists by proportional monotone merging.
 * The side with fewer chunks frames the pairs;
 * the wider side's chunks merge greedily until their cumulative character
 * fraction catches up with the frame's, while always leaving at least one
 * chunk for every remaining pair.
 * Every chunk on both sides lands in exactly one pair.
 *
 * @param source - parsed original document
 *
 * @param target - parsed translation document
 *
 * @param sourceChunks - original-side chunks, non-empty
 *
 * @param targetChunks - translation-side chunks, non-empty
 *
 * @returns Total alignment with degradation findings
 *
 * @example
 * ```ts
 * const alignment = alignProportionally({ source, target, sourceChunks, targetChunks, },);
 * ```
 */
function alignProportionally(
  {
    source,
    target,
    sourceChunks,
    targetChunks,
  }: {
    readonly source: RepairDocument;
    readonly target: RepairDocument;
    readonly sourceChunks: readonly DocumentChunk[];
    readonly targetChunks: readonly DocumentChunk[];
  },
): SectionAlignment {
  /**
   * Whether the source side frames the pairs (has fewer or equal chunks).
   */
  const sourceIsFrame = sourceChunks.length <= targetChunks.length;

  /**
   * Framing side: one chunk per pair.
   */
  const frame = sourceIsFrame
    ? sourceChunks
    : targetChunks;

  /**
   * Wider side whose chunks merge to keep pace with the frame.
   */
  const wide = sourceIsFrame
    ? targetChunks
    : sourceChunks;

  /**
   * Document text of the wider side for merged spanning slices.
   */
  const wideText = sourceIsFrame
    ? target.text
    : source.text;

  /**
   * Total characters of the framing side.
   */
  const frameTotal = totalChunkChars({ chunks: frame, },);

  /**
   * Total characters of the wider side.
   */
  const wideTotal = totalChunkChars({ chunks: wide, },);

  /**
   * Pairs accumulated in document order.
   */
  const pairs: ChunkPair[] = [];

  /**
   * Findings accumulated alongside, opening with the structure mismatch.
   */
  const findings: AlignmentFinding[] = [{
    kind: 'structure-mismatch',
    pairIndex: 0,
    detail: `section structures differ (source ${String(sourceChunks.length,)} chunks, target ${
      String(targetChunks.length,)
    } chunks); aligned proportionally by character fraction`,
  },];

  /**
   * Characters of the frame consumed so far.
   */
  let frameConsumed = 0;

  /**
   * Characters of the wide side consumed so far.
   */
  let wideConsumed = 0;

  /**
   * Next unconsumed wide chunk.
   */
  let cursor = 0;

  for (const [pairIndex, frameChunk,] of frame.entries()) {
    frameConsumed += frameChunk.text
      .length;

    /**
     * Fraction of the frame consumed through this pair.
     */
    const frameFraction = frameConsumed / frameTotal;

    /**
     * Start of this pair's wide run.
     */
    const runStart = cursor;

    // Every pair takes at least one wide chunk.
    wideConsumed += wide[cursor]
      ?.text
      .length
      ?? 0;
    cursor += 1;
    while (
      // Leave at least one wide chunk for every remaining pair.
      ((wide.length - cursor) > (frame.length - pairIndex
        - 1))
      // Keep merging while behind the frame's fraction;
      // the final pair absorbs everything left.
      && ((pairIndex === (frame.length - 1))
        || ((wideConsumed / wideTotal) < frameFraction))
    ) {
      wideConsumed += wide[cursor]
        ?.text
        .length
        ?? 0;
      cursor += 1;
    }

    /**
     * Wide chunks consumed by this pair.
     */
    const run = wide.slice(
      runStart,
      cursor,
    );

    /**
     * Wide side of the pair, merged when the run spans several sections.
     */
    const wideSide = mergeChunkRun({
      chunks: run,
      documentText: wideText,
      chunkIndex: pairIndex,
    },);

    if (run.length > 1) {
      findings.push({
        kind: 'sections-merged',
        pairIndex,
        detail: `${
          sourceIsFrame
            ? 'target'
            : 'source'
        } sections ${String(runStart,)} through ${String(cursor - 1,)} merged into pair ${
          String(pairIndex,)
        }`,
      },);
    }

    pairs.push(
      sourceIsFrame
        ? {
          source: frameChunk,
          target: wideSide,
        }
        : {
          source: wideSide,
          target: frameChunk,
        },
    );
  }

  /**
   * Total alignment of both sides.
   */
  const alignment: SectionAlignment = {
    pairs,
    findings,
  };
  return alignment;
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
function chunkLabel(chunk: DocumentChunk,): string {
  /**
   * Leading node, which is the heading when the chunk has one.
   */
  const [first,] = chunk.nodes;
  return ((first !== undefined) && (first.kind === 'heading')) ? first.text : '';
}

/**
 * Aligns two parsed documents into critic-sized section pairs, totally and
 * automatically.
 * Mirrored structures (equal chunk counts, matching leading node kinds)
 * pair by index with no findings;
 * everything else degrades to proportional monotone merging with findings.
 * When one side has no content at all, no pairs exist and the finding says
 * so; the pipeline decides what a content-free side means.
 *
 * @param source - parsed original document
 *
 * @param target - parsed translation document
 *
 * @returns Pairs covering every chunk of both sides, plus findings
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
   * Whether both sides mirror exactly:
   * equal counts and matching leading node kinds per index.
   */
  const mirrored = (sourceChunks.length === targetChunks.length)
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

  if (mirrored) {
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
  // section passes through unrepaired and the document still settles with its
  // text, per `doc/decision/translation-repair-always-yields-output.md`.
  // Leaving text alone cannot damage it; a guessed pairing feeds critics the
  // wrong original and the repairs that follow damage text that was correct.
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
        detail: `${step.kind} (${step.reason}); passes through unrepaired`,
      },];
    },),
  };
}

//endregion Section chunking
