/**
 Keyless readiness contract for a transport adapter that resolves original auth later. @module
 */
import type {
  AuthCheck,
  AuthResult,
  Model,
  Api,
  ProviderAuth,
} from '@earendil-works/pi-ai';

//region Readiness without credentials

/**
 Declare adapter readiness without resolving or exposing another provider's credentials.

 @returns native configured-provider metadata
 */
function check(): Promise<AuthCheck> {
  return Promise.resolve({
    type: 'api_key' as const,
    source: 'routes-to-original-provider',
  },);
}

/**
 Leave request authentication entirely at the original registry dispatch.

 @returns empty request authentication with explicit routing provenance
 */
function resolve(): Promise<AuthResult> {
  return Promise.resolve({
    auth: {},
    source: 'routes-to-original-provider',
  },);
}

/**
 Reusable native keyless auth descriptor does not offer a login implementation.
 */
export const KEYLESS_AUTH: ProviderAuth = Object.freeze({
  apiKey: {
    name: 'Routes to existing OpenAI authentication',
    check,
    resolve,
  },
});

/**
 Exclude local physical routing targets from normal available-model lists.

 @returns empty physical-target availability list

 @example
 ```ts
 const targets = noAvailableTargets();
 ```
 */
export function noAvailableTargets(): readonly Model<Api>[] {
  return [];
}

//endregion
