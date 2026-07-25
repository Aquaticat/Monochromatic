/**
 * Budget model: auto-select the fastest available judge model.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import {
  NO_AUTH,
  scoreModelSpeed,
  resolveEffectiveScope,
} from '@monochromatic-dev/pi-shared-model-selection/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { resolveBudgetAuth, } from './budget-model-auth.ts';
import { NoBudgetModelError, } from './budget-model-error.ts';
import { budgetModelSlug, } from './budget-model-identity.ts';
import type { BudgetModel, } from './types.ts';

//region Model shape guards

/**
 * Detect the structural pi model fields used by budget selection and auth callbacks.
 *
 * @param value - value to inspect
 *
 * @returns whether value has the needed pi model fields
 */
function isModelApi(
  value: unknown,
): value is Model<Api> {
  if ((value === null) || ((typeof value) !== 'object'))
    return false;
  if (!('cost' in value))
    return false;
  /**
   * Cost object inspected separately so nested price fields stay type-safe.
   */
  const { cost, } = value;
  if ((cost === null) || ((typeof cost) !== 'object'))
    return false;
  return ('id' in value)
    && ((typeof value.id) === 'string')
    && ('name' in value)
    && ((typeof value.name) === 'string')
    && ('provider' in value)
    && ((typeof value.provider) === 'string')
    && ('api' in value)
    && ((typeof value.api) === 'string')
    && ('baseUrl' in value)
    && ((typeof value.baseUrl) === 'string')
    && ('reasoning' in value)
    && ((typeof value.reasoning) === 'boolean')
    && ('input' in value)
    && Array.isArray(value.input,)
    && ('contextWindow' in value)
    && ((typeof value.contextWindow) === 'number')
    && ('maxTokens' in value)
    && ((typeof value.maxTokens) === 'number')
    && ('input' in cost)
    && ((typeof cost.input) === 'number')
    && ('output' in cost)
    && ((typeof cost.output) === 'number')
    && ('cacheRead' in cost)
    && ((typeof cost.cacheRead) === 'number')
    && ('cacheWrite' in cost)
    && ((typeof cost.cacheWrite) === 'number');
}

/**
 * Assert that a value has the pi model shape auto-mode budget selection needs.
 *
 * @param value - value to inspect
 *
 * @throws {@link NoBudgetModelError} when value is not a pi model
 *
 * @returns nothing when value has the required shape
 */
function assertModelApi(
  value: unknown,
): asserts value is Model<Api> {
  if (!isModelApi(value,)) {
    throw new NoBudgetModelError(
      'budget model selection received an invalid active model shape',
    );
  }
}

/**
 * Assert that a value is a list of pi models auto-mode budget selection can inspect.
 *
 * @param value - value to inspect
 *
 * @throws {@link NoBudgetModelError} when value is not a pi model list
 *
 * @returns nothing when value has the required shape
 */
function assertModelApiList(
  value: unknown,
): asserts value is readonly Model<Api>[] {
  if ((!Array.isArray(value,))
    || (!value.every(function registryModelHasShape(model,) {
      return isModelApi(model,);
    },))) {
    throw new NoBudgetModelError(
      'budget model selection received an invalid registry model shape',
    );
  }
}

//endregion Model shape guards

//region Public API

/**
 * Find the fastest available model for the judge.
 *
 * Validates the active model and registry with {@link assertModelApi} and
 * {@link assertModelApiList}, then {@link resolveEffectiveScope} narrows
 * automatic candidates to Pi's effective scoped models.
 * The fixed cross-provider policy walks those candidates fastest-first using
 * {@link resolveBudgetAuth} and returns the first candidate the registry can
 * authenticate.
 *
 * @param ctx - pi extension context
 *
 * @param excludedModelSlugs - models whose completed attempts must not be selected again
 *
 * @throws {@link NoBudgetModelError} if no suitable model is found
 *
 * @returns budget model with auth credentials
 *
 * @mutates ctx - scope resolution and registry selection can invoke model accessors and command-backed auth capabilities
 *
 * @mutates excludedModelSlugs - iteration can invoke caller-owned iterator hooks
 *
 * @example
 * ```typescript
 * const budget = await findBudgetModel({ ctx });
 * ```
 */
async function findBudgetModel(
  {
    ctx,
    excludedModelSlugs = [],
  }: {
    readonly ctx: ForeignBorrowed<ExtensionContext>;
    readonly excludedModelSlugs?: readonly string[];
  },
): Promise<BudgetModel> {
  /**
   * Canonical slugs excluded after earlier judge attempts exhausted their retries.
   */
  const excludedSlugs = new Set(excludedModelSlugs,);

  if ((ctx.model
    === undefined) || (ctx.model
      === null))
    throw new NoBudgetModelError('no active model set',);

  /**
   * Active model handed in by host for shared selection context.
   */
  const rawActiveModel: unknown = ctx.model;
  assertModelApi(rawActiveModel,);
  /**
   * Effective Pi scope that constrains automatic judge selection.
   */
  const judgeModelScope = await resolveEffectiveScope<Model<Api>>({
    ctx,
    errorPrefix: 'auto-mode',
  },);
  /**
   * Models selected by Pi's scope, narrowed to auto-mode's pi model shape.
   */
  const rawScopedJudgeModels: unknown = judgeModelScope
    .entries
    .map(
      /**
       * Extract model record from one effective-scope entry.
       *
       * @param entry - scoped Pi model entry
       *
       * @returns Pi model selected by scope
       */
      function mapScopedJudgeModel(
        entry: ForeignBorrowed<(typeof judgeModelScope.entries)[number]>,
      ) {
        return entry.model;
      },
    );
  assertModelApiList(rawScopedJudgeModels,);
  /**
   * Scoped models after runtime shape validation, excluding models whose
   * completed judge attempts already failed.
   */
  const allModels = rawScopedJudgeModels.filter(
    /**
     * Excludes models whose previous judge attempts failed.
     *
     * @param model - Registry model whose identity is inspected.
     *
     * @returns Whether model remains eligible.
     *
     */
    function modelHasNotFailed(model: ForeignBorrowed<Model<Api>>,) {
      return !excludedSlugs.has(budgetModelSlug(model,),);
    },
  );

  /**
   * Every scoped candidate globally ranked by speed, then input cost.
   */
  const sortedCandidates = allModels.toSorted(
    /**
     * Rank cross-provider candidates by fixed speed policy.
     *
     * @param left - candidate on left side of comparison
     *
     * @param right - candidate on right side of comparison
     *
     * @returns sort order
     */
    function candidatesBySpeed(
      left,
      right,
    ) {
      /**
       * Higher speed-name score sorts first.
       */
      const speedDifference = scoreModelSpeed(right,)
        - scoreModelSpeed(left,);
      if (speedDifference !== 0)
        return speedDifference;
      return left.cost
        .input
        - right.cost
        .input;
    },
  );

  for (const model of sortedCandidates) {
    /* oxlint-disable no-await-in-loop -- sequential auth walk stops at first authenticated candidate. */
    /**
     * Host registry credentials for current candidate.
     */
    const auth = await resolveBudgetAuth({
      ctx,
      model,
    },);
    /* oxlint-enable no-await-in-loop */
    if (auth !== NO_AUTH) {
      return {
        model,
        auth,
      };
    }
  }

  throw new NoBudgetModelError(
    'no fast judge models with API keys found across any provider',
  );
}

//endregion Public API

export { NoBudgetModelError, } from './budget-model-error.ts';
export { findBudgetModel, };
