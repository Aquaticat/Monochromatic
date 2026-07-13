/**
 * Mutation-contract tag validation.
 *
 * @module
 */

import type {
  Context,
  CreateOnceRule,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ReadonlyDeep, } from 'type-fest';

import {
  extractDestructuredParamNames,
  extractParamNames,
} from '../tsdoc-utils.ts';
import type { ParsedMutatesBlock, } from '../tsdoc-doc-model.ts';
import {
  commentLineReportLoc,
  createFunctionTsdocVisitor,
} from './tsdoc-visitors.ts';

/**
 * Reports one malformed mutation block.
 *
 * @param context - Rule context receiving diagnostics.
 *
 * @param comment - Parsed comment owning block.
 *
 * @param block - Mutation contract to validate.
 *
 * @param validTargets - Parameter and destructured binding names accepted by callable.
 *
 * @param seenTargets - Targets already documented by preceding blocks.
 *
 * @example
 * ```ts
 * reportInvalidMutatesBlock({ context, comment, block, validTargets, seenTargets });
 * ```
 */
function reportInvalidMutatesBlock({
  context,
  comment,
  block,
  validTargets,
  seenTargets,
}: {
  readonly context: Context;
  readonly comment: Parameters<typeof commentLineReportLoc>[0]['comment'];
  readonly block: ReadonlyDeep<ParsedMutatesBlock>;
  readonly validTargets: ReadonlySet<string>;
  readonly seenTargets: Set<string>;
},): void {
  /** Location anchored to the malformed custom-tag line. */
  const loc = commentLineReportLoc({
    comment,
    lineOffset: block.lineOffset,
  },);
  if (block.parameterName === '') {
    context.report({ loc, messageId: 'missingTarget', },);
    return;
  }
  if (!validTargets.has(block.parameterName,)) {
    context.report({
      loc,
      messageId: 'unknownTarget',
      data: { target: block.parameterName, },
    },);
  }
  if (seenTargets.has(block.parameterName,)) {
    context.report({
      loc,
      messageId: 'duplicateTarget',
      data: { target: block.parameterName, },
    },);
  }
  else {
    seenTargets.add(block.parameterName,);
  }
  if (!block.hasDescription) {
    context.report({
      loc,
      messageId: 'missingDescription',
      data: { target: block.parameterName, },
    },);
  }
}

/**
 * Validates `@mutates target - rationale` grammar against callable parameters.
 *
 * @example
 * ```ts
 * // tsdoc/check-mutates reports unknown and duplicate targets.
 * ```
 */
export const checkMutates: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate mutation-contract targets and descriptions.',
      recommended: true,
    },
    messages: {
      missingTarget: 'Mutation contract must name a parameter.',
      missingDescription: 'Mutation contract for "{{target}}" must include a description.',
      unknownTarget: 'Mutation contract target "{{target}}" does not match any parameter.',
      duplicateTarget: 'Mutation contract target "{{target}}" is duplicated.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return createFunctionTsdocVisitor({
      context,
      handler: function checkMutatesHandler(
        node,
        result,
      ): void {
        /** Named parameters accepted as mutation targets. */
        const validTargets = new Set([
          ...extractParamNames(node,),
          ...extractDestructuredParamNames(node,),
        ],);
        /** Targets already encountered in source order. */
        const seenTargets = new Set<string>();
        result.docComment.mutates.blocks.forEach(function validateBlock(block,): void {
          reportInvalidMutatesBlock({
            context,
            comment: result.comment,
            block,
            validTargets,
            seenTargets,
          },);
        },);
      },
    },);
  },
};
