import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { RootContent, } from 'mdast';

import { normalizeFootnoteIdentifier, } from './footnote-identifier.ts';
import type {
  FootnoteConvention,
  FootnoteDefinitionHit,
  FootnoteGraph,
  FootnoteGraphFinding,
  FootnoteReferenceHit,
} from './footnote-model.ts';

//region Text marker scanning
// 〔N〕 markers are plain text, not markdown syntax, so they are found by scanning
// source slices of text nodes. Scanning source (not decoded mdast values) keeps
// offsets faithful when values and source diverge through escapes.

/**
 * Opening bracket of archive-convention footnote markers.
 */
const FULLWIDTH_OPEN = '〔';

/**
 * Closing bracket of archive-convention footnote markers.
 */
const FULLWIDTH_CLOSE = '〕';

/**
 * Digit characters accepted inside markers:
 * ASCII first, full-width second, index modulo base yields digit value.
 */
const DIGIT_CHARS = '0123456789０１２３４５６７８９';

/**
 * Numeric base folding full-width digit indexes onto ASCII digit values.
 */
const DECIMAL_BASE = 10;

/**
 * One raw full-width marker found in a source slice.
 *
 * @example
 * ```ts
 * const hit: TextMarkerHit = { identifier: '1', localOffset: 2, };
 * ```
 */
export type TextMarkerHit = {
  /**
   * Marker number normalized to ASCII digits.
   */
  readonly identifier: string;

  /**
   * Offset of opening bracket within scanned slice.
   */
  readonly localOffset: number;
};

/**
 * Scans one source slice for `〔N〕` markers in a single linear pass.
 * Accepts ASCII and full-width digits;
 * brackets without digits between them are ordinary text, not markers.
 *
 * @param slice - exact source text of one mdast text node
 *
 * @returns Hits in source order with slice-local offsets
 *
 * @example
 * ```ts
 * scanFullwidthMarkers({ slice: '文学上的折扣〔1〕', },);
 * ```
 */
export function scanFullwidthMarkers(
  { slice, }: { readonly slice: string; },
): readonly TextMarkerHit[] {
  /**
   * Accumulated hits in source order.
   */
  const hits: TextMarkerHit[] = [];

  /**
   * Scan cursor advanced past each examined opening bracket.
   */
  let cursor = slice.indexOf(FULLWIDTH_OPEN,);

  while (cursor !== (-1)) {
    /**
     * Digits collected between brackets, normalized to ASCII.
     */
    let digits = '';

    /**
     * Cursor walking characters after opening bracket.
     */
    let probe = cursor + 1;

    while (probe < slice.length) {
      /**
       * Digit-table index of probed character; -1 ends digit collection.
       */
      const digitIndex = DIGIT_CHARS.indexOf(nonNullishOrThrow(slice[probe],),);
      if (digitIndex === (-1))
        break;

      digits = `${digits}${String(digitIndex % DECIMAL_BASE,)}`;
      probe += 1;
    }

    if ((digits !== '') && (slice[probe] === FULLWIDTH_CLOSE))
      hits.push({
        identifier: digits,
        localOffset: cursor,
      },);

    cursor = slice.indexOf(
      FULLWIDTH_OPEN,
      cursor + 1,
    );
  }

  return hits;
}

/**
 * Opening sequence of GFM footnote reference literals.
 */
const GFM_REF_OPEN = '[^';

/**
 * Closing bracket of GFM footnote reference literals.
 */
const GFM_REF_CLOSE = ']';

/**
 * Characters ending identifier collection early;
 * literals containing them are ordinary prose brackets, not references.
 */
const GFM_IDENTIFIER_STOPPERS = ' \t\n[^';

/**
 * Scans one source slice for literal `[^identifier]` sequences.
 *
 * micromark consumes every `[^identifier]` whose definition exists into a
 * footnoteReference node, so a literal surviving inside a text node is an
 * unresolved reference by construction:
 * scanning literals is exactly how dropped or mistranslated definitions surface.
 *
 * @param slice - exact source text of one mdast text node
 *
 * @returns Hits in source order with slice-local offsets
 *
 * @example
 * ```ts
 * scanGfmReferenceLiterals({ slice: '引用[^7]没有定义。', },);
 * ```
 */
export function scanGfmReferenceLiterals(
  { slice, }: { readonly slice: string; },
): readonly TextMarkerHit[] {
  /**
   * Accumulated hits in source order.
   */
  const hits: TextMarkerHit[] = [];

  /**
   * Scan cursor advanced past each examined opening sequence.
   */
  let cursor = slice.indexOf(GFM_REF_OPEN,);

  while (cursor !== (-1)) {
    /**
     * Identifier characters collected before closing bracket.
     */
    let identifier = '';

    /**
     * Cursor walking characters after opening sequence.
     */
    let probe = cursor + GFM_REF_OPEN.length;

    while (probe < slice.length) {
      /**
       * Character under examination, proven present by loop bound.
       */
      const character = nonNullishOrThrow(slice[probe],);
      if ((character === GFM_REF_CLOSE) || GFM_IDENTIFIER_STOPPERS.includes(character,))
        break;

      identifier = `${identifier}${character}`;
      probe += 1;
    }

    if ((identifier !== '') && (slice[probe] === GFM_REF_CLOSE))
      hits.push({
        identifier,
        localOffset: cursor,
      },);

    cursor = slice.indexOf(
      GFM_REF_OPEN,
      cursor + 1,
    );
  }

  return hits;
}

//endregion Text marker scanning

//region Graph construction

/**
 * Composite key joining convention and identifier for grouping.
 *
 * @param convention - syntax family
 *
 * @param identifier - normalized identifier
 *
 * @returns Collision-free grouping key
 *
 * @example
 * ```ts
 * graphKey({ convention: 'gfm', identifier: '1', },);
 * ```
 */
function graphKey(
  {
    convention,
    identifier,
  }: {
    readonly convention: FootnoteConvention;
    readonly identifier: string;
  },
): string {
  return `${convention}\u0000${identifier}`;
}

/**
 * Mutable accumulator threaded through one document walk.
 *
 * @example
 * ```ts
 * const acc: GraphAccumulator = { references: [], definitions: [], };
 * ```
 */
type GraphAccumulator = {
  /**
   * References collected so far in source order.
   */
  readonly references: FootnoteReferenceHit[];

  /**
   * Definitions collected so far in source order.
   */
  readonly definitions: FootnoteDefinitionHit[];
};

/**
 * Walks one top-level block with an explicit work-stack,
 * collecting GFM footnote references and full-width markers from text nodes.
 * Code and inline-code nodes never enter text scanning because only `text` nodes are
 * scanned, which is what makes marker look-alikes inside code harmless.
 *
 * @param block - top-level mdast block to walk
 *
 * @param blockIndex - index of block among top-level children
 *
 * @param blockStart - body-relative start offset of block
 *
 * @param bodyText - body source for faithful slice scanning
 *
 * @param bodyOffset - absolute offset of body start in full document source
 *
 * @param acc - accumulator receiving hits
 *
 * @example
 * ```ts
 * collectBlockHits({ block, blockIndex: 0, blockStart: 0, bodyText, bodyOffset: 0, acc, },);
 * ```
 */
function collectBlockHits(
  {
    block,
    blockIndex,
    blockStart,
    bodyText,
    bodyOffset,
    acc,
  }: {
    readonly block: RootContent;
    readonly blockIndex: number;
    readonly blockStart: number;
    readonly bodyText: string;
    readonly bodyOffset: number;
    readonly acc: GraphAccumulator;
  },
): void {
  /**
   * Structural identifier shared by every hit inside this block.
   */
  const nodeId = `block/${String(blockIndex,)}`;

  /**
   * Explicit work-stack replacing recursion for this bounded structural walk.
   */
  const stack: RootContent[] = [block,];

  while (stack.length > 0) {
    /**
     * Node under examination, proven present by loop condition.
     */
    const node = nonNullishOrThrow(stack.pop(),);

    if (node.type === 'footnoteReference') {
      acc.references
        .push({
        convention: 'gfm',
        identifier: node.identifier,
        nodeId,
        offset: bodyOffset + nonNullishOrThrow(node.position
          ?.start
          .offset,),
      },);
    }
    else if (node.type === 'text') {
      /**
       * Body-relative start of this text node.
       */
      const textStart = nonNullishOrThrow(node.position
        ?.start
        .offset,);

      /**
       * Body-relative end of this text node.
       */
      const textEnd = nonNullishOrThrow(node.position
        ?.end
        .offset,);

      for (const hit of scanFullwidthMarkers({ slice: bodyText.slice(
        textStart,
        textEnd,
      ), },)) {
        /**
         * Text between block start and marker;
         * all-whitespace prefix means marker opens its block,
         * which is how archive-convention definitions are written.
         */
        const prefix = bodyText.slice(
          blockStart,
          textStart + hit.localOffset,
        );

        if (prefix.trim() === '') {
          acc.definitions
            .push({
            convention: 'fullwidth-bracket',
            identifier: hit.identifier,
            nodeId,
          },);
        }
        else {
          acc.references
            .push({
            convention: 'fullwidth-bracket',
            identifier: hit.identifier,
            nodeId,
            offset: bodyOffset + textStart
              + hit.localOffset,
          },);
        }
      }

      // Literal [^id] sequences survive parsing only when their definition is
      // missing, so every hit here is an unresolved GFM reference.
      //
      // Folded on the way in, because every other identifier in this graph
      // arrives from an mdast node already folded. An unresolved reference
      // spelled `[^Note]` and an orphan definition spelled `[^note]:` are one
      // footnote, and reporting them under two names hides that they are.
      for (const literal of scanGfmReferenceLiterals({ slice: bodyText.slice(
        textStart,
        textEnd,
      ), },)) {
        acc.references
          .push({
          convention: 'gfm',
          identifier: normalizeFootnoteIdentifier({ identifier: literal.identifier, },),
          nodeId,
          offset: bodyOffset + textStart
            + literal.localOffset,
        },);
      }
    }

    if ('children' in node) {
      // Reverse push keeps source order once the LIFO stack pops.
      for (const child of [...node.children,].toReversed())
        stack.push(child,);
    }
  }
}

/**
 * Computes integrity findings from collected references and definitions.
 *
 * @param references - every reference in source order
 *
 * @param definitions - every definition in source order
 *
 * @returns Findings for unresolved references, orphan definitions, and duplicates
 *
 * @example
 * ```ts
 * computeFindings({ references, definitions, },);
 * ```
 */
function computeFindings(
  {
    references,
    definitions,
  }: {
    readonly references: readonly FootnoteReferenceHit[];
    readonly definitions: readonly FootnoteDefinitionHit[];
  },
): readonly FootnoteGraphFinding[] {
  /**
   * Definition count per grouping key, driving duplicate detection.
   */
  const definitionCounts = new Map<string, number>();
  for (const definition of definitions) {
    /**
     * Grouping key of this definition.
     */
    const key = graphKey(definition,);
    definitionCounts.set(
      key,
      (definitionCounts.get(key,) ?? 0) + 1,
    );
  }

  /**
   * Keys of identifiers referenced at least once, driving orphan detection.
   */
  const referencedKeys = new Set(references.map(function toKey(reference,): string {
    return graphKey(reference,);
  },),);

  /**
   * Unresolved references: no definition carries their key.
   */
  const unresolved = references
    .filter(function lacksDefinition(reference,): boolean {
      return !definitionCounts.has(graphKey(reference,),);
    },)
    .map(function toFinding(reference,): FootnoteGraphFinding {
      return {
        kind: 'unresolved-reference',
        convention: reference.convention,
        identifier: reference.identifier,
        nodeId: reference.nodeId,
      };
    },);

  /**
   * Orphan definitions: never referenced anywhere.
   */
  const orphans = definitions
    .filter(function neverReferenced(definition,): boolean {
      return !referencedKeys.has(graphKey(definition,),);
    },)
    .map(function toFinding(definition,): FootnoteGraphFinding {
      return {
        kind: 'orphan-definition',
        convention: definition.convention,
        identifier: definition.identifier,
        nodeId: definition.nodeId,
      };
    },);

  /**
   * Duplicate definitions: identifier defined more than once.
   */
  const duplicates = definitions
    .filter(function definedTwice(definition,): boolean {
      return (definitionCounts.get(graphKey(definition,),) ?? 0) > 1;
    },)
    .map(function toFinding(definition,): FootnoteGraphFinding {
      return {
        kind: 'duplicate-definition',
        convention: definition.convention,
        identifier: definition.identifier,
        nodeId: definition.nodeId,
      };
    },);

  return [
    ...unresolved,
    ...orphans,
    ...duplicates,
  ];
}

/**
 * Builds complete footnote graph of one parsed document:
 * GFM reference and definition nodes plus archive-convention `〔N〕` text markers,
 * validated as a reference-to-definition graph rather than by marker counting.
 *
 * @param children - top-level mdast blocks in source order
 *
 * @param bodyText - body source the blocks were parsed from
 *
 * @param bodyOffset - absolute offset of body start in full document source
 *
 * @returns Graph with references, definitions, and integrity findings
 *
 * @example
 * ```ts
 * const graph = buildFootnoteGraph({ children: root.children, bodyText: body, bodyOffset, },);
 * ```
 */
export function buildFootnoteGraph(
  {
    children,
    bodyText,
    bodyOffset,
  }: {
    readonly children: ForeignBorrowed<readonly RootContent[]>;
    readonly bodyText: string;
    readonly bodyOffset: number;
  },
): FootnoteGraph {
  /**
   * Accumulator receiving hits from every block walk.
   */
  const acc: GraphAccumulator = {
    references: [],
    definitions: [],
  };

  children.forEach(function walkBlock(
    block,
    blockIndex,
  ): void {
    if (block.type === 'footnoteDefinition') {
      acc.definitions
        .push({
        convention: 'gfm',
        identifier: block.identifier,
        nodeId: `block/${String(blockIndex,)}`,
      },);
    }

    collectBlockHits({
      block,
      blockIndex,
      blockStart: nonNullishOrThrow(block.position
        ?.start
        .offset,),
      bodyText,
      bodyOffset,
      acc,
    },);
  },);

  return {
    references: acc.references,
    definitions: acc.definitions,
    findings: computeFindings(acc,),
  };
}

//endregion Graph construction
