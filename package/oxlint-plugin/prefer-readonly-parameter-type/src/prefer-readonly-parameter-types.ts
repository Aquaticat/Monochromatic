/**
 * Project readonly parameter preference and uncertain-effect contract rule.
 *
 * @module
 */

import { caughtValueStack, } from '@monochromatic-dev/module-caught-value/ts';
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
 * Why a collection call can carry caller state whatever the input's type says.
 */
const COLLECTION_CHANGE_EXPLANATION = '\n\nA readonly type stops this code from writing through the input. It does not stop the call from handing an element to code this rule cannot follow, and that is what stays unproven here: not what this function does to the input, but which of its values leave.';

/**
 * Every remediation that fits a collection member, and none that does not.
 *
 * Each is a measured behaviour of this rule rather than a suggestion: an owned observer
 * resolves where a foreign one does not, a result kept inside the callable discharges where a
 * returned one does not, a primitive fold discharges, and direct iteration discharges. Issue
 * #414 is the record of what happens when a message lists remediations nobody verified
 * against the finding they are printed under.
 */
const COLLECTION_REMEDIATION = '\n\nResolve it by one of these changes:'
  + '\n1. Give the call an observer this repository owns, so its effects can be read. A function declared here resolves; one imported from a package whose implementation is unavailable does not.'
  + '\n2. Keep the result inside this function. A result that is returned, stored, or handed to a call this rule cannot resolve leaves what the analysis can follow.'
  + '\n3. Fold to a primitive instead of building a collection. A count, a sum or a joined string carries no element onward.'
  + '\n4. Iterate directly with for...of when the result itself is not needed.'
  + '\n\nForeignHostCapability does not apply here. It marks runtime-owned host objects, not ordinary collection data.';

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
      opaqueCollectionEffect:
        `{{inputSubject}} used as the object for these collection calls: {{boundaries}}.${COLLECTION_CHANGE_EXPLANATION}${COLLECTION_REMEDIATION}`,
      dishonestReadonly: 'Parameter "{{parameterName}}" claims readonly semantics dishonestly: {{reason}}.',
      inconsistentMutatesContract: 'Mutation contracts disagree across callable signatures.',
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
      Program(_node: ForeignBorrowed<ESTree.Program>,): void {
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
              /* Omitted because its summary could not be built, which
               * `effect-demand-index.ts` warns about with the cause. Skipping it costs this
               * one callable its offer and its reports, and costs nothing elsewhere: its
               * callers already take opacity from the absent-callee branch in
               * `effect-fixed-point-propagation.ts`. Reporting here instead would put an
               * internal failure on code whose author cannot act on it. */
              rl.warn(
                `skipping ${callableKey(semanticNode,)}, which the effect index omitted`,
              );
              return;
            }
            verifyReadonlyCallable({
              context,
              declaration: semanticNode,
              effectSummary,
              project: session.project,
              /**
               * Demands the complete foreign-ownership proof for this callable.
               *
               * @returns parameters a marker holds under foreign ownership.
               */
              proveForeignBorrowed(): ReturnType<typeof effectIndex.proveForeignBorrowed> {
                return effectIndex.proveForeignBorrowed(semanticNode,);
              },
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
          /* Every failure reaching here is internal: this rule's own invariants, the
           * semantic bridge, or an upstream panic marshalled back through the API. None of
           * them is a fact about the file being linted, so reporting one as a lint issue
           * blames the wrong code and puts an error on a file whose author can do nothing
           * about it. It goes to the log as a warning instead, with frames, because
           * locating a crash site inside the rule needs frames and a message alone has
           * repeatedly proven insufficient.
           *
           * The file loses its remaining analysis. Diagnostics already emitted for earlier
           * callables survive, because `context.report` has published them by the time
           * anything throws, so this is not the file-wide atomicity an earlier version of this
           * comment claimed. What holds is per-callable: `verifyReadonlyCallable` builds every
           * parameter fact and demands the foreign proof before emitting anything, so no
           * single callable is left half diagnosed.
           * `doc/troubleshooting/typescript-go-tuple-type-panic.md` is the live example. */
          rl.warn(
            `semantic rule failed, so ${context.filename} has no readonly analysis this run: ${
              error instanceof SemanticBridgeError
                ? `${error.reason}: ${caughtValueStack(error,)}`
                : caughtValueStack(error,)
            }`,
          );
        }
      },
    };
  },
};
