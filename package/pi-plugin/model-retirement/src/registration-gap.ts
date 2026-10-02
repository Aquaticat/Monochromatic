/**
 Whether one provider's plan can be re-registered without losing models or endpoints.

 pi's `extensionModelFromDefinition` throws when a model definition resolves neither an
 `api` nor a `baseUrl`, and one throw aborts the whole pass, so every plan is validated
 before anything is registered. A provider is all-or-nothing: registering a partial list
 deletes every model missing from it.

 @module
 */

import type {
  ProviderConfig,
  ProviderModelConfig,
} from '@earendil-works/pi-coding-agent';
import type { AnyModel, } from '@earendil-works/pi-ai';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

//region Constants

/**
 Sentinel meaning a plan can be re-declared faithfully.
 */
export const REGISTERABLE: unique symbol = Symbol('provider plan can be re-declared faithfully',);

//endregion Constants

//region Model configuration

/**
 Express one live model as a provider-model configuration.

 The spread carries every field pi's composer accepts, which is what preserves
 `thinkingLevelMap`, `promptCache`, `compat`, `samplingParams`, and `inputLimits` across
 a re-registration. Per-model `headers` do not survive: pi's
 `extensionModelFromDefinition` sets them to `undefined` for all three types.

 The discriminant is read off the model itself rather than through an alias, because
 only a direct `model.type` comparison narrows pi's `AnyModel` union.

 @param model - live model object read from the registry, owned by pi

 @returns configuration pi accepts inside `ProviderConfig.models`

 @example
 ```typescript
 toModelConfig(chatModel); // { ...chatModel, type: 'chat' }
 ```
 */
export function toModelConfig(model: ForeignBorrowed<AnyModel>,): ProviderModelConfig {
  if (model.type === 'image')
    return {
      ...model,
      type: 'image',
    };
  if (model.type === 'classifier')
    return {
      ...model,
      type: 'classifier',
    };
  return {
    ...model,
    type: 'chat',
  };
}

//endregion Model configuration

//region Gap checking

/**
 Find what stops one model being re-declared.

 Provider-level `api` and `baseUrl` count as fallbacks because pi resolves a model's
 endpoint as `definition.baseUrl ?? config.baseUrl ?? defaults?.baseUrl`.

 @param model - configuration a plan would register

 @param base - incumbent provider configuration the plan is layered onto

 @returns {@link REGISTERABLE}, or text naming the missing field and model

 @example
 ```typescript
 registrationGap({ model: azureModel, base: {} }); // 'model gpt-4-turbo carries no baseUrl'
 ```
 */
function registrationGap(
  {
    model,
    base,
  }: {
    readonly model: ForeignBorrowed<ProviderModelConfig>;
    readonly base: ProviderConfig;
  },
): string | typeof REGISTERABLE {
  /**
   API the model resolves to, its own or the provider's.
   */
  const api = ((typeof model.api) === 'string') && (model.api
    .length
    > 0) ? model.api : base.api;
  if (((typeof api) !== 'string') || (api.length === 0))
    return `model ${model.id} carries no api`;
  /**
   Endpoint the model resolves to, its own or the provider's.
   */
  const baseUrl = ((typeof model.baseUrl) === 'string') && (model.baseUrl
    .length
    > 0)
    ? model.baseUrl
    : base.baseUrl;
  if (((typeof baseUrl) !== 'string') || (baseUrl.length === 0))
    return `model ${model.id} carries no baseUrl`;
  return REGISTERABLE;
}

/**
 Find the first reason one provider's plan cannot be registered.

 @param models - every model the plan would carry

 @param base - incumbent provider configuration the plan is layered onto

 @returns {@link REGISTERABLE}, or the first gap found

 @example
 ```typescript
 planGap({ models, base }); // REGISTERABLE
 ```
 */
export function planGap(
  {
    models,
    base,
  }: {
    readonly models: readonly ForeignBorrowed<ProviderModelConfig>[];
    readonly base: ProviderConfig;
  },
): string | typeof REGISTERABLE {
  for (const model of models) {
    /**
     Gap for the current model, when it has one.
     */
    const gap = registrationGap({
      model,
      base,
    },);
    if (gap !== REGISTERABLE)
      return gap;
  }
  return REGISTERABLE;
}

//endregion Gap checking
