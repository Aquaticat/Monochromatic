/**
 * Pipeline prewarm: spawning one throwaway shard and a spark puff far
 * below the corridor at startup, so the debris and spark pipelines
 * compile before the first real impact frame instead of during it.
 */
import {
  Matrix4,
  Vector3,
} from 'three/webgpu';

import type { DebrisSystem, } from './debris-model.ts';
import type { RandomSource, } from './fracture.ts';
import type { FxSystem, } from './fx.ts';
import { PANE_TUNING, } from './pane-model.ts';

/**
 * Depth the prewarm debris spawns at, far below the corridor.
 */
const PREWARM_DEPTH = -60;

/**
 * Spark count for the prewarm puff; just enough to touch the pipeline.
 */
const PREWARM_SPARKS = 4;

/**
 * Spawns the prewarm shard and spark puff.
 *
 * @param debris - batched shard pool to warm
 *
 * @param fx - spark system to warm
 *
 * @param random - uniform random source
 *
 * @example
 * ```ts
 * prewarmPipelines({ debris, fx, random },);
 * ```
 */
export function prewarmPipelines(
  {
    debris,
    fx,
    random,
  }: {
    readonly debris: DebrisSystem;
    readonly fx: FxSystem;
    readonly random: RandomSource;
  },
): void {
  debris.spawnShards({
    cells: [[
      {
        x: -0.04,
        y: -0.03,
      },
      {
        x: 0.04,
        y: -0.03,
      },
      {
        x: 0,
        y: 0.04,
      },
    ],],
    thickness: PANE_TUNING.thickness,
    paneMatrix: new Matrix4().makeTranslation(
      0,
      PREWARM_DEPTH,
      0,
    ),
    impactWorld: new Vector3(
      0,
      PREWARM_DEPTH,
      0,
    ),
    ballVelocity: new Vector3(
      0,
      0,
      0,
    ),
    random,
  },);
  fx.burst({
    at: new Vector3(
      0,
      PREWARM_DEPTH,
      0,
    ),
    count: PREWARM_SPARKS,
    speed: 0.5,
  },);
}
