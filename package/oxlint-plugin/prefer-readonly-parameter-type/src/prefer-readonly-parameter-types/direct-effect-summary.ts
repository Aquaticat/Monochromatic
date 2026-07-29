/**
 * Direct syntax and call-edge extraction for callable effect summaries.
 *
 * @module
 */

import {
  type BinaryExpression,
  type ForOfStatement,
  type Node,
  SyntaxKind,
  type VariableDeclaration,
} from 'typescript/unstable/ast';
import {
  isAssignmentOperator,
  isBinaryExpression,
  isCallExpression,
  isDeleteExpression,
  isForOfStatement,
  isIdentifier,
  isPostfixUnaryExpression,
  isPrefixUnaryExpression,
  isReturnStatement,
  isVariableDeclaration,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import { activeCallableBodyNodes, } from './closure-activity.ts';
import {
  recordAssignmentStore,
  recordIterationStore,
} from './effect-assignment-store.ts';
import { inspectDirectWrite, } from './effect-direct-write.ts';
import { recordBodylessEffects, } from './direct-bodyless-summary.ts';
import { recordResultApplication, } from './effect-result-substitution.ts';
import {
  bindingOriginsFor,
  discoverAliasOrigins,
  expressionOrigins,
  seedParameterSlots,
} from './effect-binding-origins.ts';
import { parameterSlotTable, } from './effect-parameter-slots.ts';
import {
  asEffectSlot,
  asParameterIndex,
  type EffectSlot,
  type ParameterIndex,
} from './effect-slot-identity.ts';
import { bindingContainsForeignBorrowed, } from './foreign-borrowed-classifier.ts';
import { inspectEffectCall, } from './effect-call-analysis.ts';
import { declarationDirectlyOwnsNode, } from './effect-foreign-inbound.ts';
import { addOpaqueEffect, } from './effect-call-resolution.ts';
import type { ExternalCallableEffectResolver, } from './external-callable-effect.ts';
import { expressionCanCarryMutableState, } from './effect-primitive-origin.ts';
import {
  MUTATION_CONTRACT_UNAVAILABLE,
  mutationContractsForDeclaration,
  mutationTargetIndexes,
} from './mutation-contract-query.ts';
import {
  addEffectSlot,
  addEffectSlots,
  callableKey,
  type EffectCallableDeclaration,
  collectAstNodes,
  type MutableEffectSummary,
  EFFECT_SLOT_UNAVAILABLE,
  type SlotOrigins,
} from './effect-summary-model.ts';

/**
 * Builds direct syntax facts and call edges for one callable.
 *
 * @param project - TypeScript project owning declaration.
 *
 * @param declaration - Callable declaration to inspect.
 *
 * @param analysisRoot - Optional external implementation root accepted for transitive calls.
 *
 * @param externalEffectResolver - Demand-driven package implementation analyzer.
 *
 * @returns mutable summary seeded with direct effects.
 *
 * @example
 * ```ts
 * const summary = directEffectSummary({ project, declaration });
 * ```
 */
export function directEffectSummary({
  project,
  declaration,
  analysisRoot,
  externalEffectResolver,
}: {
  readonly project: Project;
  readonly declaration: EffectCallableDeclaration;
  readonly analysisRoot?: string;
  readonly externalEffectResolver: ExternalCallableEffectResolver;
},): MutableEffectSummary {
  /**
   * TypeScript checker for current project.
   */
  const { checker, } = project;
  /**
   * Slots this callable's parameters own, allocated from the declaration alone.
   */
  const table = parameterSlotTable({ declaration, },);
  /**
   * Binding symbol origins seeded by callable parameters.
   */
  const bindingOriginBySymbolId = new Map<number, Set<EffectSlot>>();
  declaration.parameters
    .forEach(function registerParameter(
      parameter,
      parameterIndex,
    ): void {
    seedParameterSlots({
      project,
      parameter,
      parameterIndex,
      table,
      bindingOriginBySymbolId,
    },);
  },);
  /* A default initializer naming an earlier parameter makes the two aliases. Omitting the
   * argument, or passing `undefined`, means a write through the later name reaches the
   * earlier parameter's value, so both indexes have to answer for it. Registered after
   * every parameter has its own index, because an initializer can only name a parameter
   * declared before it. `mutateDefaultAlias` in the call-edge fixture measured the gap: it
   * recorded a write on the aliasing formal alone and offered the aliased one readonly. */
  declaration.parameters
    .forEach(function registerDefaultAlias(parameter,): void {
      if (parameter.initializer === undefined)
        return;
      addEffectSlots({
        target: bindingOriginsFor({
          project,
          name: parameter.name,
          bindingOriginBySymbolId,
        },),
        values: expressionOrigins({
          project,
          bindingOriginBySymbolId,
          node: parameter.initializer,
        },),
      },);
    },);
  /**
   * Parameter indexes explicitly carrying exact foreign ownership marker.
   */
  const directForeignBorrowed = new Set<ParameterIndex>();
  /**
   * Parameter entries paired with declaration indexes.
   */
  const parameterEntries = declaration.parameters
    .entries();
  for (const [parameterIndex, parameter,] of parameterEntries) {
    if (bindingContainsForeignBorrowed({
      project,
      name: parameter.name,
    },))
      directForeignBorrowed.add(asParameterIndex(parameterIndex,),);
  }
  /**
   * Mutable summary receiving direct and propagated effects.
   */
  const summary: MutableEffectSummary = {
    slots: table,
    bindingOriginBySymbolId,
    directMutated: new Set(),
    directInvoked: new Set(),
    directOpaque: new Set(),
    opaqueProvenanceBySlot: new Map(),
    mutated: new Set(),
    invoked: new Set(),
    opaque: new Set(),
    directForeignBorrowed,
    directReturned: new Set(),
    returned: new Set(),
    relations: [],
    elementApplications: [],
    resultApplications: [],
    calls: [],
  };
  /**
   * Callable implementation body, absent for source signatures.
   */
  const body = 'body' in declaration ? declaration.body : undefined;
  if (body === undefined) {
    recordBodylessEffects({
      checker,
      declaration,
      summary,
    },);
    return summary;
  }
  /* Parameter initializers run on entry and can do anything a body statement can, so they
   * belong to the callable's own effects. A walk bounded by the body never saw them, and
   * `defaultInitializerEffect` in the call-edge fixture reached a mutating call from an
   * initializer and was offered readonly for the parameter it wrote. */
  /**
   * Nodes of every parameter initializer, which run on entry before the body.
   */
  const parameterInitializerNodes = declaration.parameters
    .flatMap(function initializerNodes(parameter,): readonly Node[] {
      return parameter.initializer === undefined
        ? []
        : collectAstNodes(parameter.initializer,);
    },);
  /**
   * Complete body nodes used to discover origins before escape selection.
   */
  const allBodyNodes = [
    ...parameterInitializerNodes,
    ...collectAstNodes(body,),
  ];
  /**
   * Variable declarations that may alias parameter-reachable state.
   */
  const variableDeclarations = allBodyNodes.filter(function variableDeclaration(node,): node is VariableDeclaration {
    return isVariableDeclaration(node,);
  },);
  /**
   * Simple assignments that may establish aliases after declaration.
   */
  const aliasAssignments = allBodyNodes.filter(function aliasAssignment(node,): node is BinaryExpression {
    return isBinaryExpression(node,)
      && (node.operatorToken
        .kind
        === SyntaxKind.EqualsToken);
  },);
  /**
   * Iteration statements binding elements reached through parameter-owned iterables.
   */
  const forOfStatements = allBodyNodes.filter(function forOfStatement(node,): node is ForOfStatement {
    return isForOfStatement(node,);
  },);
  discoverAliasOrigins({
    project,
    variableDeclarations,
    aliasAssignments,
    forOfStatements,
    bindingOriginBySymbolId,
  },);
  /**
   * Body nodes selected after aliases expose caller-reachable closure storage.
   *
   * Parameter initializers join the selected set unconditionally rather than through the
   * closure selection, because they are not nested callables: they run on entry every time
   * the argument is omitted, so nothing about them is deferred or conditional on a
   * closure being invoked.
   */
  const bodyNodes = [
    ...parameterInitializerNodes,
    ...activeCallableBodyNodes({
      project,
      body,
      bindingOriginBySymbolId,
    },),
  ];
  bodyNodes.forEach(function inspect(node,): void {
    if (isBinaryExpression(node,)
      && isAssignmentOperator(node.operatorToken
        .kind,)) {
      inspectDirectWrite({
        project,
        bindingOriginBySymbolId,
        summary,
        node: node.left,
      },);
      /* Two questions about one assignment, and `inspectDirectWrite` answers only the
       * first. It asks which parameter the write lands on and returns early for an
       * identifier target, correctly, because `held = row` changes no object the caller
       * can see. What that leaves is where the value went, and an identifier target is
       * exactly where it matters: a binding outside this callable keeps the value after
       * the call returns. */
      recordAssignmentStore({
        project,
        bindingOriginBySymbolId,
        summary,
        node,
        body,
      },);
      return;
    }
    if (isDeleteExpression(node,)) {
      inspectDirectWrite({
        project,
        bindingOriginBySymbolId,
        summary,
        node: node.expression,
      },);
      return;
    }
    if ((isPrefixUnaryExpression(node,) || isPostfixUnaryExpression(node,))
      && ((node.operator === SyntaxKind.PlusPlusToken)
        || (node.operator === SyntaxKind.MinusMinusToken))) {
      inspectDirectWrite({
        project,
        bindingOriginBySymbolId,
        summary,
        node: node.operand,
      },);
      return;
    }
    /* Returning parameter-reachable state is not itself an effect: the caller already
     * holds the parameter, so handing back a piece of it grants no capability the
     * caller lacked. Recording which parameters a result can carry is what lets a
     * caller keep tracking that value, and that tracking is the condition under which
     * treating a return as benign stays sound. Until callers substitute through this
     * fact, no receiver opacity may be discharged on the strength of it.
     * `doc/decision/prefer-readonly-result-provenance.md` records the policy. */
    if (isReturnStatement(node,) && (node.expression !== undefined)) {
      /* Only a returned value that can carry state records anything. A returned
       * primitive derived from a parameter grants the caller nothing: measured on
       * `readOnlyLookupEffect`, which returns `(facts.get(key) ?? new Set()).size`,
       * where the resolver correctly reaches `facts` through the property access and
       * the `??`, and recording that as a returned origin would claim the caller can
       * reach the map through a `number`. */
      if (expressionCanCarryMutableState({
        checker,
        node: node.expression,
      },)) {
        addEffectSlots({
          target: summary.directReturned,
          values: expressionOrigins({
            project,
            bindingOriginBySymbolId,
            node: node.expression,
          },),
        },);
        /* Returning another callable's result carries whatever that result carries, and
         * the resolver above cannot see it: a callee's summary does not exist while its
         * callers are scanned. Without this, `b` returning `a(x,)` records no returned
         * origin at all, so no caller of `b` can substitute through it either. */
        recordResultApplication({
          summary,
          node: node.expression,
          kind: 'returned',
        },);
      }
      return;
    }
    if (isForOfStatement(node,)) {
      /* Asked of every iteration statement, including the awaiting form, because what the
       * target retains does not depend on how the iterator was drained. The awaiting branch
       * below returned first when this lived inside it, so `for await (held of rows)`
       * recorded the drain and lost the retention. */
      recordIterationStore({
        project,
        bindingOriginBySymbolId,
        summary,
        node,
        body,
      },);
      if (node.awaitModifier !== undefined) {
        addEffectSlots({
          target: summary.directMutated,
          values: expressionOrigins({
            project,
            bindingOriginBySymbolId,
            node: node.expression,
          },),
        },);
      }
      return;
    }
    if (isCallExpression(node,)) {
      inspectEffectCall({
        project,
        checker,
        bindingOriginBySymbolId,
        call: node,
        summary,
        ...(analysisRoot === undefined) ? {} : { analysisRoot, },
        externalEffectResolver,
        body,
        foreignInbound: declarationDirectlyOwnsNode({
          node,
          declaration,
        },),
      },);
    }
  },);
  summary.directMutated
    .forEach(function seed(index,): void {
    summary.mutated
      .add(index,);
  },);
  summary.directInvoked
    .forEach(function seedInvocation(index,): void {
    summary.invoked
      .add(index,);
  },);
  summary.directOpaque
    .forEach(function seedOpacity(index,): void {
    summary.opaque
      .add(index,);
  },);
  return summary;
}
