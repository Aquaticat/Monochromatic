/**
 * Pure launch math for glass shards: momentum transfer, radial burst,
 * jitter, and spin, on plain numbers so the whole ballistic setup
 * unit-tests in node.
 */
import type { ShardBody, } from './physics.ts';

/**
 * Debris pool sizing, lifetime, and launch constants.
 */
export const DEBRIS_TUNING = {
  /**
   * Hard cap on live shard instances across all panes.
   */
  maxInstances: 512,
  /**
   * Vertex budget for the batched buffer.
   */
  maxVertices: 42_000,
  /**
   * Index budget for the batched buffer.
   */
  maxIndices: 70_000,
  /**
   * Instance count that triggers force-fading the oldest shards.
   */
  softCap: 440,
  /**
   * Seconds a settled shard stays before fading out; long, because the
   * walk passes settled debris and culls it behind the camera first.
   */
  persistSeconds: 30,
  /**
   * Seconds a shard may fly before force-fading, settled or not.
   */
  maxLifeSeconds: 30,
  /**
   * Distance behind the camera at which shards release instantly, meters.
   */
  cullBehind: 3,
  /**
   * Seconds the fade-out shrink takes.
   */
  fadeSeconds: 0.45,
  /**
   * Seconds the lie-flat blend after settling takes.
   */
  flattenSeconds: 0.16,
  /**
   * Cells below this area in square meters become sparks, not shards.
   */
  minShardArea: 0.0004,
  /**
   * Ball momentum transfer factor at the impact point.
   */
  punchTransfer: 0.42,
  /**
   * Quadratic falloff rate of momentum transfer with distance.
   */
  punchFalloff: 9,
  /**
   * Radial burst speed scale in m/s.
   */
  radialBurst: 1.15,
  /**
   * Distance softening the radial burst so the center cell stays finite.
   */
  radialSoftening: 0.4,
  /**
   * Random velocity jitter half-ranges per axis, m/s.
   */
  jitter: {
    x: 0.25,
    y: 0.2,
    z: 0.25,
  },
  /**
   * Spin magnitude base and random spread, rad/s before size scaling.
   */
  spin: {
    base: 1.5,
    spread: 6,
    /**
     * Size offset in the divisor so tiny shards do not spin infinitely.
     */
    sizeOffset: 0.25,
  },
  /**
   * Tumbling rest height as a fraction of the shard size.
   */
  restHeightFactor: 0.3,
  /**
   * Extra lift above half thickness once lying flat, meters.
   */
  flatLift: 0.002,
  /**
   * Squared radial length treated as zero to avoid normalizing noise.
   */
  negligibleRadiusSq: 1e-8,
  /**
   * Spin speed below which the orientation stops integrating, rad/s.
   */
  spinEpsilon: 1e-6,
} as const;

/**
 * Plain xyz triple used by the launch math.
 */
export type Triple = {
  /**
   * X component.
   */
  readonly x: number;
  /**
   * Y component.
   */
  readonly y: number;
  /**
   * Z component.
   */
  readonly z: number;
};

/**
 * Computes one shard's initial rigid state.
 *
 * Momentum transfer falls off quadratically with pane-local distance from
 * the impact, so near shards fly with the ball while far shards mostly
 * drop; the radial burst pushes everything away from the hole; jitter and
 * size-scaled spin keep the cloud from looking machined.
 *
 * @param pivot - shard pivot in world space
 *
 * @param impact - impact point in world space
 *
 * @param ballVelocity - ball velocity at impact, world m/s
 *
 * @param impactDistance - pane-local distance from impact to pivot, meters
 *
 * @param thickness - glass thickness in meters
 *
 * @param size - shard characteristic size in meters
 *
 * @param random - uniform random source
 *
 * @mutates random - jitter and spin draws advance the caller-supplied generator state.
 *
 * @returns fresh shard body ready for integration
 *
 * @example
 * ```ts
 * const body = launchShardBody({
 *   pivot: { x: 0, y: 1.6, z: -12 },
 *   impact: { x: 0.1, y: 1.5, z: -12 },
 *   ballVelocity: { x: 0, y: 0, z: -16 },
 *   impactDistance: 0.14,
 *   thickness: 0.012,
 *   size: 0.12,
 *   random: Math.random,
 * },);
 * ```
 */
export function launchShardBody(
  {
    pivot,
    impact,
    ballVelocity,
    impactDistance,
    thickness,
    size,
    random,
  }: {
    readonly pivot: Triple;
    readonly impact: Triple;
    readonly ballVelocity: Triple;
    readonly impactDistance: number;
    readonly thickness: number;
    readonly size: number;
    readonly random: () => number;
  },
): ShardBody {
  /**
   * Momentum transfer weight: strong at the impact, negligible far away.
   */
  const punch = DEBRIS_TUNING.punchTransfer
    / (1 + (DEBRIS_TUNING.punchFalloff * (impactDistance ** 2)));
  /**
   * Raw radial offset from the impact to the pivot, world space.
   */
  const radialX = pivot.x - impact.x;
  /**
   * Radial y component before normalization.
   */
  const radialY = pivot.y - impact.y;
  /**
   * Radial z component before normalization.
   */
  const radialZ = pivot.z - impact.z;
  /**
   * Squared radial length deciding whether a direction exists at all.
   */
  const radialSq = (radialX * radialX) + (radialY * radialY)
    + (radialZ * radialZ);
  /**
   * Radial speed scale after softening; zero for the center cell.
   */
  const radialScale = radialSq < DEBRIS_TUNING.negligibleRadiusSq
    ? 0
    : DEBRIS_TUNING.radialBurst
      / ((DEBRIS_TUNING.radialSoftening + impactDistance) * Math.sqrt(radialSq,));
  /**
   * Spin magnitude: small shards whirl, big plates tumble slowly.
   */
  const spin = (DEBRIS_TUNING.spin
    .base
    + (random()
      * DEBRIS_TUNING.spin
      .spread))
    / (DEBRIS_TUNING.spin
      .sizeOffset
      + (size * 2));
  return {
    px: pivot.x,
    py: pivot.y,
    pz: pivot.z,
    vx: (ballVelocity.x * punch) + (radialX * radialScale)
      + ((random() - (1 / 2))
        * 2
        * DEBRIS_TUNING.jitter
        .x),
    vy: (ballVelocity.y * punch) + (radialY * radialScale)
      + ((random() - (1 / 2))
        * 2
        * DEBRIS_TUNING.jitter
        .y),
    vz: (ballVelocity.z * punch) + (radialZ * radialScale)
      + ((random() - (1 / 2))
        * 2
        * DEBRIS_TUNING.jitter
        .z),
    wx: (random() - (1 / 2)) * 2
      * spin,
    wy: (random() - (1 / 2)) * 2
      * spin,
    wz: (random() - (1 / 2)) * 2
      * spin,
    restHeight: (thickness / 2) + (size * DEBRIS_TUNING.restHeightFactor),
    settled: false,
  };
}
