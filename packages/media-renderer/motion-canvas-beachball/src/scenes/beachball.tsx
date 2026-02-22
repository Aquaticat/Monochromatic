import {Circle, makeScene2D, Node, Rect} from '@motion-canvas/2d';
import {
  all,
  chain,
  createRef,
  easeInQuad,
  easeOutQuad,
  linear,
  waitFor,
} from '@motion-canvas/core';

/** Canvas dimensions. */
const WIDTH = 1920;
const HEIGHT = 1080;

/** Ground Y position (bottom quarter of screen). */
const GROUND_Y = 340;

/** Ball radius. */
const BALL_RADIUS = 60;

/** Gravity-like arc height for each bounce. */
const INITIAL_ARC_HEIGHT = 500;

/** Horizontal distance the ball covers per bounce. */
const INITIAL_BOUNCE_DISTANCE = 500;

/** Energy retained per bounce (0-1). */
const BOUNCE_DAMPING = 0.55;

/** Number of bounces before the ball rolls. */
const BOUNCE_COUNT = 4;

/** Duration in seconds per bounce arc. */
const INITIAL_BOUNCE_DURATION = 0.8;

/** Squash scale on impact (wider, shorter). */
const SQUASH_SCALE_X = 1.35;
const SQUASH_SCALE_Y = 0.7;

/** Duration of the squash/stretch deformation. */
const SQUASH_DURATION = 0.08;

/** How many full rotations during the flight. */
const ROTATION_SPEED = 360 * 3;

/** Shadow opacity when ball is on ground vs at peak. */
const SHADOW_OPACITY_GROUND = 0.4;
const SHADOW_OPACITY_AIR = 0.1;

/** Shadow scale when ball is on ground vs at peak. */
const SHADOW_SCALE_GROUND = 1.0;
const SHADOW_SCALE_AIR = 0.5;

/** Stripe colors for a beachball look. */
const STRIPE_COLORS = ['#e13238', '#ffffff', '#2563eb', '#ffffff', '#f59e0b', '#ffffff'];

/** Number of stripes. */
const STRIPE_COUNT = STRIPE_COLORS.length;

export default makeScene2D(function* (view) {
  const ballGroup = createRef<Node>();
  const ballBody = createRef<Circle>();
  const shadow = createRef<Circle>();

  // Starting position: offscreen left, at ground level
  const startX = -(WIDTH / 2) - BALL_RADIUS * 2;
  const ballRestY = GROUND_Y - BALL_RADIUS;

  // Shadow sits on the ground plane
  view.add(
    <Circle
      ref={shadow}
      x={startX}
      y={GROUND_Y + 5}
      width={BALL_RADIUS * 2}
      height={BALL_RADIUS * 0.4}
      fill={'#000000'}
      opacity={SHADOW_OPACITY_GROUND}
    />,
  );

  // Ball group (contains ball body for independent squash transform)
  view.add(
    <Node ref={ballGroup} x={startX} y={ballRestY}>
      <Circle
        ref={ballBody}
        width={BALL_RADIUS * 2}
        height={BALL_RADIUS * 2}
        clip
      >
        {/* Beachball stripe pattern using vertical rects clipped by the circle */}
        {STRIPE_COLORS.map((color, stripeIndex) => {
          const stripeWidth = (BALL_RADIUS * 2) / STRIPE_COUNT;
          const stripeX = -BALL_RADIUS + stripeWidth * stripeIndex + stripeWidth / 2;
          return (
            <Rect
              key={`stripe-${stripeIndex}`}
              x={stripeX}
              y={0}
              width={stripeWidth + 1}
              height={BALL_RADIUS * 2 + 2}
              fill={color}
            />
          );
        })}
      </Circle>
    </Node>,
  );

  // -- Animation sequence --

  let currentX = startX;
  let currentArcHeight = INITIAL_ARC_HEIGHT;
  let currentBounceDist = INITIAL_BOUNCE_DISTANCE;
  let currentDuration = INITIAL_BOUNCE_DURATION;
  let totalRotation = 0;

  // First arc: enter from offscreen with a high arc
  const firstLandX = -(WIDTH / 4);
  const firstArcHeight = INITIAL_ARC_HEIGHT * 1.2;
  const entryDistance = firstLandX - startX;
  const entryDuration = 1.2;

  // Entry arc
  yield* all(
    // Horizontal movement
    ballGroup().position.x(firstLandX, entryDuration, linear),
    shadow().position.x(firstLandX, entryDuration, linear),

    // Vertical arc (parabolic via easeOut up, easeIn down)
    chain(
      ballGroup().position.y(ballRestY - firstArcHeight, entryDuration / 2, easeOutQuad),
      ballGroup().position.y(ballRestY, entryDuration / 2, easeInQuad),
    ),

    // Shadow scaling with height
    chain(
      all(
        shadow().scale(SHADOW_SCALE_AIR, entryDuration / 2, easeOutQuad),
        shadow().opacity(SHADOW_OPACITY_AIR, entryDuration / 2, easeOutQuad),
      ),
      all(
        shadow().scale(SHADOW_SCALE_GROUND, entryDuration / 2, easeInQuad),
        shadow().opacity(SHADOW_OPACITY_GROUND, entryDuration / 2, easeInQuad),
      ),
    ),

    // Rotation
    ballBody().rotation(totalRotation + ROTATION_SPEED * entryDuration / 2, entryDuration, linear),
  );
  totalRotation += ROTATION_SPEED * entryDuration / 2;

  // Impact squash
  yield* all(
    ballBody().scale.x(SQUASH_SCALE_X, SQUASH_DURATION),
    ballBody().scale.y(SQUASH_SCALE_Y, SQUASH_DURATION),
  );
  yield* all(
    ballBody().scale.x(1, SQUASH_DURATION),
    ballBody().scale.y(1, SQUASH_DURATION),
  );

  currentX = firstLandX;

  // Subsequent bounces with damping
  for (let bounceIndex = 0; bounceIndex < BOUNCE_COUNT; bounceIndex++) {
    const targetX = currentX + currentBounceDist;
    const arcHeight = currentArcHeight;
    const duration = currentDuration;

    yield* all(
      // Horizontal
      ballGroup().position.x(targetX, duration, linear),
      shadow().position.x(targetX, duration, linear),

      // Vertical arc
      chain(
        ballGroup().position.y(ballRestY - arcHeight, duration / 2, easeOutQuad),
        ballGroup().position.y(ballRestY, duration / 2, easeInQuad),
      ),

      // Shadow
      chain(
        all(
          shadow().scale(SHADOW_SCALE_AIR, duration / 2, easeOutQuad),
          shadow().opacity(SHADOW_OPACITY_AIR, duration / 2, easeOutQuad),
        ),
        all(
          shadow().scale(SHADOW_SCALE_GROUND, duration / 2, easeInQuad),
          shadow().opacity(SHADOW_OPACITY_GROUND, duration / 2, easeInQuad),
        ),
      ),

      // Rotation (slows down with each bounce)
      ballBody().rotation(
        totalRotation + ROTATION_SPEED * duration * (1 - bounceIndex * 0.15),
        duration,
        linear,
      ),
    );
    totalRotation += ROTATION_SPEED * duration * (1 - bounceIndex * 0.15);

    // Impact squash (diminishes with each bounce)
    const squashIntensity = 1 - bounceIndex * 0.2;
    const impactSquashX = 1 + (SQUASH_SCALE_X - 1) * squashIntensity;
    const impactSquashY = 1 - (1 - SQUASH_SCALE_Y) * squashIntensity;

    yield* all(
      ballBody().scale.x(impactSquashX, SQUASH_DURATION),
      ballBody().scale.y(impactSquashY, SQUASH_DURATION),
    );
    yield* all(
      ballBody().scale.x(1, SQUASH_DURATION),
      ballBody().scale.y(1, SQUASH_DURATION),
    );

    currentX = targetX;
    currentArcHeight *= BOUNCE_DAMPING;
    currentBounceDist *= BOUNCE_DAMPING;
    currentDuration *= 0.75;
  }

  // Rolling phase: ball rolls to a stop
  const rollDistance = 200;
  const rollDuration = 2.0;
  const rollTargetX = currentX + rollDistance;

  yield* all(
    ballGroup().position.x(rollTargetX, rollDuration, easeOutQuad),
    shadow().position.x(rollTargetX, rollDuration, easeOutQuad),
    ballBody().rotation(totalRotation + 720, rollDuration, easeOutQuad),
  );

  yield* waitFor(0.5);
});
