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
const UNKNOWN_CALL_REMEDIATION = '\n\nChoose the remediation that matches the call:'
  + '\n1. Remove the call or rewrite the code so this input is not given to code the rule cannot inspect.'
  + '\n2. If the called code is in this repository but missing from its TypeScript project, update the nearest tsconfig.json so the rule can inspect that source.'
  + '\n3. If the exact external function or method has been audited, add an entry with evidence and tests to the rule\'s audited-call catalogue. Package calls belong in package-effect-catalog.ts; JavaScript, DOM, and Node calls belong in their matching platform catalogue. The entry must record every input or object the call can change; an empty list is allowed only when the audit proves it changes no state that code outside this function can observe.'
  + '\n4. Otherwise, document the possible change here or in a dedicated function that contains the calls. For each input that might be changed, add its own line to the function\'s /** ... */ comment:'
  + '\n@mutates inputName - explain what may change and name every listed call responsible'
  + '\nReplace inputName with that function\'s actual input name.';

/**
 * Every supported remediation for object-capable global String conversion.
 */
const STRING_OBJECT_COERCION_REMEDIATION = '\n\nChoose the remediation that preserves the intended output:'
  + '\n1. Narrow the input to string, number, bigint, boolean, symbol, null, or undefined before calling String. Primitive conversion cannot run caller-owned hooks.'
  + '\n2. Read a known primitive field and convert that field instead of converting its containing object.'
  + '\n3. For error or logging fallbacks, return known strings directly and describe other values by a noncoercing fact such as typeof value.'
  + '\n4. Remove the conversion when its text is not required.'
  + '\n5. If invoking object coercion hooks is intentional, document every affected input with its own line in the function\'s /** ... */ comment. An object type alone cannot prove that runtime hooks are absent:'
  + '\n@mutates inputName - String may invoke getters, proxy traps, Symbol.toPrimitive, toString, or valueOf on this input'
  + '\nReplace inputName with that function\'s actual input name.';

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
      opaqueEffect: `{{inputSubject}} used by these calls: {{boundaries}}.${UNKNOWN_CALL_CHANGE_EXPLANATION}${UNKNOWN_CALL_REMEDIATION}`,
      opaqueMethodEffect: `{{inputSubject}} used as the object for these method calls: {{boundaries}}.\n\nA method can change data stored inside its object or in the system that object controls, even when this code never assigns a new value to the input.${UNKNOWN_CALL_CHANGE_EXPLANATION}${UNKNOWN_CALL_REMEDIATION}`,
      stringObjectCoercionEffect: `{{inputSubject}} passed to global String while it may be an object. String does not reassign the input. Object conversion reads input[Symbol.toPrimitive], input.toString, and input.valueOf; those reads can run getters or proxy traps, and callable values are then invoked. That caller-owned code can change the input, reachable state, or another system. This rule does not report String conversion when the input is provably primitive.${STRING_OBJECT_COERCION_REMEDIATION}`,
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
