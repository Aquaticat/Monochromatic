/**
 * Hair part definitions for reference image segmentation.
 *
 * Back hair, bangs, drill tails, and ribbon accessories.
 *
 * @module
 */
/* eslint-disable no-magic-numbers -- bbox fractions, color tolerances, and morph kernel sizes are inherently numeric part definitions */
import { PALETTE, } from './config.ts';
import {
  c,
  type PartDef,
  REF_RED,
} from './parts-types.ts';

/** All six hair parts: back, bangs, drills, accessories. */
export const HAIR_PARTS: readonly PartDef[] = [
  {
    name: 'hair_back',
    bbox: [0.08, 0, 0.84, 0.23,],
    colors: [c(PALETTE.red, 55,), c(PALETTE.darkRed, 50,), c(REF_RED, 45,),],
    fill: '#cc2244',
    morphClose: 7,
    morphOpen: 3,
  },
  {
    name: 'hair_bangs',
    bbox: [0.22, 0, 0.56, 0.12,],
    colors: [c(PALETTE.red, 55,), c(PALETTE.darkRed, 50,), c(REF_RED, 45,),],
    fill: '#cc2244',
    morphClose: 5,
    morphOpen: 2,
  },
  {
    name: 'hair_drill_L',
    bbox: [0, 0.04, 0.35, 0.26,],
    colors: [c(PALETTE.red, 55,), c(PALETTE.darkRed, 50,), c(REF_RED, 45,),],
    fill: '#cc2244',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    name: 'hair_drill_R',
    bbox: [0.65, 0.04, 0.35, 0.26,],
    colors: [c(PALETTE.red, 55,), c(PALETTE.darkRed, 50,), c(REF_RED, 45,),],
    fill: '#cc2244',
    morphClose: 5,
    morphOpen: 3,
  },
  {
    // White horn/ribbon accents - same color as background, use foreground only
    name: 'hair_accessory_L',
    bbox: [0.18, 0, 0.2, 0.1,],
    colors: [],
    fill: '#f0ede8',
    morphClose: 3,
    morphOpen: 2,
  },
  {
    name: 'hair_accessory_R',
    bbox: [0.62, 0, 0.2, 0.1,],
    colors: [],
    fill: '#f0ede8',
    morphClose: 3,
    morphOpen: 2,
  },
];
