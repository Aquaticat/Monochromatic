/**
 * Derived TSDoc document model produced by the in-house comment scanner.
 *
 * Replaces the `@microsoft/tsdoc` `DocComment` tree with the minimal set of
 * facts the rules actually consume: parameter names, per-block "has
 * description" booleans, returns presence, and a few tag-presence flags. The
 * scanner precomputes these so no `DocSection` tree or emitter is needed.
 *
 * @module
 */

import type { Comment, } from '@oxlint/plugins';

/**
 * One documented `@param` block reduced to the facts the rules check.
 */
export type ParsedParamBlock = {
  /**
   * Parameter name token after `@param`; empty when the tag omits a name.
   */
  readonly parameterName: string;
  /**
   * True when the block has any non-whitespace description after the name.
   */
  readonly hasDescription: boolean;
};

/**
 * One documented `@mutates` block reduced to its target and rationale presence.
 *
 * @example
 * ```ts
 * const mutation: ParsedMutatesBlock = {
 *   parameterName: 'cache',
 *   hasDescription: true,
 * };
 * ```
 */
export type ParsedMutatesBlock = {
  /**
   * Parameter target after `@mutates`; empty when tag omits target.
   */
  readonly parameterName: string;
  /**
   * True when block has non-whitespace rationale after target.
   */
  readonly hasDescription: boolean;
  /**
   * Zero-based tag-line offset from comment start.
   */
  readonly lineOffset: number;
};

/**
 * The `@returns` block reduced to whether it carries a description.
 */
export type ParsedReturnsBlock = {
  /**
   * True when the block has any non-whitespace description after the tag.
   */
  readonly hasDescription: boolean;
};

/**
 * Minimal parsed view of a TSDoc comment consumed by the rules.
 */
export type ParsedDocComment = {
  /**
   * Documented `@param` blocks in source order.
   */
  readonly params: {
    /**
     * Param blocks; order matches the function-signature comparison.
     */
    readonly blocks: readonly ParsedParamBlock[];
  };
  /**
   * Documented mutation contracts in source order.
   */
  readonly mutates: {
    /**
     * Mutation blocks consumed by grammar and semantic verification.
     */
    readonly blocks: readonly ParsedMutatesBlock[];
  };
  /**
   * Parsed `@returns` block, absent when the comment has none.
   */
  readonly returnsBlock?: ParsedReturnsBlock;
  /**
   * True when an `@example` block tag is present.
   */
  readonly hasExampleTag: boolean;
  /**
   * True when an `@inheritDoc` tag (inline or block form) is present.
   */
  readonly hasInheritDocTag: boolean;
  /**
   * True when the `@internal` modifier tag is present.
   */
  readonly hasInternalModifier: boolean;
};

/**
 * One structural diagnostic surfaced by the best-effort `valid-types` scan.
 *
 * Mirrors the `messageId` plus `unformattedText` pair the rule previously read
 * off `@microsoft/tsdoc` parser messages, so the rule body is unchanged.
 */
export type TsdocMessage = {
  /**
   * Stable identifier for the structural problem (e.g. `tsdoc-link-tag-empty`).
   */
  readonly messageId: string;
  /**
   * Human-readable description of the structural problem.
   */
  readonly unformattedText: string;
};

/**
 * Result of extracting and scanning a TSDoc comment for a node.
 *
 * @example
 * ```ts
 * const result = parseTsdocForNode({ node, context });
 * if (result !== NO_TSDOC) {
 *   console.log(result.docComment.params.blocks.length);
 * }
 * ```
 */
export type TsdocParseResult = {
  /**
   * Raw block comment AST node from oxlint.
   */
  readonly comment: Comment;
  /**
   * Scanned doc model with param/returns facts and tag-presence flags.
   */
  readonly docComment: ParsedDocComment;
  /**
   * Structural diagnostics for the `valid-types` rule.
   */
  readonly messages: readonly TsdocMessage[];
};
