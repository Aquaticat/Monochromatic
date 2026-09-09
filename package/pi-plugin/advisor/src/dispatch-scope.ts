/** Final synchronous scope check accepts both live shapes supported by the shared resolver. @module */

/**
 Resolve one runtime scope item's canonical identity without trusting its wrapper shape.
 @param value - raw model or model/thinking-level entry
 @param model - selected canonical identity
 @returns whether this scope item authorizes the selected endpoint
 */
function matchesScopeItem({ value, model, }: { readonly value: unknown; readonly model: string; },): boolean {
  if (value === null || typeof value !== 'object')
    return false;
  /** Both historical raw-model and current wrapped-model live scopes are supported. */
  const identity = 'model' in value ? value.model : value;
  return identity !== null && typeof identity === 'object' && 'provider' in identity && 'id' in identity
    && typeof identity.provider === 'string' && typeof identity.id === 'string'
    && `${identity.provider}/${identity.id}` === model;
}

/**
 Reject a selected endpoint removed from a currently restricted live scope during authentication.
 @param scope - current host scope property, when available
 @param model - prepared canonical endpoint
 @throws when a nonempty live scope excludes this endpoint
 @example
 ```ts
 assertAdvisorLiveScope({ scope: ctx.scopedModels, model: 'provider/reviewer' });
 ```
 */
export function assertAdvisorLiveScope({ scope, model, }: { readonly scope: unknown; readonly model: string; },): void {
  if (Array.isArray(scope,) && scope.length > 0 && !scope.some(function included(value: unknown,): boolean { return matchesScopeItem({ value, model, },); },))
    throw new Error(`advisor: ${model} left the live scope before dispatch`,);
}
