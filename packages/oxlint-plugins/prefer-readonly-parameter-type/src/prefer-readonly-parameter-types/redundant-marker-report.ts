/**
 * Inert ownership-marker reporting.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { Context, } from '@oxlint/plugins';
import type {
  Project,
  Type,
} from 'typescript/unstable/sync';

import { classifyReadonlyType, } from './readonly-classifier.ts';
import { isForeignBorrowedType, } from './foreign-borrowed-identity.ts';
import type { SemanticReportLocation, } from './semantic-location.ts';

/**
 * Reports a ForeignBorrowed marker that no longer affects classification.
 *
 * A marker whose underlying type is already deeply readonly confers no
 * mutable capability on any caller or callee;
 * removing it changes no classification,
 * so keeping it is misleading documentation.
 *
 * @param context - Foreign rule context receiving diagnostics.
 *
 * @param project - TypeScript project resolving marker identity.
 *
 * @param parameterType - Semantic parameter type possibly carrying marker.
 *
 * @param parameterName - Authored parameter text used in diagnostics.
 *
 * @param loc - Report location spanning parameter binding.
 *
 * @mutates context - Emits redundant-marker diagnostic through rule context.
 *
 * @example
 * ```ts
 * reportRedundantForeignBorrowed({ context, project, parameterType, parameterName, loc });
 * ```
 */
export function reportRedundantForeignBorrowed({
  context,
  project,
  parameterType,
  parameterName,
  loc,
}: {
  readonly context: ForeignBorrowed<Context>;
  readonly project: Project;
  readonly parameterType: Type;
  readonly parameterName: string;
  readonly loc: SemanticReportLocation;
},): void {
  if (!isForeignBorrowedType({
    project,
    type: parameterType,
  },))
    return;
  /**
   * Marked underlying type supplied as marker type argument.
   */
  const underlying = parameterType
    .getAliasTypeArguments()
    .at(0,);
  if (underlying === undefined)
    return;
  /**
   * Classification of underlying type without marker exemption.
   */
  const underlyingClassification = classifyReadonlyType({
    checker: project.checker,
    project,
    type: underlying,
  },);
  if (underlyingClassification.kind !== 'honest-readonly')
    return;
  context.report({
    loc,
    messageId: 'redundantForeignBorrowed',
    data: { parameterName, },
  },);
}
