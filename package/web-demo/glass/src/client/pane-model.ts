/**
 * Pane data model: tuning table, break states, and the system contract.
 *
 * Split from the pane system so the assembly helpers and the break logic
 * each stay under the file-size budget while sharing one vocabulary.
 */
import type {
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three/webgpu';

import type {
  PaneCell,
  PanePoint,
} from './fracture.ts';

/**
 * Pane layout and staging constants.
 */
export const PANE_TUNING = {
  /**
   * Glass sheet thickness in meters.
   */
  thickness: 0.012,
  /**
   * Distance between successive gate frames along the walk, meters.
   */
  gateSpacing: 5.2,
  /**
   * Distance between successive wall panes per side, meters.
   */
  wallSpacing: 6.8,
  /**
   * How far ahead of the camera panes spawn, meters.
   */
  spawnAhead: 66,
  /**
   * How far behind the camera panes recycle, meters.
   */
  recycleBehind: 4,
  /**
   * Shortest rim hold after the hole is punched, seconds.
   */
  holdMin: 0.4,
  /**
   * Random extra rim hold, seconds.
   */
  holdExtra: 0.45,
  /**
   * Blast radius around the impact whose cells fly immediately, meters.
   */
  holeRadius: 0.34,
  /**
   * Frame bar cross-section in meters.
   */
  frameBar: 0.07,
  /**
   * Camera distance at which unbroken gate glass smashes bodily, meters.
   */
  bodySmashDistance: 0.4,
  /**
   * Material thickness multiplier feeding the transmission volume.
   */
  glassDepthFactor: 8,
  /**
   * Frame bar depth as a multiple of the bar cross-section.
   */
  barDepthFactor: 1.6,
  /**
   * Frosted manifestation bands across each pane.
   */
  band: {
    /**
     * Lower band center height, meters.
     */
    lowY: 1.08,
    /**
     * Upper band center height, meters.
     */
    highY: 1.58,
    /**
     * Band height, meters.
     */
    height: 0.05,
    /**
     * Band offset in front of the glass surface, meters.
     */
    lift: 0.001,
  },
  /**
   * Crack overlay offset in front of the glass surface, meters.
   */
  overlayLift: 0.002,
  /**
   * Fallback impact speed for holds that expire unaided, m/s.
   */
  fallbackImpactSpeed: 6,
  /**
   * Impact speed a body smash imparts, m/s.
   */
  bodySmashSpeed: 5,
  /**
   * Gate pane layout: full-width glass walls whose frame posts land
   * beside the corridor walls, clear of the walking camera.
   */
  gate: {
    /**
     * Smallest glass half width, meters.
     */
    halfWidthBase: 2.25,
    /**
     * Random extra half width, meters.
     */
    halfWidthSpread: 0.3,
    /**
     * Glass half height, meters.
     */
    halfHeight: 1.28,
    /**
     * Glass center height, meters.
     */
    centerY: 1.62,
    /**
     * Largest lateral offset either way, meters.
     */
    offsetSpread: 0.2,
  },
  /**
   * Wall pane layout along the corridor sides.
   */
  wall: {
    /**
     * Glass half width, meters.
     */
    halfWidth: 1.45,
    /**
     * Glass half height, meters.
     */
    halfHeight: 1.22,
    /**
     * Glass center height, meters.
     */
    centerY: 1.58,
    /**
     * Inset from the corridor wall plane, meters.
     */
    inset: 0.09,
  },
} as const;

/**
 * Break stage of one pane. `cracked` means a strike already blasted the
 * hole cells out and the surviving rim holds around a real opening.
 */
export type PaneState = 'intact' | 'cracked' | 'shattered';

/**
 * One pane assembly: frame, glass sheet, and break state.
 */
export type Pane = {
  /**
   * Gate panes block the walk; wall panes line the corridor sides.
   */
  readonly kind: 'gate' | 'wall';
  /**
   * Assembly root, statically placed in the world.
   */
  readonly group: Group;
  /**
   * Sheet subgroup removed on collapse: glass plus manifestation bands.
   */
  readonly sheet: Group;
  /**
   * Breakable glass sheet.
   */
  readonly glass: Mesh;
  /**
   * Glass half width in meters.
   */
  readonly halfWidth: number;
  /**
   * Glass half height in meters.
   */
  readonly halfHeight: number;
  /**
   * Break stage.
   */
  state: PaneState;
  /**
   * Rim cells still holding after the hole flew, reused for the collapse
   * and for ball pass-through tests.
   */
  rimCells?: readonly PaneCell[];
  /**
   * Merged rim mesh standing in for the sheet while the rim holds.
   */
  rimMesh?: Mesh;
  /**
   * Crack overlay mesh alive during the cracked stage.
   */
  overlay?: Mesh;
  /**
   * Overlay material kept typed so disposal needs no assertion.
   */
  overlayMaterial?: MeshBasicMaterial;
  /**
   * Wall-clock seconds when the cracked stage must collapse.
   */
  holdUntil: number;
  /**
   * Impact point of the cracking hit, pane-local meters.
   */
  impactLocal?: PanePoint;
  /**
   * Ball velocity of the cracking hit, world m/s.
   */
  impactVelocity?: Vector3;
};

/**
 * Everything the main loop needs to react to one collapse.
 */
export type ShatterEvent = {
  /**
   * Whether these shards are the instant hole blast or the rim collapse;
   * the main loop scales effects and scoring by stage.
   */
  readonly stage: 'hole' | 'collapse';
  /**
   * Fracture cells to turn into shards.
   */
  readonly cells: readonly PaneCell[];
  /**
   * Pane local-to-world matrix in meters.
   */
  readonly paneMatrix: Matrix4;
  /**
   * Impact point in world space.
   */
  readonly impactWorld: Vector3;
  /**
   * Ball velocity driving the shard burst, world m/s.
   */
  readonly ballVelocity: Vector3;
};

/**
 * Pane system handle.
 */
export type PaneSystem = {
  /**
   * Panes a ball can still hit: intact or cracked.
   */
  readonly collidables: () => readonly Pane[];
  /**
   * Panes currently in the cracked-and-holding stage.
   */
  readonly crackedCount: () => number;
  /**
   * Registers a ball strike on a pane.
   *
   * @returns the stage the pane entered
   */
  readonly strike: (input: Readonly<{
    pane: Pane;
    impactLocal: PanePoint;
    ballVelocity: Vector3;
    now: number;
  }>,) => PaneState;
  /**
   * Spawns ahead, recycles behind, and collapses expired cracked panes.
   *
   * @returns shatter events for this frame
   */
  readonly update: (input: Readonly<{
    cameraZ: number;
    now: number;
  }>,) => ShatterEvent[];
};
