import type {
  CssBlock,
  CssEditState,
  CssNode,
} from './node.ts';
import { rawTextOfTokens, } from './token.ts';

//region Node rendering

/**
 * Renders one block back to source text: opening brace, children, closing brace.
 *
 * @param block - Block to render.
 *
 * @returns Byte-exact source text for an unedited block.
 */
function stringifyBlock(block: CssBlock,): string {
  /**
   * Opening brace representation.
   */
  const [, openRaw,] = block.openToken;
  /**
   * Closing brace representation.
   */
  const [, closeRaw,] = block.closeToken;
  return `${openRaw}${stringifyNodes({ nodes: block.children, },)}${closeRaw}`;
}

/**
 * Renders one node back to source text by concatenating the byte-exact token
 * representations it owns.
 *
 * @param node - Node to render.
 *
 * @returns Source text of the node.
 */
function stringifyNode(node: CssNode,): string {
  if ((node.kind === 'trivia') || (node.kind === 'declaration'))
    return rawTextOfTokens({ tokens: node.tokens, },);

  if (node.kind === 'rule')
    return `${rawTextOfTokens({ tokens: node.preludeTokens, },)}${stringifyBlock(node.block,)}`;

  /**
   * At-keyword representation, byte-exact including the `@`.
   */
  const [, atRaw,] = node.atToken;
  /**
   * Prelude source text between name and body or terminator.
   */
  const prelude = rawTextOfTokens({ tokens: node.preludeTokens, },);
  if (node.block !== undefined)
    return `${atRaw}${prelude}${stringifyBlock(node.block,)}`;
  /**
   * Statement terminator representation; empty when the at-rule ended at a
   * block close or end of input.
   */
  const semicolon = node.semicolonToken === undefined
    ? ''
    : node.semicolonToken[1];
  return `${atRaw}${prelude}${semicolon}`;
}

//endregion Node rendering

//region Entry points

/**
 * Renders a node list back to source text in order.
 *
 * @param nodes - Nodes to render.
 *
 * @returns Concatenated source text.
 *
 * @example
 * ```ts
 * stringifyNodes({ nodes: state.root.children });
 * ```
 */
export function stringifyNodes({
  nodes,
}: {
  readonly nodes: readonly CssNode[];
},): string {
  return nodes
    .map(stringifyNode,)
    .join('',);
}

/**
 * Renders a full edit state back to CSS source. For a state that has not been
 * edited since {@link parseCss}, output is byte-identical to the input; edited
 * regions render from their new nodes while untouched regions keep their
 * original bytes.
 *
 * @param state - Edit state to render.
 *
 * @returns CSS source text.
 *
 * @example
 * ```ts
 * stringifyCss({ state: parseCss({ source, }) }) === source; // => true
 * ```
 */
export function stringifyCss({
  state,
}: {
  readonly state: CssEditState;
},): string {
  return stringifyNodes({ nodes: state.root.children, },);
}

//endregion Entry points
