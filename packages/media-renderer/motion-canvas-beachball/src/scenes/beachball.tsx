import {
  Circle,
  makeScene2D,
  Node,
  Rect,
} from '@motion-canvas/2d';
import {
  createRef,
  waitFor,
} from '@motion-canvas/core';

import {
  animateEntry,
  type SceneRefs,
} from './beachball.animations.ts';
import { animateBounces, } from './beachball.bounces.ts';
import {
  BALL_RADIUS,
  FINAL_WAIT_DURATION,
  GROUND_Y,
  SHADOW_HEIGHT_RATIO,
  SHADOW_OPACITY_GROUND,
  SHADOW_Y_OFFSET,
  STRIPE_COLORS,
  STRIPE_COUNT,
  WIDTH,
} from './beachball.constants.ts';

export default makeScene2D(function* beachballScene(view,) {
  const refs: SceneRefs = {
    ballGroup: createRef<Node>(),
    ballBody: createRef<Circle>(),
    shadow: createRef<Circle>(),
  };

  const startX = -(WIDTH / 2) - BALL_RADIUS * 2;
  const ballRestY = GROUND_Y - BALL_RADIUS;

  view.add(
    <Circle
      ref={refs.shadow}
      x={startX}
      y={GROUND_Y + SHADOW_Y_OFFSET}
      width={BALL_RADIUS * 2}
      height={BALL_RADIUS * SHADOW_HEIGHT_RATIO}
      fill={'#000000'}
      opacity={SHADOW_OPACITY_GROUND} />,
  );

  view.add(
    <Node ref={refs.ballGroup} x={startX} y={ballRestY}>
      <Circle ref={refs.ballBody} width={BALL_RADIUS * 2} height={BALL_RADIUS * 2} clip>
        {STRIPE_COLORS.map(function renderStripe(
          color,
          stripeIndex,
        ) {
          const stripeWidth = (BALL_RADIUS * 2) / STRIPE_COUNT;
          const stripeX = -BALL_RADIUS + stripeWidth * stripeIndex + stripeWidth / 2;
          return (
            <Rect
              key={`stripe-${stripeIndex}`}
              x={stripeX}
              y={0}
              width={stripeWidth + 1}
              height={BALL_RADIUS * 2 + 2}
              fill={color} />
          );
        },)}
      </Circle>
    </Node>,
  );

  yield* animateEntry(
    refs,
    ballRestY,
  );
  yield* animateBounces(
    refs,
    ballRestY,
  );
  yield* waitFor(FINAL_WAIT_DURATION,);
},);
