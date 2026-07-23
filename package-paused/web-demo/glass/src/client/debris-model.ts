/**
 * Debris data model: slot state and the system contract.
 *
 * Split from the debris system so the pool logic stays under the
 * file-size budget while sharing one vocabulary.
 */
import type {
  Matrix4,
  Quaternion,
  Vector3,
} from 'three/webgpu';

import type {
  PaneCell,
  RandomSource,
} from './fracture.ts';
import type { ShardBody, } from './physics.ts';

/**
 * One live shard: pooled ids plus simulation state.
 */
export type ShardSlot = {
  /**
   * BatchedMesh instance id.
   */
  readonly instanceId: number;
  /**
   * BatchedMesh geometry id, freed together with the instance.
   */
  readonly geometryId: number;
  /**
   * Simulated rigid state.
   */
  readonly body: ShardBody;
  /**
   * Current orientation, advanced by the spin rates each frame.
   */
  readonly orientation: Quaternion;
  /**
   * Seconds since spawn.
   */
  age: number;
  /**
   * Seconds since settling; NaN while airborne.
   */
  settledFor: number;
  /**
   * Yaw-randomized lie-flat orientation blended in after settling.
   */
  flatTarget?: Quaternion;
  /**
   * Random yaw applied to the lie-flat orientation, radians.
   */
  readonly flatYaw: number;
  /**
   * Resting pivot height once lying flat, meters.
   */
  readonly flatHeight: number;
  /**
   * Seconds since the fade-out began; NaN while fully alive.
   */
  fadingFor: number;
};

/**
 * One shatter's worth of spawn parameters.
 */
export type SpawnShardsInput = {
  /**
   * Pane-local fracture cells.
   */
  readonly cells: readonly PaneCell[];
  /**
   * Pane glass thickness in meters.
   */
  readonly thickness: number;
  /**
   * Pane local-to-world matrix in meters.
   */
  readonly paneMatrix: Matrix4;
  /**
   * Impact point in world space.
   */
  readonly impactWorld: Vector3;
  /**
   * Ball velocity at impact in world space.
   */
  readonly ballVelocity: Vector3;
  /**
   * Uniform random source.
   */
  readonly random: RandomSource;
};

/**
 * Debris system handle.
 */
export type DebrisSystem = {
  /**
   * Turns fracture cells into flying shards.
   *
   * @param cells - pane-local fracture cells
   *
   * @param thickness - pane glass thickness in meters
   *
   * @param paneMatrix - pane local-to-world matrix in meters
   *
   * @param impactWorld - impact point in world space
   *
   * @param ballVelocity - ball velocity at impact in world space
   *
   * @param random - uniform random source
   */
  readonly spawnShards: (input: SpawnShardsInput,) => void;
  /**
   * Advances all shards one frame.
   *
   * @param dt - timestep in seconds
   *
   * @param cameraZ - walk position; shards fallen behind it release
   *
   * @returns floor bounces this frame, for impact ticks
   */
  readonly update: (input: Readonly<{
    dt: number;
    cameraZ: number;
  }>,) => number;
};
