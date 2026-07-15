/**
 * Invalid readonly fixture carrying an inert ownership marker.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Reads deeply readonly state through an inert foreign marker.
 *
 * @param state - Readonly value whose marker confers no mutable capability.
 *
 * @returns label field.
 */
export function readMarkedReadonlyState(
  state: ForeignBorrowed<{ readonly label: string; }>,
): string {
  return state.label;
}
