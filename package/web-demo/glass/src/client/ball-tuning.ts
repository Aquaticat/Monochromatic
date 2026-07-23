/**
 * Ball throw and flight constants, in their own module so the sweep
 * resolver and the pool share them without a circular import.
 */

/**
 * Throw and flight constants.
 */
export const BALL_TUNING = {
  /**
   * Ball radius in meters.
   */
  radius: 0.085,
  /**
   * Throw speed in m/s before the walk velocity adds on.
   */
  throwSpeed: 16,
  /**
   * Concurrent ball cap; the oldest ball retires when exceeded.
   */
  poolSize: 8,
  /**
   * Seconds a ball may live before retiring.
   */
  maxLifeSeconds: 5,
  /**
   * Speed kept when punching through collapsing glass.
   */
  punchThroughKeep: 0.62,
  /**
   * Normal-direction speed kept when rebounding off cracked glass.
   */
  reboundKeep: 0.32,
  /**
   * Floor bounce restitution for balls.
   */
  floorRestitution: 0.48,
  /**
   * Horizontal speed kept on each floor bounce.
   */
  floorDrag: 0.85,
  /**
   * Sphere tessellation for the shared ball geometry.
   */
  sphereSegments: {
    width: 20,
    height: 14,
  },
  /**
   * Launch offset from the eye: forward along the throw, then a small
   * right-and-down shift so the ball leaves like a hand throw.
   */
  hand: {
    forward: 0.45,
    right: 0.12,
    down: 0.14,
  },
  /**
   * Upward bias added to the throw, m/s.
   */
  throwLift: 0.6,
  /**
   * Distance behind or past the camera at which balls retire, meters.
   */
  cullDistance: 80,
} as const;
