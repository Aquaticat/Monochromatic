/**
 * Minimal rigid-ish dynamics for balls and glass shards.
 *
 * Everything works on plain mutable body records with number fields, no
 * three.js types, so the integration and collision rules unit-test in
 * node. The renderer-side systems copy these numbers into instance
 * matrices each frame.
 *
 * Units are meters and seconds; gravity matches Earth so debris falls
 * convincingly instead of floating.
 */

/**
 * Downward acceleration applied to every free-flying body, m/s^2.
 */
export const GRAVITY = 9.81;

/**
 * Tuning constants for shard ground contact. One table instead of
 * scattered magic values.
 */
export const SHARD_CONTACT_TUNING = {
  /** Vertical velocity kept after a floor bounce (restitution). */
  restitution: 0.34,
  /** Horizontal velocity kept after a floor bounce (friction loss). */
  tangentialKeep: 0.72,
  /** Spin kept after a floor bounce. */
  spinKeep: 0.5,
  /** Bounces slower than this settle instead of bouncing again, m/s. */
  settleSpeed: 0.55,
} as const;

/**
 * Point mass state for a thrown ball.
 */
export type BallBody = {
  /** Position x, meters, world space. */
  px: number;
  /** Position y, meters, world space. */
  py: number;
  /** Position z, meters, world space. */
  pz: number;
  /** Velocity x, m/s. */
  vx: number;
  /** Velocity y, m/s. */
  vy: number;
  /** Velocity z, m/s. */
  vz: number;
};

/**
 * Rigid state for one glass shard: point mass plus Euler-rate spin and a
 * settled latch that freezes the body once it comes to rest on the floor.
 */
export type ShardBody = BallBody & {
  /** Angular velocity around x, rad/s. */
  wx: number;
  /** Angular velocity around y, rad/s. */
  wy: number;
  /** Angular velocity around z, rad/s. */
  wz: number;
  /** Distance from shard pivot to its lowest point, meters. */
  restHeight: number;
  /** Once true the shard stops integrating and lies still. */
  settled: boolean;
};

/**
 * Advances a ball one step of ballistic flight.
 *
 * @param body - ball state advanced in place
 *
 * @param dt - timestep in seconds
 *
 * @mutates body - position and velocity advance by one integration step.
 *
 * @example
 * ```ts
 * stepBallFlight({ body, dt: 1 / 60 },);
 * ```
 */
export function stepBallFlight(
  {
    body,
    dt,
  }: Readonly<{
    body: BallBody;
    dt: number;
  }>,
): void {
  body.vy -= GRAVITY * dt;
  body.px += body.vx * dt;
  body.py += body.vy * dt;
  body.pz += body.vz * dt;
}

/**
 * Advances one shard: ballistic flight, then floor contact with bounce,
 * friction, spin loss, and a settle latch. Settled shards return
 * immediately so resting debris costs nothing.
 *
 * @param body - shard state advanced in place
 *
 * @param dt - timestep in seconds
 *
 * @param floorY - world-space floor height the shard rests on
 *
 * @returns true when this step bounced off the floor, for impact ticks
 *
 * @mutates body - position, velocity, spin, and the settled latch advance.
 *
 * @example
 * ```ts
 * const bounced = stepShardBody({ body, dt: 1 / 60, floorY: 0 },);
 * ```
 */
export function stepShardBody(
  {
    body,
    dt,
    floorY,
  }: Readonly<{
    body: ShardBody;
    dt: number;
    floorY: number;
  }>,
): boolean {
  if (body.settled)
    return false;
  body.vy -= GRAVITY * dt;
  body.px += body.vx * dt;
  body.py += body.vy * dt;
  body.pz += body.vz * dt;
  /**
   * Height at which the shard's lowest point touches the floor.
   */
  const contactHeight = floorY + body.restHeight;
  if (body.py > contactHeight || body.vy > 0)
    return false;
  body.py = contactHeight;
  /**
   * Impact speed downward; decides bounce versus settle.
   */
  const impactSpeed = -body.vy;
  if (impactSpeed < SHARD_CONTACT_TUNING.settleSpeed) {
    body.vx = 0;
    body.vy = 0;
    body.vz = 0;
    body.wx = 0;
    body.wy = 0;
    body.wz = 0;
    body.settled = true;
    return true;
  }
  body.vy = impactSpeed * SHARD_CONTACT_TUNING.restitution;
  body.vx *= SHARD_CONTACT_TUNING.tangentialKeep;
  body.vz *= SHARD_CONTACT_TUNING.tangentialKeep;
  body.wx *= SHARD_CONTACT_TUNING.spinKeep;
  body.wy *= SHARD_CONTACT_TUNING.spinKeep;
  body.wz *= SHARD_CONTACT_TUNING.spinKeep;
  return true;
}

/**
 * Crossing of a movement segment with the pane midplane, in pane-local
 * coordinates.
 */
export type PaneCrossing = {
  /** Crossing x in pane-local meters. */
  readonly x: number;
  /** Crossing y in pane-local meters. */
  readonly y: number;
  /** Segment interpolation parameter of the crossing, 0 to 1. */
  readonly t: number;
};

/**
 * Intersects a movement segment with the pane plane z = 0 and reports the
 * crossing when it lies inside the pane rectangle. Both endpoints must
 * already be transformed into pane-local space; doing the test locally
 * makes pane orientation irrelevant.
 *
 * A swept segment instead of a point-in-slab test means fast balls cannot
 * tunnel through thin glass between frames.
 *
 * @param fromX - segment start x, pane-local
 *
 * @param fromY - segment start y, pane-local
 *
 * @param fromZ - segment start z, pane-local
 *
 * @param toX - segment end x, pane-local
 *
 * @param toY - segment end y, pane-local
 *
 * @param toZ - segment end z, pane-local
 *
 * @param halfWidth - pane half width, meters
 *
 * @param halfHeight - pane half height, meters
 *
 * @returns crossing point and parameter, or undefined when the segment
 *   misses the pane
 *
 * @example
 * ```ts
 * const hit = paneSegmentCrossing({
 *   fromX: 0, fromY: 0, fromZ: 1,
 *   toX: 0, toY: 0, toZ: -1,
 *   halfWidth: 1, halfHeight: 1.3,
 * },);
 * ```
 */
export function paneSegmentCrossing(
  {
    fromX,
    fromY,
    fromZ,
    toX,
    toY,
    toZ,
    halfWidth,
    halfHeight,
  }: Readonly<{
    fromX: number;
    fromY: number;
    fromZ: number;
    toX: number;
    toY: number;
    toZ: number;
    halfWidth: number;
    halfHeight: number;
  }>,
): PaneCrossing | undefined {
  if (fromZ <= 0 === toZ <= 0)
    return undefined;
  /**
   * Interpolation parameter where the segment crosses z = 0.
   */
  const t = fromZ / (fromZ - toZ);
  /**
   * Crossing x on the pane plane.
   */
  const x = fromX + (toX - fromX) * t;
  /**
   * Crossing y on the pane plane.
   */
  const y = fromY + (toY - fromY) * t;
  if (Math.abs(x,) > halfWidth || Math.abs(y,) > halfHeight)
    return undefined;
  return {
    x,
    y,
    t,
  };
}
