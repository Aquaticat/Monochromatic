/**
 * Project readonly parameter and mutation-effect contract rule.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  collectAstNodes,
  isEffectCallableDeclaration,
} from './prefer-readonly-parameter-types/effect-summary-model.ts';
import {
  buildEffectSummaryIndex,
  NO_EFFECT_SUMMARY,
} from './prefer-readonly-parameter-types/effect-summaries.ts';
import { verifyOverloadConsistency, } from './prefer-readonly-parameter-types/overload-consistency.ts';
import { SemanticBridgeError, } from './prefer-readonly-parameter-types/semantic-bridge-error.ts';
import { openSemanticFile, } from './prefer-readonly-parameter-types/typescript-sync-adapter.ts';
import { verifyReadonlyCallable, } from './prefer-readonly-parameter-types/verifier.ts';

/**
 * Rule lifecycle logger.
 */
const l = tagged({ tag: 'prefer-readonly-parameter-types', },);

/**
 * Enforced TypeScript source suffixes excluding declaration variants.
 */
const ENFORCED_SOURCE_SUFFIXES: readonly string[] = [
  '.ts',
  '.mts',
  '.cts',
  '.tsx',
];

/**
 * Exempt declaration-file suffixes.
 */
const DECLARATION_SOURCE_SUFFIXES: readonly string[] = [
  '.d.ts',
  '.d.mts',
  '.d.cts',
];

/**
 * Tests whether host file belongs to semantic enforcement inputs.
 *
 * @param fileName - Oxlint source filename.
 *
 * @returns whether source is non-declaration TypeScript.
 */
function isEnforcedTypeScriptSource(fileName: string,): boolean {
  return ENFORCED_SOURCE_SUFFIXES.some(function enforced(suffix,): boolean {
    return fileName.endsWith(suffix,);
  },)
    && (!DECLARATION_SOURCE_SUFFIXES.some(function declaration(suffix,): boolean {
      return fileName.endsWith(suffix,);
    },));
}

/**
 * Enforces honest readonly parameter types and verified mutation contracts.
 *
 * @example
 * ```ts
 * // @mutates is required when body changes state reachable from parameter.
 * ```
 */
export const preferReadonlyParameterTypes: CreateOnceRule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    hasSuggestions: true,
    docs: {
      description: 'Require honest readonly parameter types and verified @mutates effects.',
      recommended: true,
    },
    messages: {
      shouldBeReadonly: 'Parameter "{{parameterName}}" should be readonly: {{reason}}.',
      missingMutatesTag: 'Parameter "{{parameterName}}" is mutated but lacks @mutates contract.',
      staleMutatesTag: 'Parameter "{{parameterName}}" has stale @mutates contract.',
      opaqueEffect: 'Parameter "{{parameterName}}" crosses opaque effect boundary "{{boundaries}}"; use a verified local adapter.',
      dishonestReadonly: 'Parameter "{{parameterName}}" claims readonly semantics dishonestly: {{reason}}.',
      inconsistentMutatesContract: 'Mutation contracts disagree across callable signatures.',
      semanticBridgeUnavailable: 'Readonly semantic analysis unavailable: {{reason}}.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      Program(node: ESTree.Program,): void {
        if (!isEnforcedTypeScriptSource(context.filename,))
          return;
        /**
         * Function-tagged semantic rule logger.
         */
        const rl = tagged({
          tag: 'Program',
          l,
        },);
        try {
          /**
           * Semantic file session for current Oxlint source overlay.
           */
          const session = openSemanticFile({
            fileName: context.filename,
            sourceText: context.sourceCode
              .text,
            hasBOM: context.sourceCode
              .hasBOM,
          },);
          /**
           * Whole-project callable effect summaries.
           */
          const effectIndex = buildEffectSummaryIndex({ project: session.project, },);
          collectAstNodes(session.sourceFile,)
            .forEach(function verifyNode(semanticNode,): void {
            if (!isEffectCallableDeclaration(semanticNode,))
              return;
            /**
             * Effect summary for current callable declaration.
             */
            const effectSummary = effectIndex.get(semanticNode,);
            if (effectSummary === NO_EFFECT_SUMMARY)
              throw new SemanticBridgeError({
                reason: 'node-not-found',
                message: 'Effect summary index omitted owned callable declaration.',
              },);
            verifyReadonlyCallable({
              context,
              declaration: semanticNode,
              effectSummary,
              project: session.project,
            },);
          },);
          verifyOverloadConsistency({
            context,
            project: session.project,
            sourceFile: session.sourceFile,
            effectIndex,
          },);
        }
        catch (error) {
          rl.error(`semantic rule failed: ${String(error,)}`,);
          context.report({
            node,
            messageId: 'semanticBridgeUnavailable',
            data: {
              reason: error instanceof SemanticBridgeError
                ? `${error.reason}: ${error.message}`
                : String(error,),
            },
          },);
        }
      },
    };
  },
};
