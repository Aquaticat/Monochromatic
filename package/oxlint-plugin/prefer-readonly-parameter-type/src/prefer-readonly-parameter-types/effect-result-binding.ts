/**
 * Which call's result each local binding can be holding.
 *
 * A parallel to `bindingOriginBySymbolId` and deliberately not part of it. That map answers
 * which parameter slots a binding can reach, and it is built by `expressionOrigins`, which
 * stops at a `CallExpression` because a callee's summary does not exist while its callers
 * are walked. So `const local = firstRow(config,)` leaves `local` with no origins, and
 * `local.label = 'written'` attributes nothing, which offered `readonly` for a parameter
 * the callable writes through.
 *
 * Filling those origins later cannot fix it. Attribution happens during the syntactic pass,
 * and the callee summary only exists during the fixed point, so by the time the origins
 * could be known the write has already been walked and not recorded. What crosses that gap
 * is the same deferral the rest of this analysis uses: record the call the binding came
 * from, resolve the origins where the callee summary sits.
 *
 * Kept beside the origins rather than folded into them because the two answer different
 * questions and converge for different reasons. Origins accumulate parameter slots and
 * settle when no binding gains one. These accumulate call-site keys, and an entry here is
 * never refined by the fixed point: it names a syntactic fact about where a value came
 * from, which is complete as soon as the declarations have been walked.
 *
 * @module
 */

import type {
  BinaryExpression,
  ForOfStatement,
  Node,
  VariableDeclaration,
} from 'typescript/unstable/ast';
import {
  isIdentifier,
  isVariableDeclarationList,
} from 'typescript/unstable/ast/is';
import type { Project, } from 'typescript/unstable/sync';

import {
  deferrableResultSite,
  NOT_A_DEFERRABLE_RESULT,
} from './effect-result-substitution.ts';
import { expressionRoot, } from './effect-summary-model.ts';

/**
 * Call sites a binding can be holding the result of, empty when it holds none.
 */
const NO_RESULT_SITE: ReadonlySet<string> = new Set<string>();

/**
 * Call sites reachable from one expression, through its access layers and wrappers.
 *
 * `expressionRoot` strips the access layers and `deferrableResultSite` unwraps the
 * identity-keeping ones, which is the same composition the write site uses. An element of a
 * returned container is included on purpose: `rowsOf(config,)[0]` is a piece of what the
 * call handed back, so a binding holding it holds caller state.
 *
 * @param project - TypeScript project resolving the root symbol.
 *
 * @param resultSitesBySymbolId - Call sites already known per binding.
 *
 * @param node - Expression a binding is initialized or assigned from.
 *
 * @returns call sites the expression's value can have come from.
 *
 * @example
 * ```ts
 * expressionResultSites({ project, resultSitesBySymbolId, node: declaration.initializer });
 * ```
 */
function expressionResultSites({
  project,
  resultSitesBySymbolId,
  node,
}: {
  readonly project: Project;
  readonly resultSitesBySymbolId: ReadonlyMap<number, ReadonlySet<string>>;
  readonly node: Node;
},): ReadonlySet<string> {
  /**
   * Deepest receiver, past every property and element access.
   */
  const root = expressionRoot(node,);
  /**
   * Call this expression is the result of, when one underlies the root.
   */
  const site = deferrableResultSite({ node: root, },);
  if (site !== NOT_A_DEFERRABLE_RESULT)
    return new Set([site,],);
  /* An alias hop, which is what makes `const alias = local;` carry what `local` carries.
   * Only an identifier root is followed, matching `discoverAliasOrigins`: anything else is
   * a shape this does not model, and naming no call site withholds rather than claims. */
  if (!isIdentifier(root,))
    return NO_RESULT_SITE;
  /**
   * Symbol the root identifier resolves to.
   */
  const symbol = project.checker
    .getSymbolAtLocation(root,);
  return symbol === undefined
    ? NO_RESULT_SITE
    : resultSitesBySymbolId.get(symbol.id,) ?? NO_RESULT_SITE;
}

/**
 * Records every call site one binding name can be holding a result of.
 *
 * @param project - TypeScript project resolving the binding symbol.
 *
 * @param name - Binding name receiving the value.
 *
 * @param sites - Call sites the source expression can have come from.
 *
 * @param resultSitesBySymbolId - Map receiving the binding's call sites.
 *
 * @mutates resultSitesBySymbolId - Adds every source call site for the named binding.
 *
 * @returns whether the map gained a call site.
 *
 * @example
 * ```ts
 * registerResultSites({ project, name, sites, resultSitesBySymbolId });
 * ```
 */
function registerResultSites({
  project,
  name,
  sites,
  resultSitesBySymbolId,
}: {
  readonly project: Project;
  readonly name: Node;
  readonly sites: ReadonlySet<string>;
  readonly resultSitesBySymbolId: Map<number, Set<string>>;
},): boolean {
  if ((sites.size === 0) || (!isIdentifier(name,)))
    return false;
  /**
   * Symbol the binding name resolves to.
   */
  const symbol = project.checker
    .getSymbolAtLocation(name,);
  if (symbol === undefined)
    return false;
  /**
   * Call sites already recorded for this binding, or a new accumulator.
   */
  const known = resultSitesBySymbolId.get(symbol.id,) ?? new Set<string>();
  /**
   * Site count before this registration, deciding whether the map grew.
   */
  const knownBefore = known.size;
  sites.forEach(function addSite(site,): void {
    known.add(site,);
  },);
  resultSitesBySymbolId.set(
    symbol.id,
    known,
  );
  return known.size !== knownBefore;
}

/**
 * Resolves which call's result every local binding can be holding.
 *
 * Converges the same way `discoverAliasOrigins` does and for the same reason: an alias of an
 * alias needs a pass per hop, and the sets only ever grow so repetition settles.
 *
 * @param project - TypeScript project resolving binding symbols.
 *
 * @param variableDeclarations - Declarations that may bind a call result.
 *
 * @param aliasAssignments - Simple assignments that may rebind one.
 *
 * @param forOfStatements - Iteration statements whose iterable may be a call result.
 *
 * @param resultSitesBySymbolId - Map receiving call sites per binding.
 *
 * @mutates resultSitesBySymbolId - Adds every call site each binding can hold a result of.
 *
 * @example
 * ```ts
 * discoverResultBindings({ project, variableDeclarations, aliasAssignments, forOfStatements, resultSitesBySymbolId });
 * ```
 */
export function discoverResultBindings({
  project,
  variableDeclarations,
  aliasAssignments,
  forOfStatements,
  resultSitesBySymbolId,
}: {
  readonly project: Project;
  readonly variableDeclarations: readonly VariableDeclaration[];
  readonly aliasAssignments: readonly BinaryExpression[];
  readonly forOfStatements: readonly ForOfStatement[];
  readonly resultSitesBySymbolId: Map<number, Set<string>>;
},): void {
  /**
   * Convergence state, settling because the recorded sets only grow.
   */
  const state = {
    changed: true,
    pass: 0,
  };
  while (state.changed
    && (state.pass <= (variableDeclarations.length + aliasAssignments.length
      + forOfStatements.length))) {
    state.changed = false;
    state.pass++;
    variableDeclarations.forEach(function discover(declaration,): void {
      if (declaration.initializer === undefined)
        return;
      state.changed = registerResultSites({
        project,
        name: declaration.name,
        sites: expressionResultSites({
          project,
          resultSitesBySymbolId,
          node: declaration.initializer,
        },),
        resultSitesBySymbolId,
      },) || state.changed;
    },);
    aliasAssignments.forEach(function discoverAssignment(assignment,): void {
      state.changed = registerResultSites({
        project,
        name: assignment.left,
        sites: expressionResultSites({
          project,
          resultSitesBySymbolId,
          node: assignment.right,
        },),
        resultSitesBySymbolId,
      },) || state.changed;
    },);
    forOfStatements.forEach(function discoverIteration(statement,): void {
      /**
       * Call sites the iterated expression can have come from.
       */
      const sites = expressionResultSites({
        project,
        resultSitesBySymbolId,
        node: statement.expression,
      },);
      if (sites.size === 0)
        return;
      /* An element of a returned container is a piece of what the call handed back, so a
       * binding holding one holds whatever the call carried. Both binding forms count,
       * unlike the retention classification, where a declaration is not a store: here the
       * question is what the binding holds while it lives, not whether it outlives the
       * call. */
      if (isVariableDeclarationList(statement.initializer,)) {
        statement.initializer
          .declarations
          .forEach(function registerIterationDeclaration(declaration,): void {
          state.changed = registerResultSites({
            project,
            name: declaration.name,
            sites,
            resultSitesBySymbolId,
          },) || state.changed;
        },);
        return;
      }
      state.changed = registerResultSites({
        project,
        name: statement.initializer,
        sites,
        resultSitesBySymbolId,
      },) || state.changed;
    },);
  }
}

/**
 * Reads the call sites a write or store target can be holding a result of.
 *
 * @param project - TypeScript project resolving the target root symbol.
 *
 * @param resultSitesBySymbolId - Call sites recorded per binding.
 *
 * @param node - Write target or stored expression.
 *
 * @returns call sites whose returned state the target can carry.
 *
 * @example
 * ```ts
 * targetResultSites({ project, resultSitesBySymbolId, node: assignment.left });
 * ```
 */
export function targetResultSites({
  project,
  resultSitesBySymbolId,
  node,
}: {
  readonly project: Project;
  readonly resultSitesBySymbolId: ReadonlyMap<number, ReadonlySet<string>>;
  readonly node: Node;
},): ReadonlySet<string> {
  return expressionResultSites({
    project,
    resultSitesBySymbolId,
    node,
  },);
}
