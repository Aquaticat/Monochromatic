import type { ForeignHostCapability as ExactForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Uses marker without required effect contract.
 *
 * @param controller - Runtime-owned capability.
 */
export function abortUndocumentedHostOperation(
  controller: ExactForeignHostCapability<AbortController>,
): void {
  controller.abort();
}

/**
 * Same-named local alias without exact marker declaration identity.
 *
 * @typeParam Value - Wrapped test value.
 */
type ForeignHostCapability<Value> = Value;

/**
 * Keeps same-named lookalike fail closed.
 *
 * @param controller - Unproven runtime service.
 *
 * @mutates controller - Claim cannot authorize unresolved lookalike marker.
 */
export function abortShadowedHostOperation(
  controller: ForeignHostCapability<AbortController>,
): void {
  controller.abort();
}
