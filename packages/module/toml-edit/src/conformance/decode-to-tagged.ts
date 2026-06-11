/**
 * Walk a parsed TOML program into a toml-test tagged tree.
 *
 * Reconstructs the nested table / array structure from the parser's flat
 * document body, using each table's absolute `resolvedKey` (which carries
 * numeric array-of-tables indices) so the walk is a flat path-insert rather
 * than a stateful re-implementation of table resolution. The mutable tree is
 * captured in a builder closure, so no helper takes a mutable container as a
 * parameter.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

import { leafToTagged, } from './decode-leaf.ts';
import type {
  TaggedTree,
  TaggedValue,
} from './tagged-types.ts';

//region Builder model

/**
 * Mutable table built during the walk; assignable to the readonly `TaggedTree`.
 */
type BuildTable = { [key: string]: BuildNode; };

/**
 * Mutable tree node mirroring `TaggedTree` while the structure is assembled.
 */
type BuildNode = TaggedValue | BuildNode[] | BuildTable;

/**
 * Container node a path step can descend into.
 */
type BuildContainer = BuildTable | BuildNode[];

/**
 * Test whether a tree node is a tagged scalar leaf rather than a container.
 *
 * Typed over the deeply-readonly `TaggedTree` so the mutable builder union stays
 * out of a parameter position; a leaf carries a string `type`, while a table's
 * `type` entry (if any) holds a nested node, making the check decisive.
 *
 * @param node - Tree node to classify.
 *
 * @returns True when `node` is a tagged scalar.
 *
 * @example
 * ```ts
 * isLeaf(node); // false for a table
 * ```
 */
function isLeaf(node: TaggedTree,): node is TaggedValue {
  return ('type' in node) && ((typeof node.type) === 'string');
}

/**
 * Path of string table/key segments and numeric array-of-tables indices.
 */
type AbsolutePath = readonly (string | number)[];

/**
 * Builder surface: the growing root plus its two insertion entry points.
 */
type DocumentBuilder = {
  readonly root: BuildTable;
  readonly addKeyValue: (args: {
    readonly path: AbsolutePath;
    readonly content: AST.TOMLNode
  },) => void;
  readonly addTable: (
    args: {
      readonly resolvedKey: AbsolutePath;
      readonly entries: readonly AST.TOMLKeyValue[]
    },
  ) => void;
};

//endregion Builder model

//region Key resolution

/**
 * Resolve a key node to its bare string segments.
 *
 * @param key - Parsed key node (dotted keys carry several segments).
 *
 * @returns Segment names, with quoted-key values decoded.
 *
 * @example
 * ```ts
 * keyPath({ key, }); // ['servers', 'alpha']
 * ```
 */
function keyPath({ key, }: { readonly key: AST.TOMLKey; },): readonly string[] {
  return key.keys
    .map(function keySegment(segment,) {
      return (segment.type === 'TOMLBare') ? segment.name : segment.value;
    },);
}

//endregion Key resolution

//region Document builder

/**
 * Create a tagged-tree builder that inserts by absolute path.
 *
 * The single mutable root is held in the closure, so descent and insertion
 * mutate that captured value and local cursors rather than passing mutable
 * containers between functions.
 *
 * @returns Builder exposing its root and the two insertion entry points.
 *
 * @example
 * ```ts
 * const b = createBuilder();
 * b.addKeyValue({ path: ['a'], content: valueNode, });
 * ```
 */
function createBuilder(): DocumentBuilder {
  /**
   * Document root accumulating every key-value and table.
   */
  const root: BuildTable = {};

  /**
   * Descend to the container holding `path`'s final segment, creating missing
   * intermediate tables and arrays; a numeric next segment makes an array.
   *
   * @param path - Absolute path whose parent container is wanted.
   *
   * @returns Container holding the final segment.
   *
   * @throws Error when a prefix descends through a scalar.
   *
   * @example
   * ```ts
   * descend(['a', 'b']); // container at `a`
   * ```
   */
  function descend(path: AbsolutePath,): BuildContainer {
    return path
      .slice(
        0,
        -1,
      )
      .reduce<BuildContainer>(
        function step(
          current,
          seg,
          index,
        ) {
          /**
           * Existing child at this step, if the prefix was already built.
           */
          const existing = Array.isArray(current,)
            ? (((typeof seg) === 'number') ? current[seg] : undefined)
            : (((typeof seg) === 'string') ? current[seg] : undefined);
          /**
           * Child to descend into, created to match the next segment's kind.
           */
          const child: BuildNode = existing ?? (((typeof path[index + 1]) === 'number') ? [] : {});
          if (existing === undefined) {
            if (Array.isArray(current,)) {
              if ((typeof seg) === 'number') current[seg] = child;
            }
            else if ((typeof seg) === 'string') current[seg] = child;
          }
          if (isLeaf(child,))
            throw new Error('conformance decode: path descends through a scalar',);
          return child;
        },
        root,
      );
  }

  /**
   * Insert one key-value's tagged content at its absolute path.
   *
   * @param path - Absolute insertion path.
   *
   * @param content - Parsed content node to tag and insert.
   *
   * @example
   * ```ts
   * addKeyValue({ path: ['a'], content: valueNode, });
   * ```
   */
  function addKeyValue({
    path,
    content,
  }: {
    readonly path: AbsolutePath;
    readonly content: AST.TOMLNode
  },): void {
    /**
     * Tagged value to place, computed before navigation.
     */
    const value = contentToTagged({ node: content, },);
    /**
     * Container holding the final segment.
     */
    const parent = descend(path,);
    /**
     * Final path segment.
     */
    const last = path.at(-1,) ?? '';
    if (Array.isArray(parent,)) {
      if ((typeof last) === 'number') parent[last] = value;
      return;
    }
    if ((typeof last) === 'string') parent[last] = value;
  }

  /**
   * Ensure an empty table exists at `resolvedKey`, then insert its entries.
   *
   * @param resolvedKey - Absolute table path.
   *
   * @param entries - Key-values declared under the table header.
   *
   * @example
   * ```ts
   * addTable({ resolvedKey: ['a'], entries: [], });
   * ```
   */
  function addTable(
    {
      resolvedKey,
      entries,
    }: {
      readonly resolvedKey: AbsolutePath;
      readonly entries: readonly AST.TOMLKeyValue[]
    },
  ): void {
    /**
     * Container holding the table's final segment.
     */
    const parent = descend(resolvedKey,);
    /**
     * Final segment naming the table within its parent.
     */
    const last = resolvedKey.at(-1,) ?? '';
    if (Array.isArray(parent,)) {
      if (((typeof last) === 'number') && (parent[last] === undefined)) parent[last] = {};
    }
    else if (((typeof last) === 'string') && (parent[last] === undefined)) parent[last] = {};
    for (const entry of entries)
      addKeyValue({
        path: [
          ...resolvedKey,
          ...keyPath({ key: entry.key, },),
        ],
        content: entry.value,
      },);
  }

  return {
    root,
    addKeyValue,
    addTable,
  };
}

//endregion Document builder

//region Content and document walk

/**
 * Convert a content node (scalar, array, or inline table) to a tagged tree.
 *
 * @param node - Parsed content node, typed as the broad `TOMLNode` alias so the
 *               mutable parser union stays out of a narrower parameter position.
 *
 * @returns Tagged scalar, tagged array, or tagged table.
 *
 * @throws Error when the node is not a value, array, or inline table.
 *
 * @example
 * ```ts
 * contentToTagged({ node, }); // { type: 'string', value: 'x' }
 * ```
 */
function contentToTagged({ node, }: { readonly node: AST.TOMLNode; },): BuildNode {
  if (node.type === 'TOMLValue')
    return leafToTagged({ node, },);
  if (node.type === 'TOMLArray')
    return node.elements
      .map(function each(element,) {
        return contentToTagged({ node: element, },);
      },);
  if (node.type === 'TOMLInlineTable') {
    /**
     * Nested builder so dotted keys inside the inline table nest correctly.
     */
    const inline = createBuilder();
    for (const entry of node.body)
      inline.addKeyValue({
        path: keyPath({ key: entry.key, },),
        content: entry.value,
      },);
    return inline.root;
  }
  throw new Error('conformance decode: unexpected content node',);
}

/**
 * Walk a parsed program into the toml-test tagged tree for its document.
 *
 * @param program - Parsed TOML program.
 *
 * @returns Tagged tree rooted at an object, ready to serialize as JSON.
 *
 * @example
 * ```ts
 * documentToTagged({ program, }); // { a: { type: 'integer', value: '42' } }
 * ```
 */
export function documentToTagged({ program, }: { readonly program: AST.TOMLProgram; },): TaggedTree {
  /**
   * Builder accumulating every key-value and table.
   */
  const builder = createBuilder();
  for (const item of program.body[0]
    .body) {
    if (item.type === 'TOMLKeyValue') {
      builder.addKeyValue({
        path: keyPath({ key: item.key, },),
        content: item.value,
      },);
      continue;
    }
    builder.addTable({
      resolvedKey: item.resolvedKey,
      entries: item.body,
    },);
  }
  return builder.root;
}

//endregion Content and document walk
