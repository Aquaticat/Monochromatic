import type { ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Invokes explicitly bounded unresolved host behavior.
 *
 * @param controller - Runtime-owned capability whose implementation remains unavailable.
 *
 * @mutates controller - Abort transition updates host state reachable through capability.
 */
export function abortHostOperation(
  controller: ForeignHostCapability<AbortController>,
): void {
  controller.abort();
}
