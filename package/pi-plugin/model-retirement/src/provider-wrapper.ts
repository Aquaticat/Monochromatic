/**
 Provider wrapping, the filtering mechanism for providers pi cannot describe.

 `pi.registerProvider` accepts either a configuration object or a whole `Provider`. A
 provider another extension registered as a native object has no readable configuration,
 and a builtin whose models carry no endpoint cannot be re-declared as configurations at
all, but both can be wrapped: the composed provider is spread, so its `auth`, `stream`,
 `streamSimple`, `images`, and `classifiers` survive by reference, and only the model
 listing methods are replaced.

 Wrapping also filters live. The wrapper calls through to the original listing method on
 every read, so a catalog refresh that reintroduces a retired model is filtered again on
 the next read rather than at the next session start.

 @module
 */

import type {
  Api,
  AnyModel,
  Model,
  Provider,
} from '@earendil-works/pi-ai';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  isRetired,
  type RetiredIndex,
} from './retired-index.ts';

//region Guards

/**
 Test whether an unknown value is a composed provider this package can wrap.

 @param value - what `ModelRegistry.getProvider` returned

 @returns whether the value exposes a model listing method

 @example
 ```typescript
 isComposedProvider(registry.getProvider('hyper')); // true
 ```
 */
export function isComposedProvider(
  value: unknown,
): value is ForeignBorrowed<Provider> {
  return ((typeof value) === 'object')
    && (value !== null)
    && ('getModels' in value)
    && ((typeof value.getModels) === 'function');
}

//endregion Guards

//region Wrapping

/**
 Wrap one composed provider so its model listing omits retired entries.

 @param provider - composed provider read from the registry, owned by pi or by the
 extension that registered it

 @param index - retired identities for this pass

 @returns a provider that behaves like the original and lists fewer models

 @example
 ```typescript
 pi.registerProvider(wrapProvider({ provider: composed, index }));
 ```
 */
export function wrapProvider(
  {
    provider,
    index,
  }: {
    readonly provider: ForeignBorrowed<Provider>;
    readonly index: RetiredIndex;
  },
): Provider {
  /**
   Test one model against the index.

   @param model - model the original provider lists, owned by pi or by its registering
   extension

   @returns whether the wrapper should keep listing it
   */
  function keep(model: ForeignBorrowed<AnyModel>,): boolean {
    return !isRetired({
      index,
      provider: model.provider,
      api: model.api,
      modelId: model.id,
    },);
  }

  /**
   Whether the original lists every model type, which decides whether the wrapper may
   declare that member at all: adding it to a provider that lacks one would make pi read an
   empty non-chat catalog.
   */
  const listsAllModels = 'getAllModels' in provider;
  return {
    ...provider,
    getModels: function filteredChatModels(): readonly Model<Api>[] {
      return provider.getModels()
        .filter(keep,);
    },
    ...(listsAllModels
      ? {
        getAllModels: function filteredAllModels(): readonly AnyModel[] {
          return (provider.getAllModels?.() ?? [])
            .filter(keep,);
        },
      }
      : {}),
  };
}

//endregion Wrapping
