import type {
  Circle,
  Node,
} from '@motion-canvas/2d';
import type { ThreadGenerator, } from '@motion-canvas/core';
import {
  all,
  chain,
  easeInQuad,
  easeOutQuad,
  linear,
  type Reference,
} from '@motion-canvas/core';

import {
  ENTRY_DURATION,
  FIRST_ARC_HEIGHT_MULTIPLIER,
  INITIAL_ARC_HEIGHT,
  QUARTER_DIVISOR,
  ROTATION_SPEED,
  SHADOW_OPACITY_AIR,
  SHADOW_OPACITY_GROUND,
  SHADOW_SCALE_AIR,
  SHADOW_SCALE_GROUND,
  SQUASH_DURATION,
  SQUASH_SCALE_X,
  SQUASH_SCALE_Y,
  WIDTH,
} from './beachball.constants.ts';

/** Shared ref bag passed between animation phases. */
export type SceneRefs = {
  /** Reference to the ball container node. */
  ballGroup: Reference<Node>;
  /** Reference to the ball's visual body. */
  ballBody: Reference<Circle>;
  /** Reference to the ground shadow ellipse. */
  shadow: Reference<Circle>;
};

/**
 * Animates the ball entering the scene from offscreen with a high arc and impact squash.
 *
 * @param refs - scene element references
 * @param ballRestY - resting Y position of the ball on the ground
 * @returns motion-canvas thread generator
 * @yields animation frames
 */
export function* animateEntry(refs: SceneRefs, ballRestY: number,): ThreadGenerator {
  const firstLandX = -(WIDTH / QUARTER_DIVISOR);
  const { ballGroup, ballBody, shadow, } = refs;
  const firstArcHeight = INITIAL_ARC_HEIGHT * FIRST_ARC_HEIGHT_MULTIPLIER;

  yield* all(
    ballGroup().position.x(firstLandX, ENTRY_DURATION, linear,),
    shadow().position.x(firstLandX, ENTRY_DURATION, linear,),
    chain(
      ballGroup().position.y(ballRestY - firstArcHeight, ENTRY_DURATION / 2,
        easeOutQuad,),
      ballGroup().position.y(ballRestY, ENTRY_DURATION / 2, easeInQuad,),
    ),
    chain(
      all(
        shadow().scale(SHADOW_SCALE_AIR, ENTRY_DURATION / 2, easeOutQuad,),
        shadow().opacity(SHADOW_OPACITY_AIR, ENTRY_DURATION / 2, easeOutQuad,),
      ),
      all(
        shadow().scale(SHADOW_SCALE_GROUND, ENTRY_DURATION / 2, easeInQuad,),
        shadow().opacity(SHADOW_OPACITY_GROUND, ENTRY_DURATION / 2, easeInQuad,),
      ),
    ),
    ballBody().rotation(ROTATION_SPEED * ENTRY_DURATION / 2, ENTRY_DURATION, linear,),
  );

  yield* all(
    ballBody().scale.x(SQUASH_SCALE_X, SQUASH_DURATION,),
    ballBody().scale.y(SQUASH_SCALE_Y, SQUASH_DURATION,),
  );
  yield* all(ballBody().scale.x(1, SQUASH_DURATION,),
    ballBody().scale.y(1, SQUASH_DURATION,),);
}
