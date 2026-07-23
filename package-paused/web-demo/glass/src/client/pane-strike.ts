/**
 * The strike: instant localized breakage in the Smash Hit mold.
 *
 * A first hit computes the fracture once, blasts the cells around the
 * impact out as shards immediately, and leaves the rest standing as a
 * cracked rim with a real hole; the rim collapses on its hold timer or
 * on the next hit. The fracture cells drive the hole shards, the rim
 * geometry, and the crack overlay, so every boundary is the same line.
 */
import { Vector3, } from 'three/webgpu';

import { attachCrackOverlay, } from './crack-overlay.ts';
import {
  fractureCells,
  type PanePoint,
  type RandomSource,
} from './fracture.ts';
import { partitionCellsByHole, } from './fracture-partition.ts';
import { paneFrame, } from './pane-assembly.ts';
import {
  type Pane,
  PANE_TUNING,
  type PaneState,
  type ShatterEvent,
} from './pane-model.ts';
import { buildPaneRim, } from './pane-rim.ts';

/**
 * What one registered strike did: the stage the pane entered, plus the
 * instant shard burst when glass flew at strike time.
 */
export type StrikeOutcome = {
  /**
   * Stage the pane entered.
   */
  readonly state: PaneState;
  /**
   * Shards blasted out at strike time, absent when only the hold
   * collapsed (the rim shards then come from the pane update).
   */
  readonly burst?: ShatterEvent;
};

/**
 * Registers a ball strike. An intact pane fractures, loses its hole
 * cells instantly, and keeps a holding rim; a cracked pane's rim
 * collapses through the hold timer on the very next pane update.
 *
 * @param pane - struck pane
 *
 * @param impactLocal - impact point in pane-local meters
 *
 * @param ballVelocity - ball velocity at impact, world m/s
 *
 * @param now - wall-clock seconds
 *
 * @param random - uniform random source
 *
 * @mutates pane - the break state, rim cells, hold timer, and impact snapshot advance; the sheet hides; `buildPaneRim` mounts the rim mesh and `attachCrackOverlay` mounts the overlay, each documenting its own scene edits; `paneFrame` runs `pane.glass.matrixWorld.decompose(...)`, which only reads the matrix.
 *
 * @mutates ballVelocity - `ballVelocity.clone()` is a three.js method the analyzer cannot inspect; it only reads components.
 *
 * @mutates random - fracture, partition, and hold-timer draws advance the caller-supplied generator state.
 *
 * @returns stage entered plus the instant burst, when any
 *
 * @example
 * ```ts
 * const outcome = strikePane({
 *   pane,
 *   impactLocal: { x: 0.1, y: -0.2 },
 *   ballVelocity,
 *   now: 12.4,
 *   random: Math.random,
 * },);
 * ```
 */
export function strikePane(
  {
    pane,
    impactLocal,
    ballVelocity,
    now,
    random,
  }: {
    readonly pane: Pane;
    readonly impactLocal: PanePoint;
    readonly ballVelocity: Vector3;
    readonly now: number;
    readonly random: RandomSource;
  },
): StrikeOutcome {
  if (pane.state === 'cracked') {
    pane.holdUntil = now;
    pane.impactLocal = impactLocal;
    pane.impactVelocity = ballVelocity.clone();
    return { state: 'shattered', };
  }
  /**
   * Fracture computed once at strike time; hole shards, rim geometry,
   * and crack overlay all cut along these cells.
   */
  const cells = fractureCells({
    halfWidth: pane.halfWidth,
    halfHeight: pane.halfHeight,
    impact: impactLocal,
    random,
  },);
  /**
   * Cells flying now versus cells holding as the rim.
   */
  const {
    hole,
    rim,
  } = partitionCellsByHole({
    cells,
    impact: impactLocal,
    holeRadius: PANE_TUNING.holeRadius,
    random,
  },);
  /**
   * Glass world transform with the unit-box scale stripped, shared by
   * the burst event and the collapse that follows.
   */
  const paneMatrix = paneFrame(pane,);
  /**
   * Impact point lifted into world space through the meters-space frame.
   */
  const impactWorld = new Vector3(
    impactLocal.x,
    impactLocal.y,
    0,
  );
  impactWorld.applyMatrix4(paneMatrix,);
  pane.impactLocal = impactLocal;
  pane.impactVelocity = ballVelocity.clone();
  pane.sheet
    .visible = false;
  if (rim.length === 0) {
    // The blast radius swallowed the whole pane: skip the rim stage.
    pane.state = 'shattered';
    return {
      state: 'shattered',
      burst: {
        stage: 'collapse',
        cells,
        paneMatrix,
        impactWorld,
        ballVelocity: ballVelocity.clone(),
      },
    };
  }
  pane.state = 'cracked';
  pane.rimCells = rim;
  pane.holdUntil = now
    + PANE_TUNING.holdMin
    + (random() * PANE_TUNING.holdExtra);
  buildPaneRim(pane,);
  attachCrackOverlay({
    pane,
    impactLocal,
  },);
  return {
    state: 'cracked',
    burst: {
      stage: 'hole',
      cells: hole,
      paneMatrix,
      impactWorld,
      ballVelocity: ballVelocity.clone(),
    },
  };
}
