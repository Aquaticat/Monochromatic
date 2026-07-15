/**
 * Diagnostic comparison for readonly parameter types and mutation contracts.
 *
 * @module
 */

import type { ParsedMutationContractBlock, } from '@monochromatic-dev/config-oxlint-shared/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  Context,
  Fixer,
} from '@oxlint/plugins';
import type { EffectCallableDeclaration, } from './effect-summary-model.ts';
import type { CallableEffectSummary, } from './effect-summaries.ts';
import { inputUsageSubject, } from './input-diagnostic-description.ts';
import {
  MUTATION_CONTRACT_UNAVAILABLE,
  mutationContractsForDeclaration,
  mutationTargetIndexes,
} from './mutation-contract-query.ts';
import {
  opaqueEffectReport,
  uncertaintyBoundaries,
} from './opaque-effect-diagnostic.ts';
import { classifyReadonlyType, } from './readonly-classifier.ts';
import { reportRedundantForeignBorrowed, } from './redundant-marker-report.ts';
import { readonlyParameterSuggestions, } from './readonly-suggestions.ts';
import { SemanticBridgeError, } from './semantic-bridge-error.ts';

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
 * @example
 * ```ts
 * verifyReadonlyCallable({ context, declaration, effectSummary, project });
 * ```
 *
 * @mutates context - Emits Oxlint diagnostics through foreign rule context.
 */
export function verifyReadonlyCallable({
  context,
  declaration,
  effectSummary,
  project,
}: ForeignBorrowed<{
  readonly context: Context;
  readonly declaration: EffectCallableDeclaration;
  readonly effectSummary: CallableEffectSummary;
  readonly project: Parameters<typeof classifyReadonlyType>[0]['project'];
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
   * Parsed contract echo naming every authored block including names
   * matching no input;
   * a silently dropped typo was previously indistinguishable from an
   * unparsed contract.
   */
  const parsedContracts = blocks.length === 0
    ? 'none'
    : blocks
      .map(function echoBlock(block,): string {
        return targetIndexes.has(block.parameterName,)
          ? `@mutates ${block.parameterName}`
          : `@mutates ${block.parameterName} (matches no input name)`;
      },)
      .join(', ',);
  /**
   * Whether callable has analyzable implementation body.
   */
  const hasBody = ('body' in declaration) && (declaration.body !== undefined);

  declaration.parameters
    .forEach(function verifyParameter(
      parameter,
      parameterIndex,
    ): void {
    /**
     * Authored parameter text used in diagnostics.
     */
    const parameterName = parameter.name
      .getText(sourceFile,);
    /**
     * Plain-language subject for singular or destructured input names.
     */
    const inputSubject = inputUsageSubject({
      targetIndexes,
      parameterIndex,
    },);
    /**
     * Semantic parameter type.
     */
    const parameterType = project.checker
      .getTypeAtLocation(parameter.name,);
    if (parameterType === undefined)
      throw new SemanticBridgeError({
        reason: 'node-not-found',
        message: `TypeScript did not resolve parameter type for ${parameterName}.`,
      },);
    /**
     * Readonly and capability honesty classification.
     */
    const classification = classifyReadonlyType({
      checker: project.checker,
      project,
      type: parameterType,
    },);
    /**
     * Whether exact ownership marker provenance reaches current parameter from
     * boundary, property, element, destructuring, callback, or owned call.
     */
    const foreignBorrowed = effectSummary.foreignBorrowedParameterIndexes
      .has(parameterIndex,);
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
    /**
     * Mutation contracts targeting current parameter.
     */
    const parameterBlocks = blocksByParameter.get(parameterIndex,) ?? [];
    /**
     * Whether analyzer found proven or documented caller-observable effects.
     */
    const affected = effectSummary.mutatedParameterIndexes
      .has(parameterIndex,);
    /**
     * Whether analyzer proved mutation of referent rather than invocation alone.
     */
    const mutated = effectSummary.referentMutatedParameterIndexes
      .has(parameterIndex,);
    /**
     * Whether analyzer found unresolved external effect.
     */
    const opaque = effectSummary.opaqueParameterIndexes
      .has(parameterIndex,);
    /**
     * Whether unresolved possible effects have complete local documentation.
     */
    const documentedUncertain = effectSummary.documentedUncertainParameterIndexes
      .has(parameterIndex,);
    /**
     * Human-readable provenance for unresolved or documented uncertainty.
     */
    const uncertainty = uncertaintyBoundaries({
      effectSummary,
      parameterIndex,
    },);

    if (opaque) {
      context.report(opaqueEffectReport({
        loc,
        inputSubject,
        targetIndexes,
        parameterIndex,
        uncertainty,
        parsedContracts,
      },),);
      return;
    }
    if (documentedUncertain && (parameterBlocks.length === 0)) {
      context.report({
        loc,
        messageId: 'missingUncertaintyContract',
        data: {
          parameterName,
          boundaries: uncertainty.names,
          parsedContracts,
        },
      },);
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
    if (documentedUncertain
      && (!foreignBorrowed)
      && (classification.kind === 'honest-readonly')) {
      context.report({
        loc,
        messageId: 'uncertainReadonly',
        data: {
          parameterName,
          boundaries: uncertainty.names,
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
    if ((!mutated)
      && (!documentedUncertain)
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
    if (foreignBorrowed
      && (!affected)
      && (!documentedUncertain)) {
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
