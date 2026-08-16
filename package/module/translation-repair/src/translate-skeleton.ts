import type {
  Root,
  RootContent,
} from 'mdast';

import type { DeepReadonlyData, } from './readonly-data.ts';

import {
  MdxParseError,
  parseMdxBody,
} from './parse-mdx.ts';
import type {
  AtomKind,
  ProtectedAtom,
} from './protected-atom.ts';

//region Translate skeleton
// Reads one slice, source or candidate translation, into the shape a
// translation has to carry across languages: the sequence of blocks, and the
// references and code inside them.
//
// Shares `parseMdxBody` with document parsing rather than scanning Markdown by
// hand, so this cannot disagree with the parser about what a link is. That is
// the same reason `inspect-paragraph.ts` gives, and this is the whole-slice
// cousin of it.
//
// WHAT IS DELIBERATELY NOT HERE: prose atoms. `scanTextAtoms` protects numbers
// and foreign runs, which is right when a rewrite and its base are the same
// language and wrong across a translation, where 三只猫 becomes "three cats"
// and no digit survives on either side. Structure and references survive
// translation; wording does not, and the judges are the instrument for wording.

/**
 * Atom kinds that must survive a translation.
 *
 * Every one of them is a machine-readable identity rather than prose: a URL, a
 * reference label, a footnote marker, or code the author fenced precisely so it
 * would not be rewritten.
 */
const TRANSLATABLE_ATOM_KINDS: ReadonlySet<AtomKind> = new Set<AtomKind>([
  'link-url',
  'image-url',
  'reference',
  'footnote',
  'inline-code',
],);

/**
 * One top-level block's shape.
 *
 * @example
 * ```ts
 * const shape: BlockShape = { kind: 'heading', detail: 'level 2', };
 * ```
 */
export type BlockShape = {
  /**
   * mdast node type, kept as a plain string because remark plugins extend the
   * vocabulary.
   */
  readonly kind: string;

  /**
   * What distinguishes two blocks of the same kind, empty when nothing does.
   *
   * A heading carries its level and a list carries whether it is ordered,
   * because a translation that turns a level-two heading into a level-three one
   * or a bulleted list into a numbered one has changed the document while
   * matching on kind alone.
   */
  readonly detail: string;
};

/**
 * What one slice carries across a translation.
 *
 * @example
 * ```ts
 * const skeleton: SliceSkeleton = { blocks, atoms, };
 * ```
 */
export type SliceSkeleton = {
  /**
   * Top-level blocks in document order.
   */
  readonly blocks: readonly BlockShape[];

  /**
   * References and code in document order.
   */
  readonly atoms: readonly ProtectedAtom[];
};

/**
 * Outcome of reading one slice.
 *
 * @example
 * ```ts
 * const read: SkeletonRead = { kind: 'unparseable', detail: 'unexpected `{`', };
 * ```
 */
export type SkeletonRead =
  | {
    readonly kind: 'read';

    /**
     * What the slice carries.
     */
    readonly skeleton: SliceSkeleton;
  }
  | {
    readonly kind: 'unparseable';

    /**
     * Parser's own account, for a finding a model can act on.
     */
    readonly detail: string;
  };

/**
 * Recursively readonly mdast root, as this module BORROWS the parse result.
 *
 * @example
 * ```ts
 * const root: ReadonlyMdastRoot = parsed.root;
 * ```
 */
type ReadonlyMdastRoot = DeepReadonlyData<Root>;

/**
 * Recursively readonly mdast content node.
 *
 * @example
 * ```ts
 * const node: ReadonlyMdastContent = root.children[0];
 * ```
 */
type ReadonlyMdastContent = DeepReadonlyData<RootContent>;

/**
 * Names what distinguishes this block from another of the same kind.
 *
 * @param node - top-level mdast block
 *
 * @returns Distinguishing detail, empty when the kind says everything
 *
 * @example
 * ```ts
 * const detail = blockDetail({ node, },);
 * ```
 */
function blockDetail({ node, }: { readonly node: ReadonlyMdastContent; },): string {
  if (node.type === 'heading')
    return `level ${String(node.depth,)}`;
  if (node.type === 'list')
    return (node.ordered === true) ? 'ordered' : 'bulleted';
  return '';
}

/**
 * Reads one node into the atoms it contributes, if any.
 *
 * @param node - mdast node at any depth
 *
 * @returns Atoms this node contributes
 *
 * @example
 * ```ts
 * const atoms = atomsOfNode({ node, },);
 * ```
 */
function atomsOfNode(
  { node, }: { readonly node: ReadonlyMdastContent; },
): readonly ProtectedAtom[] {
  if (node.type === 'inlineCode')
    return [{
      kind: 'inline-code',
      value: node.value,
    },];
  if (node.type === 'link')
    return [{
      kind: 'link-url',
      value: node.url,
    },];
  if (node.type === 'image')
    return [{
      kind: 'image-url',
      value: node.url,
    },];
  if ((node.type === 'linkReference') || (node.type === 'imageReference'))
    return [{
      kind: 'reference',
      value: node.identifier,
    },];
  if (node.type === 'footnoteReference')
    return [{
      kind: 'footnote',
      value: node.identifier,
    },];
  if (node.type === 'footnoteDefinition')
    return [{
      kind: 'footnote',
      value: node.identifier,
    },];
  return [];
}

/**
 * Walks a parsed slice into its ordered atoms.
 *
 * @param root - parsed slice
 *
 * @returns Atoms in document order
 *
 * @example
 * ```ts
 * const atoms = walkAtoms({ root, },);
 * ```
 */
function walkAtoms({ root, }: { readonly root: ReadonlyMdastRoot; },): readonly ProtectedAtom[] {
  /**
   * Nodes still to visit, held as a stack so the walk stays iterative over a
   * tree of unknown depth; children push reversed to keep document order.
   */
  const pending: ReadonlyMdastContent[] = [...root.children,].toReversed();

  /**
   * Atoms in document order.
   */
  const atoms: ProtectedAtom[] = [];
  while (pending.length > 0) {
    /**
     * Next node in document order.
     */
    const node = pending.pop();
    if (node === undefined)
      continue;
    atoms.push(
      ...atomsOfNode({ node, },)
        .filter(function survivesTranslation(atom,): boolean {
          return TRANSLATABLE_ATOM_KINDS.has(atom.kind,);
        },),
    );
    if ('children' in node)
      pending.push(...[...node.children,].toReversed(),);
  }
  return atoms;
}

/**
 * Reads one slice into the shape a translation of it has to match.
 *
 * @param text - exact slice source, original or candidate
 *
 * @returns Blocks and atoms, or the parser's refusal
 *
 * @example
 * ```ts
 * const read = readSliceSkeleton({ text: candidate, },);
 * ```
 */
export function readSliceSkeleton(
  { text, }: { readonly text: string; },
): SkeletonRead {
  try {
    /**
     * Parsed slice under the strict grammar.
     */
    const root: ReadonlyMdastRoot = parseMdxBody({ body: text, },);
    return {
      kind: 'read',
      skeleton: {
        blocks: root.children
          .map(function toShape(node,): BlockShape {
            return {
              kind: node.type,
              detail: blockDetail({ node, },),
            };
          },),
        atoms: walkAtoms({ root, },),
      },
    };
  }
  catch (error) {
    // Only the grammar's own rejection becomes a refusal; anything else is an
    // unexpected state that must keep propagating.
    if (!(error instanceof MdxParseError))
      throw error;
    return {
      kind: 'unparseable',
      detail: String(error,),
    };
  }
}

//endregion Translate skeleton
