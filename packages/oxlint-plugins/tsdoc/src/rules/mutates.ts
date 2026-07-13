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
 * @param report - Host callback receiving diagnostics.
 *
 * @param comment - Parsed comment owning block.
 *
 * @param block - Mutation contract to validate.
 *
 * @param validTargets - Parameter and destructured binding names accepted by callable.
 *
 * @param duplicate - Whether preceding block already names target.
 *
 * @example
 * ```ts
 * reportInvalidMutatesBlock({ report: context.report, comment, block, validTargets, duplicate: false });
 * ```
 */
function reportInvalidMutatesBlock({
  report,
  comment,
  block,
  validTargets,
  duplicate,
}: {
  readonly report: Context['report'];
  readonly comment: Parameters<typeof commentLineReportLoc>[0]['comment'];
  readonly block: ReadonlyDeep<ParsedMutatesBlock>;
  readonly validTargets: ReadonlySet<string>;
  readonly duplicate: boolean;
},): void {
  /**
   * Location anchored to malformed custom-tag line.
   */
  const loc = commentLineReportLoc({
    comment,
    lineOffset: block.lineOffset,
  },);
  if (block.parameterName === '') {
    report({
      loc,
      messageId: 'missingTarget',
    },);
    return;
  }
  if (!validTargets.has(block.parameterName,)) {
    report({
      loc,
      messageId: 'unknownTarget',
      data: { target: block.parameterName, },
    },);
  }
  if (duplicate) {
    report({
      loc,
      messageId: 'duplicateTarget',
      data: { target: block.parameterName, },
    },);
  }
  if (!block.hasDescription) {
    report({
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
      includeTypeSignatures: true,
      handler: function checkMutatesHandler(
        node,
        result,
      ): void {
        /**
         * Named parameters accepted as mutation targets.
         */
        const validTargets = new Set([
          ...extractParamNames(node,),
          ...extractDestructuredParamNames(node,),
        ],);
        result.docComment
          .mutates
          .blocks
          .forEach(function validateBlock(
            block,
            index,
            blocks,
          ): void {
            /**
             * Whether another block named target earlier in source order.
             */
            const duplicate = blocks.findIndex(function hasTarget(candidate,): boolean {
              return candidate.parameterName === block.parameterName;
            },) !== index;
            reportInvalidMutatesBlock({
              report: context.report,
              comment: result.comment,
              block,
              validTargets,
              duplicate,
            },);
          },);
      },
    },);
  },
};
