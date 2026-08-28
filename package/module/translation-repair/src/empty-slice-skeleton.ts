import type { SliceSkeleton, } from './translate-skeleton.ts';

//region Empty translated slice skeleton

/**
 * Shape standing in for slice with no readable archive page.
 *
 * @example
 * ```ts
 * const blocks = EMPTY_SLICE_SKELETON.blocks;
 * ```
 */
export const EMPTY_SLICE_SKELETON: SliceSkeleton = {
  blocks: [],
  atoms: [],
};

//endregion Empty translated slice skeleton
