/**
 * Swept collision of one ball segment against the live panes.
 *
 * The whole between-frame segment transforms into each pane's local
 * space, so fast balls cannot tunnel through thin glass. Every resolved
 * hit punches through with most of the ball's speed kept, the way Smash
 * Hit caps reaction impulses so the ball stays the hero; a segment
 * crossing a cracked pane inside its blasted-out hole touches nothing
 * and flies on.
 */
import { Vector3, } from 'three/webgpu';

import { BALL_TUNING, } from './ball-tuning.ts';
import type { PaneCell, } from './fracture.ts';
import { pointInConvexPolygon, } from './fracture-partition.ts';
import type {
  Pane,
  PaneSystem,
} from './pane-model.ts';
import {
  type BallBody,
  PANE_MISS,
  paneSegmentCrossing,
} from './physics.ts';

/**
 * Sentinel reported when the swept segment struck no pane this frame.
 */
export const SWEEP_MISS: unique symbol = Symbol(
  'swept ball segment struck no pane',
);

/**
 * Outcome of one resolved pane strike, for audio and effect hooks.
 */
export type BallImpact = {
  /**
   * Pane that was struck.
   */
  readonly pane: Pane;
  /**
   * Stage the pane entered: cracked or shattered.
   */
  readonly result: 'cracked' | 'shattered';
  /**
   * Impact point in world space.
   */
  readonly impactWorld: Vector3;
};

/**
 * Sweeps one ball's between-frame segment against every hittable pane
 * and resolves the first strike: glass flies and the ball punches
 * through with most of its speed.
 *
 * @param from - segment start in world space
 *
 * @param to - segment end in world space
 *
 * @param body - ball state slowed on a hit
 *
 * @param targets - panes a ball can still hit this frame
 *
 * @param strike - pane system strike registrar
 *
 * @param now - wall-clock seconds
 *
 * @mutates body - `velocity.set(body.vx, body.vy, body.vz)` reads the components; a punch-through scales velocity down.
 *
 * @mutates targets - `pane.glass.worldToLocal` and `impactWorld.applyMatrix4` read pane transforms through three.js methods the analyzer cannot inspect, and `strike` advances the struck pane's break state.
 *
 * @mutates from - `pane.glass.worldToLocal(from.clone())` is a three.js method the analyzer cannot inspect; it only reads the vector.
 *
 * @mutates to - `pane.glass.worldToLocal(to.clone())` is a three.js method the analyzer cannot inspect; it only reads the vector.
 *
 * @returns the resolved impact, or {@link SWEEP_MISS} when nothing was hit
 *
 * @example
 * ```ts
 * const impact = sweepBallAgainstPanes({
 *   from,
 *   to,
 *   body: slot.body,
 *   targets,
 *   strike: panes.strike,
 *   now,
 * },);
 * ```
 */
export function sweepBallAgainstPanes(
  {
    from,
    to,
    body,
    targets,
    strike,
    now,
  }: {
    readonly from: Vector3;
    readonly to: Vector3;
    readonly body: BallBody;
    readonly targets: readonly Pane[];
    readonly strike: PaneSystem['strike'];
    readonly now: number;
  },
): BallImpact | typeof SWEEP_MISS {
  for (const pane of targets) {
    if (pane.state === 'shattered')
      continue;
    /**
     * Segment start in pane-local coordinates.
     */
    const localFrom = pane.glass
      .worldToLocal(from.clone(),);
    /**
     * Segment end in pane-local coordinates.
     */
    const localTo = pane.glass
      .worldToLocal(to.clone(),);
    /**
     * Pane-plane crossing of this segment, when any. The glass mesh is a
     * scaled unit box, so local space is normalized to half extents of
     * 0.5.
     */
    const crossing = paneSegmentCrossing({
      fromX: localFrom.x,
      fromY: localFrom.y,
      fromZ: localFrom.z,
      toX: localTo.x,
      toY: localTo.y,
      toZ: localTo.z,
      halfWidth: 1 / 2,
      halfHeight: 1 / 2,
    },);
    if (crossing === PANE_MISS)
      continue;
    /**
     * Crossing scaled from normalized local space to meters.
     */
    const impactLocal = {
      x: crossing.x * pane.halfWidth
        * 2,
      y: crossing.y * pane.halfHeight
        * 2,
    };
    // A cracked pane only keeps glass on its rim cells: a crossing
    // inside the blasted-out hole touches nothing and the ball flies on.
    if (pane.state === 'cracked') {
      /**
       * Whether surviving rim glass covers the crossing point.
       */
      const onRim = (pane.rimCells ?? []).some(
        function coversCrossing(cell: PaneCell,): boolean {
          return pointInConvexPolygon({
            polygon: cell,
            point: impactLocal,
          },);
        },
      );
      if (!onRim)
        continue;
    }
    /**
     * Ball velocity at impact, world space.
     */
    const velocity = new Vector3();
    velocity.set(
      body.vx,
      body.vy,
      body.vz,
    );
    /**
     * Stage the pane entered from this strike.
     */
    const result = strike({
      pane,
      impactLocal,
      ballVelocity: velocity,
      now,
    },);
    /**
     * Impact point in world space for effect hooks. The normalized
     * crossing goes through the glass matrix directly: its unit-box
     * scale is exactly the pane dimensions.
     */
    const impactWorld = new Vector3(
      crossing.x,
      crossing.y,
      0,
    );
    impactWorld.applyMatrix4(pane.glass
      .matrixWorld,);
    body.vx *= BALL_TUNING.punchThroughKeep;
    body.vy *= BALL_TUNING.punchThroughKeep;
    body.vz *= BALL_TUNING.punchThroughKeep;
    return {
      pane,
      result: result === 'cracked' ? 'cracked' : 'shattered',
      impactWorld,
    };
  }
  return SWEEP_MISS;
}
