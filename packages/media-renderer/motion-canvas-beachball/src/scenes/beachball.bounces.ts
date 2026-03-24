import {
  all,
  chain,
  easeInQuad,
  easeOutQuad,
  linear,
  type ThreadGenerator,
} from '@motion-canvas/core';

import type { SceneRefs, } from './beachball.animations.ts';

import {
  BOUNCE_COUNT,
  BOUNCE_DAMPING,
  DURATION_DECAY_PER_BOUNCE,
  ENTRY_DURATION,
  INITIAL_ARC_HEIGHT,
  INITIAL_BOUNCE_DISTANCE,
  INITIAL_BOUNCE_DURATION,
  QUARTER_DIVISOR,
  ROLL_DISTANCE,
  ROLL_DURATION,
  ROLL_ROTATION_DEGREES,
  ROTATION_DECAY_PER_BOUNCE,
  ROTATION_SPEED,
  SHADOW_OPACITY_AIR,
  SHADOW_OPACITY_GROUND,
  SHADOW_SCALE_AIR,
  SHADOW_SCALE_GROUND,
  SQUASH_DECAY_PER_BOUNCE,
  SQUASH_DURATION,
  SQUASH_SCALE_X,
  SQUASH_SCALE_Y,
  WIDTH,
} from './beachball.constants.ts';

/**
 * Animates the bounce-and-roll sequence after the initial entry.
 *
 * @param refs - scene element references
 *
 * @param ballRestY - resting Y position of the ball on the ground
 *
 * @returns motion-canvas thread generator
 */
export function* animateBounces(refs: SceneRefs, ballRestY: number,): ThreadGenerator {
  const { ballGroup, ballBody, shadow, } = refs;
  let currentX = -(WIDTH / QUARTER_DIVISOR);
  let currentArcHeight = INITIAL_ARC_HEIGHT;
  let currentBounceDist = INITIAL_BOUNCE_DISTANCE;
  let currentDuration = INITIAL_BOUNCE_DURATION;
  let totalRotation = ROTATION_SPEED * ENTRY_DURATION / 2;

  for (let bounceIndex = 0; bounceIndex < BOUNCE_COUNT; bounceIndex++) {
    const targetX = currentX + currentBounceDist;
    const duration = currentDuration;
    const decayFactor = 1 - bounceIndex * ROTATION_DECAY_PER_BOUNCE;

    yield* all(
      ballGroup().position.x(targetX, duration, linear,),
      shadow().position.x(targetX, duration, linear,),
      chain(
        ballGroup().position.y(ballRestY - currentArcHeight, duration / 2, easeOutQuad,),
        ballGroup().position.y(ballRestY, duration / 2, easeInQuad,),
      ),
      chain(
        all(
          shadow().scale(SHADOW_SCALE_AIR, duration / 2, easeOutQuad,),
          shadow().opacity(SHADOW_OPACITY_AIR, duration / 2, easeOutQuad,),
        ),
        all(
          shadow().scale(SHADOW_SCALE_GROUND, duration / 2, easeInQuad,),
          shadow().opacity(SHADOW_OPACITY_GROUND, duration / 2, easeInQuad,),
        ),
      ),
      ballBody().rotation(totalRotation + ROTATION_SPEED * duration * decayFactor,
        duration, linear,),
    );
    totalRotation += ROTATION_SPEED * duration * decayFactor;

    // Diminishing squash deformation on impact
    const squashIntensity = 1 - bounceIndex * SQUASH_DECAY_PER_BOUNCE;
    const impactSquashX = 1 + (SQUASH_SCALE_X - 1) * squashIntensity;
    const impactSquashY = 1 - (1 - SQUASH_SCALE_Y) * squashIntensity;
    yield* all(ballBody().scale.x(impactSquashX, SQUASH_DURATION,), ballBody()
      .scale
      .y(impactSquashY, SQUASH_DURATION,),);
    yield* all(ballBody().scale.x(1, SQUASH_DURATION,), ballBody()
      .scale
      .y(1, SQUASH_DURATION,),);

    currentX = targetX;
    currentArcHeight *= BOUNCE_DAMPING;
    currentBounceDist *= BOUNCE_DAMPING;
    currentDuration *= DURATION_DECAY_PER_BOUNCE;
  }

  const rollTargetX = currentX + ROLL_DISTANCE;
  yield* all(
    ballGroup().position.x(rollTargetX, ROLL_DURATION, easeOutQuad,),
    shadow().position.x(rollTargetX, ROLL_DURATION, easeOutQuad,),
    ballBody().rotation(totalRotation + ROLL_ROTATION_DEGREES, ROLL_DURATION,
      easeOutQuad,),
  );
}
