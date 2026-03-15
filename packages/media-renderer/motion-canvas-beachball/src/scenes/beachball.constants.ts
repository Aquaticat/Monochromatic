/** Canvas width in pixels. */
export const WIDTH = 1_920;

/** Canvas height in pixels. */
export const HEIGHT = 1_080;

/** Ground Y position (bottom quarter of screen). */
export const GROUND_Y = 340;

/** Ball radius in pixels. */
export const BALL_RADIUS = 60;

/** Gravity-like arc height for each bounce. */
export const INITIAL_ARC_HEIGHT = 500;

/** Horizontal distance the ball covers per bounce. */
export const INITIAL_BOUNCE_DISTANCE = 500;

/** Energy retained per bounce (0-1). */
export const BOUNCE_DAMPING = 0.55;

/** Number of bounces before the ball rolls. */
export const BOUNCE_COUNT = 4;

/** Duration in seconds per bounce arc. */
export const INITIAL_BOUNCE_DURATION = 0.8;

/** Squash scale on impact — horizontal stretch factor. */
export const SQUASH_SCALE_X = 1.35;

/** Squash scale on impact — vertical compression factor. */
export const SQUASH_SCALE_Y = 0.7;

/** Duration of the squash/stretch deformation in seconds. */
export const SQUASH_DURATION = 0.08;

/** Degrees per revolution. */
const DEGREES_PER_REVOLUTION = 360;

/** Number of full revolutions during flight. */
const REVOLUTION_COUNT = 3;

/** Total rotation degrees during flight. */
export const ROTATION_SPEED = DEGREES_PER_REVOLUTION * REVOLUTION_COUNT;

/** Shadow opacity when ball is on the ground. */
export const SHADOW_OPACITY_GROUND = 0.4;

/** Shadow opacity when ball is at peak height. */
export const SHADOW_OPACITY_AIR = 0.1;

/** Shadow scale when ball is on the ground. */
export const SHADOW_SCALE_GROUND = 1;

/** Shadow scale when ball is at peak height. */
export const SHADOW_SCALE_AIR = 0.5;

/** Stripe colors for a beachball look. */
export const STRIPE_COLORS = ['#e13238', '#ffffff', '#2563eb', '#ffffff', '#f59e0b', '#ffffff'];

/** Number of stripes derived from color array length. */
export const STRIPE_COUNT = STRIPE_COLORS.length;

/** Vertical offset of the shadow below the ground plane. */
export const SHADOW_Y_OFFSET = 5;

/** Height of the shadow ellipse as a fraction of ball radius. */
export const SHADOW_HEIGHT_RATIO = 0.4;

/** Multiplier for the first entry arc height. */
export const FIRST_ARC_HEIGHT_MULTIPLIER = 1.2;

/** Duration of the initial entry arc in seconds. */
export const ENTRY_DURATION = 1.2;

/** Divisor for placing the first landing point at a quarter of the canvas width. */
export const QUARTER_DIVISOR = 4;

/** Rotation decay factor per bounce index. */
export const ROTATION_DECAY_PER_BOUNCE = 0.15;

/** Squash intensity decay factor per bounce index. */
export const SQUASH_DECAY_PER_BOUNCE = 0.2;

/** Duration multiplier applied after each bounce. */
export const DURATION_DECAY_PER_BOUNCE = 0.75;

/** Horizontal distance for the final rolling phase. */
export const ROLL_DISTANCE = 200;

/** Duration of the final rolling phase in seconds. */
export const ROLL_DURATION = 2;

/** Rotation degrees during the final roll. */
export const ROLL_ROTATION_DEGREES = 720;

/** Wait time in seconds after the animation completes. */
export const FINAL_WAIT_DURATION = 0.5;
