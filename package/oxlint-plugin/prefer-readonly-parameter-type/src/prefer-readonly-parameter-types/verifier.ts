/**
 * Diagnostic comparison for readonly parameter types and mutation contracts.
 *
 * @module
 */

import type { ParsedMutationContractBlock, } from '@monochromatic-dev/oxlint-plugin-shared/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  Context,
  Fixer,
} from '@oxlint/plugins';
import type { EffectCallableDeclaration, } from './effect-summary-model.ts';
import type { CallableEffectSummary, } from './effect-summaries.ts';
import type { ParameterIndex, } from './effect-slot-identity.ts';
import {
  MUTATION_CONTRACT_UNAVAILABLE,
  mutationContractsForDeclaration,
  mutationTargetIndexes,
} from './mutation-contract-query.ts';
import { opaqueEffectReport, } from './opaque-effect-diagnostic.ts';
import type { classifyReadonlyType, } from './readonly-classifier.ts';
import {
  factsNeedForeignProof,
  readonlyParameterFacts,
  type ReadonlyParameterFacts,
} from './readonly-parameter-facts.ts';
import { reportRedundantForeignBorrowed, } from './redundant-marker-report.ts';
import { readonlyParameterSuggestions, } from './readonly-suggestions.ts';

import {
  oxlintOffset,
  semanticLocation,
} from './semantic-location.ts';

/**
 * Reports stale mutation block with verified removal suggestion.
 *
 * @param context - Rule context receiving diagnostic.
 *
 * @param block - Shared parsed mutation block.
 *
 * @param commentBodyStartOffset - Absolute source start of comment body.
 *
 * @mutates context - Emits Oxlint diagnostics through foreign rule context.
 */
function reportStaleContract({
  context,
  block,
  commentBodyStartOffset,
}: ForeignBorrowed<{
  readonly context: Context;
  readonly block: ParsedMutationContractBlock;
  readonly commentBodyStartOffset: number;
}>,): void {
  /**
   * Absolute Oxlint range for complete stale block.
   */
  const range: [
    number,
    number
  ] = [
    oxlintOffset({
      offset: commentBodyStartOffset + block.blockStartOffset,
      hasBOM: context.sourceCode
        .hasBOM,
    },),
    oxlintOffset({
      offset: commentBodyStartOffset + block.blockEndOffset,
      hasBOM: context.sourceCode
        .hasBOM,
    },),
  ];
  /**
   * Replacement preserving closing-comment indentation for final block.
   */
  const replacement = context.sourceCode
    .text
    .startsWith(
      '*/',
      range[1],
    )
    ? ' '
    : '';
  context.report({
    node: context.sourceCode
      .ast,
    loc: semanticLocation({
      context,
      start: commentBodyStartOffset + block.blockStartOffset,
      end: commentBodyStartOffset + block.blockEndOffset,
    },),
    messageId: 'staleMutatesTag',
    data: { parameterName: block.parameterName, },
    suggest: [
      {
        desc: `Remove stale @mutates ${block.parameterName} block.`,
        fix(fixer: ForeignBorrowed<Fixer>,): ReturnType<Fixer['replaceTextRange']> {
          return fixer.replaceTextRange(
            range,
            replacement,
          );
        },
      },
    ],
  },);
}

/**
 * Verifies one callable's type and mutation contracts.
 *
 * @param context - Rule context receiving diagnostics.
 *
 * @param declaration - Callable declaration to verify.
 *
 * @param effectSummary - Whole-project effects for callable.
 *
 * @param project - TypeScript project used by readonly classifier.
 *
 * @param proveForeignBorrowed - Complete backwards-closure proof for this callable, demanded at
 * most once and only when some parameter's verdict reads it.
 *
 * @example
 * ```ts
 * verifyReadonlyCallable({ context, declaration, effectSummary, project, proveForeignBorrowed });
 * ```
 *
 * @mutates context - Emits Oxlint diagnostics through foreign rule context.
 */
export function verifyReadonlyCallable({
  context,
  declaration,
  effectSummary,
  project,
  proveForeignBorrowed,
}: ForeignBorrowed<{
  readonly context: Context;
  readonly declaration: EffectCallableDeclaration;
  readonly effectSummary: CallableEffectSummary;
  readonly project: Parameters<typeof classifyReadonlyType>[0]['project'];
  readonly proveForeignBorrowed: () => ReadonlySet<ParameterIndex>;
}>,): void {
  /**
   * Source file owning callable and authored comments.
   */
  const sourceFile = declaration.getSourceFile();
  /**
   * Attached mutation contracts, when callable has TSDoc.
   */
  const contracts = mutationContractsForDeclaration({
    declaration,
    sourceFile,
  },);
  /**
   * Valid contract targets mapped to parameter indexes.
   */
  const targetIndexes = mutationTargetIndexes({
    declaration,
    sourceFile,
  },);
  /**
   * Parsed mutation blocks, absent when callable has no TSDoc.
   */
  const blocks = contracts === MUTATION_CONTRACT_UNAVAILABLE ? [] : contracts.blocks;
  /**
   * Mutation blocks grouped by semantic parameter index.
   */
  const blocksByParameter = new Map<number, typeof blocks>();
  blocks.forEach(function groupBlock(block,): void {
    /**
     * Parameter index matching authored target.
     */
    const parameterIndex = targetIndexes.get(block.parameterName,);
    if (parameterIndex === undefined)
      return;
    blocksByParameter.set(
      parameterIndex,
      [
        ...blocksByParameter.get(parameterIndex,) ?? [],
        block,
      ],
    );
  },);
  /**
   * Whether callable has analyzable implementation body.
   */
  const hasBody = ('body' in declaration) && (declaration.body !== undefined);
  if (!hasBody)
    return;
  /**
   * Everything every parameter's verdict reads, apart from foreign ownership.
   */
  const parameterFacts = readonlyParameterFacts({
    declaration,
    effectSummary,
    project,
    targetIndexes,
    blocksByParameter,
  },);
  /**
   * Parameters a marker holds under foreign ownership, proven only when a verdict reads it.
   *
   * The proof is the most expensive answer this rule can ask for, one complete backwards caller
   * closure over the whole configured scope per callable, and most callables have no parameter
   * whose report it could change. Demanded here rather than inside a branch so that a callable
   * either has the answer before it reports anything or fails before it reports anything: the
   * closure charges the analysis budget, and a budget exhausted midway through a parameter list
   * would otherwise leave half a callable's diagnostics emitted.
   */
  const foreignBorrowedParameters = parameterFacts
      .some(function verdictReadsForeign(facts: ReadonlyParameterFacts,): boolean {
        return factsNeedForeignProof(facts,);
      },)
    ? proveForeignBorrowed()
    : new Set<ParameterIndex>();

  parameterFacts.forEach(function verifyParameter(facts: ReadonlyParameterFacts,): void {
    /**
     * Declared parameter this verdict is about.
     */
    const {
      parameter,
      parameterIndex,
      parameterName,
      inputSubject,
      affectedNames,
      parameterType,
      classification,
      parameterBlocks,
      opaque,
      retained,
      acceptedHostOpacity,
      affected,
      mutated,
      uncertainty,
      foreignHostCapability,
      redundantMarkerPossible,
    } = facts;
    /**
     * Whether exact ownership marker provenance reaches current parameter from
     * boundary, property, element, destructuring, callback, or owned call.
     */
    const foreignBorrowed = foreignBorrowedParameters.has(parameterIndex,);
    /**
     * Report location spanning parameter binding.
     */
    const loc = semanticLocation({
      context,
      start: parameter.name
        .getStart(sourceFile,),
      end: parameter.name
        .end,
    },);

    if (opaque
      && foreignHostCapability
      && (parameterBlocks.length === 0)) {
      context.report({
        loc,
        messageId: 'hostCapabilityContractRequired',
        data: { parameterName, },
      },);
      return;
    }
    if (opaque && (!acceptedHostOpacity)) {
      context.report(opaqueEffectReport({
        loc,
        inputSubject,
        targetIndexes,
        parameterIndex,
        uncertainty,
        ...(affectedNames === undefined) ? {} : { affectedNames, },
      },),);
      return;
    }
    if (mutated
      && (!foreignBorrowed)
      && ((classification.kind === 'honest-readonly')
        || (classification.kind === 'dishonest-readonly'))) {
      context.report({
        loc,
        messageId: 'dishonestReadonly',
        data: {
          parameterName,
          reason: classification.kind === 'dishonest-readonly'
            ? classification.reason
            : 'declared readonly parameter has reachable mutation effect',
        },
      },);
      return;
    }
    if ((!mutated) && (!foreignBorrowed)
      && (classification.kind === 'dishonest-readonly')) {
      context.report({
        loc,
        messageId: 'dishonestReadonly',
        data: {
          parameterName,
          reason: classification.reason,
        },
      },);
    }
    /* `retained` gates the offer and nothing else, which is the whole of what a store
     * changes. Every branch above answers exactly as it did before the store
     * classification existed, because `opaque` is false for a parameter whose only
     * recorded cause is a store, and a store is not a mutation so none of them was ever
     * about it. Placing this test on the offer rather than ahead of the loop is the
     * correction: an early return also took the dishonest-type report away from a
     * parameter that happened to be stored, which `storeDishonestProjection` measures. */
    if ((!mutated)
      && (!retained)
      && (!foreignBorrowed)
      && (classification.kind === 'mutable')) {
      /**
       * Verified semantic type suggestions available for current syntax.
       */
      const suggestions = readonlyParameterSuggestions({
        context,
        parameter,
        project,
      },);
      context.report({
        node: context.sourceCode
          .ast,
        loc,
        messageId: 'shouldBeReadonly',
        data: {
          parameterName,
          reason: classification.reason,
        },
        ...suggestions.length === 0 ? {} : { suggest: suggestions, },
      },);
    }
    if (hasBody && (!affected)
      && (contracts !== MUTATION_CONTRACT_UNAVAILABLE)) {
      parameterBlocks.forEach(function stale(block,): void {
        reportStaleContract({
          context,
          block,
          commentBodyStartOffset: contracts.commentBodyStartOffset,
        },);
      },);
    }
    /* `redundantMarkerPossible` already carries `!affected` together with everything the report
     * decides from the declared type, which is what let the proof above be declined for a
     * parameter this report could not have named. The report applies the same tests again on its
     * own behalf. */
    if (redundantMarkerPossible && foreignBorrowed) {
      reportRedundantForeignBorrowed({
        context,
        project,
        parameterType,
        parameterName,
        loc,
      },);
    }
  },);
}
