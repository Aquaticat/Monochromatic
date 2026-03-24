/**
 * Arm part definitions for reference image segmentation.
 *
 * Upper arms, forearms, and hands.
 *
 * @module
 */
/* eslint-disable no-magic-numbers -- bbox fractions, color tolerances, and morph kernel sizes are inherently numeric part definitions */
import { PALETTE, } from './config.ts';
import {
  c,
  type PartDef,
  REF_GRAY_DARK,
  REF_GRAY_WARM,
} from './parts-types.ts';

/** Upper arms, forearms, and hands. */
export const ARM_PARTS: readonly PartDef[] = [
  {
    name: 'upper_arm_L',
    bbox: [0.05, 0.18, 0.2, 0.15,],
    colors: [c(PALETTE.midGray, 50,), c(REF_GRAY_WARM, 40,), c(REF_GRAY_DARK, 35,),],
    fill: '#9a9a9a',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'upper_arm_R',
    bbox: [0.75, 0.18, 0.2, 0.15,],
    colors: [c(PALETTE.midGray, 50,), c(REF_GRAY_WARM, 40,), c(REF_GRAY_DARK, 35,),],
    fill: '#9a9a9a',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'forearm_L',
    bbox: [0.02, 0.3, 0.2, 0.14,],
    colors: [c(PALETTE.midGray, 50,), c(PALETTE.dark, 40,), c(REF_GRAY_WARM, 40,),],
    fill: '#9a9a9a',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'forearm_R',
    bbox: [0.78, 0.3, 0.2, 0.14,],
    colors: [c(PALETTE.midGray, 50,), c(PALETTE.dark, 40,), c(REF_GRAY_WARM, 40,),],
    fill: '#9a9a9a',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'hand_L',
    bbox: [0, 0.42, 0.18, 0.08,],
    colors: [c(PALETTE.skin, 45,), c([246, 231, 210,], 35,),],
    fill: '#f0ddd0',
    morphClose: 3,
    morphOpen: 2,
  },
  {
    name: 'hand_R',
    bbox: [0.82, 0.42, 0.18, 0.08,],
    colors: [c(PALETTE.skin, 45,), c([246, 231, 210,], 35,),],
    fill: '#f0ddd0',
    morphClose: 3,
    morphOpen: 2,
  },
];
