/**
 * Declares mutation absent from implementation.
 *
 * @param controller - Capability overload claims to mutate.
 *
 * @mutates controller - Claims cancellation transition for overload.
 */
export function inconsistentReadonlyOverload(controller: AbortController,): void;

/**
 * Implements overload without mutation.
 *
 * @param controller - Capability inspected without transition.
 */
export function inconsistentReadonlyOverload(controller: AbortController,): void {
  void controller.signal;
}
