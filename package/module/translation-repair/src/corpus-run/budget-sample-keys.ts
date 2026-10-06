import { StatedRefusalError, } from '../stated-refusal.ts';

//region Budget sample keys
// Reads the four provider keys a budget sample needs, all or none.

/**
 The four provider keys, each non-empty.
 */
export type ProviderKeys = {
  /**
   Synthetic key.
   */
  readonly synthetic: string;

  /**
   Hyper key.
   */
  readonly hyper: string;

  /**
   Bedrock key.
   */
  readonly bedrock: string;

  /**
   OpenRouter key.
   */
  readonly openrouter: string;
};

/**
 Reads every provider's key.

 @param env - environment the keys are read from: `process.env` in a run

 @returns The four keys

 @throws {@link StatedRefusalError} when any key is absent or empty, naming
 each variable and whether it is present, since a sample of some providers
 cannot answer a question about the others

 @example
 ```ts
 const keys = readProviderKeys({ env: process.env, },);
 ```
 */
export function readProviderKeys(
  { env, }: { readonly env: Readonly<NodeJS.ProcessEnv>; },
): ProviderKeys {
  /**
   First provider's key, injected by mise from the sops-encrypted env.
   */
  const syntheticKey = env
    .TRANSLATION_REPAIR_SYNTHETIC_API_KEY
    ?? '';

  /**
   Second provider's key, from the same place.
   */
  const hyperKey = env
    .TRANSLATION_REPAIR_CHARM_HYPER_API_KEY
    ?? '';

  /**
   Third provider's key, from the same place.
   */
  const openRouterKey = env
    .TRANSLATION_REPAIR_OPENROUTER_API_KEY
    ?? '';

  /**
   Fourth provider's key, from the same place.
   */
  const bedrockKey = env
    .TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY
    ?? '';

  /**
   Whether any provider's key is missing, which makes the sample partial.
   */
  const someKeyMissing = (syntheticKey === '')
    || (hyperKey === '')
    || (bedrockKey === '')
    || (openRouterKey === '');
  if (someKeyMissing) {
    throw new StatedRefusalError({
      says: 'every provider key must be set to sample availability, and at least one is not: '
        + `TRANSLATION_REPAIR_SYNTHETIC_API_KEY is ${syntheticKey === '' ? 'absent' : 'present'}, `
        + `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY is ${hyperKey === '' ? 'absent' : 'present'}, `
        + `TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY is ${bedrockKey === '' ? 'absent' : 'present'}, `
        + `TRANSLATION_REPAIR_OPENROUTER_API_KEY is ${openRouterKey === '' ? 'absent' : 'present'}. `
        + 'Run under mise so sops injects them. A sample of some providers is not recorded, '
        + 'because the record is read as a statement about all of them and a missing column would '
        + 'be indistinguishable from a provider that answered.',
    },);
  }

  return {
    synthetic: syntheticKey,
    hyper: hyperKey,
    bedrock: bedrockKey,
    openrouter: openRouterKey,
  };
}

//endregion Budget sample keys
