/**
 * Project readonly parameter preference and uncertain-effect contract rule.
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
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  callableKey,
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
 * Plain-language explanation for calls whose implementation remains unknown.
 */
const UNKNOWN_CALL_CHANGE_EXPLANATION = '\n\nThis rule cannot inspect enough of those calls to know what they might change. They could change the input itself, change an object stored inside it, call a function stored inside it, or arrange for one of those changes to happen later.';

/**
 * Every supported remediation for calls whose implementation remains unknown.
 */
const UNKNOWN_CALL_REMEDIATION = '\n\nResolve the call by one of these proof-preserving changes:'
  + '\n1. Include the exact repository-owned implementation in the nearest tsconfig.json so the rule can inspect it.'
  + '\n2. Pass only primitive values or a separately verified isolated snapshot that shares no caller-owned identity or capability.'
  + '\n3. Remove or replace the call so no caller-owned input reaches unresolved code.'
  + '\n4. After source and source-map inference are exhausted, mark exact runtime-owned host input as ForeignHostCapability and document its possible effects with @mutates.'
  + '\n\nAn @mutates block alone documents known effects but cannot make an unresolved implementation safe.';

/**
 * Prefers readonly parameters and requires documentation for unresolved effects.
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
      description: 'Require honest readonly parameter types and reject unresolved parameter-reachable effects.',
      recommended: true,
    },
    messages: {
      shouldBeReadonly: 'Parameter "{{parameterName}}" should be readonly: {{reason}}.',
      staleMutatesTag: 'Parameter "{{parameterName}}" has stale @mutates contract.',
      hostCapabilityContractRequired:
        'Parameter "{{parameterName}}" uses ForeignHostCapability for unresolved runtime behavior but lacks corresponding @mutates contract.',
      redundantForeignBorrowed:
        'Parameter "{{parameterName}}" carries a ForeignBorrowed marker that no longer affects any classification: the underlying type is already deeply readonly and no effect reaches this parameter. Remove the marker, or mark the genuinely mutable foreign type instead.',
      opaqueEffect: `{{inputSubject}} used by these calls: {{boundaries}}.${UNKNOWN_CALL_CHANGE_EXPLANATION}${UNKNOWN_CALL_REMEDIATION}`,
      opaqueMethodEffect: `{{inputSubject}} used as the object for these method calls: {{boundaries}}.\n\nA method can change data stored inside its object or in the system that object controls, even when this code never assigns a new value to the input.${UNKNOWN_CALL_CHANGE_EXPLANATION}${UNKNOWN_CALL_REMEDIATION}`,
      dishonestReadonly: 'Parameter "{{parameterName}}" claims readonly semantics dishonestly: {{reason}}.',
      inconsistentMutatesContract: 'Mutation contracts disagree across callable signatures.',
      semanticBridgeUnavailable: 'Readonly semantic analysis unavailable: {{reason}}.',
    },
  },
  /**
   * Handles foreign Oxlint callback.
   *
   * @param context - Foreign rule context receiving diagnostics.
   *
   * @mutates context - Emits Oxlint diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
    return {
      Program(node: ForeignBorrowed<ESTree.Program>,): void {
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
          const effectIndex = buildEffectSummaryIndex({
            project: session.project,
            activeSourceFile: session.sourceFile,
          },);
          collectAstNodes(session.sourceFile,)
            .forEach(function verifyNode(semanticNode,): void {
            if (!isEffectCallableDeclaration(semanticNode,))
              return;
            /**
             * Effect summary for current callable declaration.
             */
            const effectSummary = effectIndex.get(semanticNode,);
            if (effectSummary === NO_EFFECT_SUMMARY) {
              /**
               * Stable semantic identity omitted by project effect index.
               */
              const missingKey = callableKey(semanticNode,);
              throw new SemanticBridgeError({
                reason: 'node-not-found',
                message: `Effect summary index omitted owned callable declaration ${missingKey}.`,
              },);
            }
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
