/**
 * Effective scoped-model resolution for Advisor.
 *
 * @module
 */

import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import type { ReadonlyDeep, } from 'type-fest';
import { parseArgvModelPatterns, } from './argv-scope.ts';
import {
  ABSENT,
  type Maybe,
} from './maybe.ts';
import { canonicalSlug, } from './model-slug.ts';
import { resolveModelPatterns, } from './scope-patterns.ts';
import { loadSettingsScopePatterns, } from './settings-scope.ts';
import type {
  AdvisorReadonlyModel,
  EffectiveModelScope,
  ScopedAdvisorModel,
  ScopedThinkingLevel,
} from './types.ts';

//region Types

/** Options for resolving Advisor model scope. */
export type ResolveEffectiveScopeOptions = {
  /** Pi extension context. */
  readonly ctx: ReadonlyDeep<ExtensionContext>;
  /** Process argv override for tests. */
  readonly argv?: readonly string[];
  /** Home directory override for tests. */
  readonly home?: string;
};

/** Raw live scope item shapes accepted by the detector. */
type RawLiveScopeItem = AdvisorReadonlyModel | {
  /** Pi model object. */
  readonly model: AdvisorReadonlyModel;
  /** Optional thinking level carried by pi. */
  readonly thinkingLevel?: ScopedThinkingLevel;
};

//endregion Types

//region Public API

/**
 * Resolve the effective scoped model set for Advisor.
 *
 * @param options - context and optional test overrides
 *
 * @returns scoped models and source metadata
 *
 * @example
 * ```typescript
 * const scope = resolveEffectiveScope({ ctx });
 * ```
 */
export function resolveEffectiveScope(
  options: ResolveEffectiveScopeOptions,
): EffectiveModelScope {
  /** Live model scope exposed by current or future pi APIs. */
  const liveScope = readLiveScope(options.ctx,);
  if (liveScope !== ABSENT) {
    return {
      source: 'live',
      entries: liveScope,
    };
  }

  /** Patterns from pi's startup `--models` flag. */
  const argvPatterns = parseArgvModelPatterns({
    argv: options.argv
      ?? process
      .argv,
  },);
  if (argvPatterns !== ABSENT) {
    return {
      source: 'argv',
      entries: resolveModelPatterns({
        patterns: argvPatterns,
        availableModels: options
          .ctx
          .modelRegistry
          .getAvailable(),
      },),
      patterns: argvPatterns,
    };
  }

  /** Patterns from merged pi settings. */
  const settingsScope = loadSettingsScopePatterns({
    cwd: options.ctx
      .cwd,
    ...(options.home
      === undefined ? {} : { home: options.home, }),
  },);
  if (settingsScope.patterns
    !== undefined) {
    return {
      source: 'settings',
      entries: resolveModelPatterns({
        patterns: settingsScope.patterns,
        availableModels: options
          .ctx
          .modelRegistry
          .getAvailable(),
      },),
      patterns: settingsScope.patterns,
    };
  }

  return {
    source: 'available',
    entries: options
      .ctx
      .modelRegistry
      .getAvailable()
      .map(function mapAvailableModel(model,) {
        return scopedModelFromModel({ model, },);
      },),
  };
}

//endregion Public API

//region Live scope detection

/**
 * Read live scoped models from a runtime context when pi exposes them.
 *
 * @param ctx - pi extension context
 *
 * @returns live scoped models, or {@link ABSENT} when unavailable
 */
function readLiveScope(
  ctx: ReadonlyDeep<ExtensionContext>,
): Maybe<ScopedAdvisorModel[]> {
  /** Raw live scope value from method or property. */
  const rawScope = liveScopeRawValue(ctx,);
  if (!Array.isArray(rawScope,))
    return ABSENT;

  return rawScope
    .filter(function keepRawLiveScopeItem(value,): value is RawLiveScopeItem {
      return isRawLiveScopeItem(value,);
    },)
    .map(function mapLiveScopeItem(item,) {
      return isModel(item,)
        ? scopedModelFromModel({ model: item, },)
        : scopedModelFromModel({
          model: item.model,
          ...(item.thinkingLevel
            === undefined
            ? {}
            : { thinkingLevel: item.thinkingLevel, }),
        },);
    },);
}

/**
 * Read raw live-scope value from known future API shapes.
 *
 * @param ctx - pi extension context
 *
 * @returns raw live-scope value, when exposed
 */
function liveScopeRawValue(
  ctx: ReadonlyDeep<ExtensionContext>,
): unknown {
  if (hasLiveScopeGetter(ctx,))
    return ctx.getScopedModels();
  return hasLiveScopeProperty(ctx,) ? ctx.scopedModels : undefined;
}

/**
 * Detect contexts with a callable live-scope getter.
 *
 * @param ctx - pi extension context
 *
 * @returns whether context exposes a live-scope getter
 */
function hasLiveScopeGetter(
  ctx: ReadonlyDeep<ExtensionContext>,
): ctx is ReadonlyDeep<ExtensionContext> & { readonly getScopedModels: () => unknown; } {
  return ('getScopedModels' in ctx) && ((typeof ctx.getScopedModels) === 'function');
}

/**
 * Detect contexts with a live-scope property.
 *
 * @param ctx - pi extension context
 *
 * @returns whether context exposes a live-scope property
 */
function hasLiveScopeProperty(
  ctx: ReadonlyDeep<ExtensionContext>,
): ctx is ReadonlyDeep<ExtensionContext> & { readonly scopedModels: unknown; } {
  return 'scopedModels' in ctx;
}

/**
 * Detect raw live-scope item shapes.
 *
 * @param value - value to inspect
 *
 * @returns whether value is usable as a live scope item
 */
function isRawLiveScopeItem(
  value: unknown,
): value is RawLiveScopeItem {
  if (isModel(value,))
    return true;
  if ((value === null) || ((typeof value) !== 'object'))
    return false;
  if (!('model' in value))
    return false;
  return isModel(value.model,);
}

/**
 * Detect pi model objects structurally.
 *
 * @param value - value to inspect
 *
 * @returns whether value looks like a pi model
 */
function isModel(
  value: unknown,
): value is AdvisorReadonlyModel {
  if ((value === null) || ((typeof value) !== 'object'))
    return false;
  return ('id' in value)
    && ((typeof value.id) === 'string')
    && ('name' in value)
    && ((typeof value.name) === 'string')
    && ('provider' in value)
    && ((typeof value.provider) === 'string')
    && ('api' in value)
    && ((typeof value.api) === 'string')
    && ('contextWindow' in value)
    && ((typeof value.contextWindow) === 'number')
    && ('maxTokens' in value)
    && ((typeof value.maxTokens) === 'number')
    && ('cost' in value)
    && (value.cost
      !== null)
    && ((typeof value.cost) === 'object');
}

/**
 * Convert model to scoped model entry.
 *
 * @param model - pi model object
 *
 * @param thinkingLevel - optional thinking level from scope pattern
 *
 * @returns scoped Advisor model
 */
function scopedModelFromModel(
  {
    model,
    thinkingLevel,
  }: {
    readonly model: AdvisorReadonlyModel;
    readonly thinkingLevel?: ScopedThinkingLevel;
  },
): ScopedAdvisorModel {
  return {
    model,
    canonicalSlug: canonicalSlug(model,),
    ...(thinkingLevel === undefined ? {} : { thinkingLevel, }),
  };
}

//endregion Live scope detection
