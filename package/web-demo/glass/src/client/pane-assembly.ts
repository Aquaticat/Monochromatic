/**
 * Pane construction helpers: shared unit geometry, shared materials, the
 * assembly builder, and the meters-space pane frame.
 *
 * Every frame bar and glass sheet is a scaled unit box, so pane churn
 * while the corridor recycles allocates no geometry at all.
 */
import {
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  type Scene,
  Vector3,
} from 'three/webgpu';

import {
  type Pane,
  PANE_TUNING,
} from './pane-model.ts';

/**
 * Unit box shared by every frame bar and glass sheet; per-mesh scale sets
 * the real dimensions.
 */
const UNIT_BOX = new BoxGeometry(
  1,
  1,
  1,
);

/**
 * Unit plane shared by every crack overlay and manifestation band.
 */
export const UNIT_PLANE: PlaneGeometry = new PlaneGeometry(
  1,
  1,
);

/**
 * Scratch decomposition target for {@link paneFrame}.
 */
const SCRATCH_POSITION = new Vector3();
/**
 * Scratch scale target for {@link paneFrame}, discarded after decompose.
 */
const SCRATCH_SCALE = new Vector3();

/**
 * Meters-space world frame of a pane's glass: the glass world transform
 * with the unit-box scale replaced by identity, so meter-valued fracture
 * data maps into the world without double scaling.
 *
 * @param pane - pane whose frame to compute
 *
 * @mutates pane - `pane.glass.matrixWorld.decompose(...)` is a three.js method the analyzer cannot inspect; it only reads the matrix.
 *
 * @returns fresh local-to-world matrix in meters
 *
 * @example
 * ```ts
 * const matrix = paneFrame(pane,);
 * ```
 */
export function paneFrame(pane: Pane,): Matrix4 {
  /**
   * Orientation extracted from the glass world matrix.
   */
  const rotation = new Quaternion();
  pane.glass
    .matrixWorld
    .decompose(
      SCRATCH_POSITION,
      rotation,
      SCRATCH_SCALE,
    );
  return new Matrix4().compose(
    SCRATCH_POSITION,
    rotation,
    SCRATCH_SCALE.set(
      1,
      1,
      1,
    ),
  );
}

/**
 * Shared materials every pane assembly reuses.
 */
export type PaneMaterials = {
  /**
   * Physically based transmission glass.
   */
  readonly glass: MeshPhysicalMaterial;
  /**
   * Dark anodized frame metal.
   */
  readonly frame: MeshStandardMaterial;
  /**
   * Frosted manifestation band.
   */
  readonly band: MeshBasicMaterial;
};

/**
 * Creates the three shared pane materials once per system.
 *
 * The glass gets full transmission, low roughness, and a strong
 * environment so reflections carry the look. Not `transparent`:
 * transmission already refracts the backdrop, and stacking alpha
 * blending on top washes the material out. The band is the head-on
 * visibility cue that pure transmission glass lacks at normal incidence,
 * matching the safety strips real glass walls carry.
 *
 * @returns shared pane materials
 *
 * @example
 * ```ts
 * const materials = createPaneMaterials();
 * ```
 */
export function createPaneMaterials(): PaneMaterials {
  return {
    glass: new MeshPhysicalMaterial({
      color: '#eaf6fb',
      metalness: 0,
      roughness: 0.04,
      transmission: 1,
      thickness: PANE_TUNING.thickness * PANE_TUNING.glassDepthFactor,
      ior: 1.52,
      envMapIntensity: 1.6,
    },),
    frame: new MeshStandardMaterial({
      color: '#222c39',
      metalness: 0.72,
      roughness: 0.34,
    },),
    band: new MeshBasicMaterial({
      color: '#dff2fb',
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    },),
  };
}

/**
 * Placement spec for one pane assembly.
 */
export type PaneSpec = {
  /**
   * Gate panes block the walk; wall panes line the corridor sides.
   */
  readonly kind: 'gate' | 'wall';
  /**
   * Glass half width in meters.
   */
  readonly halfWidth: number;
  /**
   * Glass half height in meters.
   */
  readonly halfHeight: number;
  /**
   * Glass center height in meters.
   */
  readonly centerY: number;
  /**
   * Assembly x in world space.
   */
  readonly x: number;
  /**
   * Assembly z in world space.
   */
  readonly z: number;
  /**
   * Assembly yaw; walls face the corridor center.
   */
  readonly rotationY: number;
};

/**
 * Builds and registers one pane assembly: sheet subgroup (glass plus
 * manifestation bands) and four frame bars.
 *
 * @param scene - scene receiving the assembly
 *
 * @param materials - shared pane materials
 *
 * @param registry - live pane list the new pane joins
 *
 * @param spec - placement spec
 *
 * @mutates scene - `scene.add(group)` registers the assembly in the caller's scene graph.
 *
 * @mutates registry - the fresh pane is pushed onto the caller's list.
 *
 * @mutates materials - meshes hold references to the shared materials; three.js may lazily initialize them on first render.
 *
 * @example
 * ```ts
 * assemblePane({ scene, materials, registry, spec },);
 * ```
 */
export function assemblePane(
  {
    scene,
    materials,
    registry,
    spec,
  }: Readonly<{
    scene: Scene;
    materials: PaneMaterials;
    registry: Pane[];
    spec: PaneSpec;
  }>,
): void {
  /**
   * Assembly root.
   */
  const group = new Group();
  group.position
    .set(
      spec.x,
      0,
      spec.z,
    );
  group.rotation
    .y = spec.rotationY;
  /**
   * Sheet subgroup removed wholesale on collapse.
   */
  const sheet = new Group();
  group.add(sheet,);
  /**
   * Breakable glass sheet, a scaled unit box.
   */
  const glass = new Mesh(
    UNIT_BOX,
    materials.glass,
  );
  glass.scale
    .set(
      spec.halfWidth * 2,
      spec.halfHeight * 2,
      PANE_TUNING.thickness,
    );
  glass.position
    .set(
      0,
      spec.centerY,
      0,
    );
  sheet.add(glass,);
  for (
    const bandY of [
      PANE_TUNING.band
        .lowY,
      PANE_TUNING.band
        .highY,
    ]
  ) {
    /**
     * One frosted manifestation band across the glass.
     */
    const band = new Mesh(
      UNIT_PLANE,
      materials.band,
    );
    band.scale
      .set(
        spec.halfWidth * 2,
        PANE_TUNING.band
          .height,
        1,
      );
    band.position
      .set(
        0,
        bandY,
        (PANE_TUNING.thickness / 2)
          + PANE_TUNING.band
          .lift,
      );
    sheet.add(band,);
  }
  /**
   * Builds one frame bar as a scaled unit box.
   *
   * @param sizeX - bar width in meters
   *
   * @param sizeY - bar height in meters
   *
   * @param x - bar center x in assembly space
   *
   * @param y - bar center y in assembly space
   *
   * @returns bar mesh
   */
  function bar(
    {
      sizeX,
      sizeY,
      x,
      y,
    }: Readonly<{
      sizeX: number;
      sizeY: number;
      x: number;
      y: number;
    }>,
  ): Mesh {
    /**
     * One frame bar.
     */
    const mesh = new Mesh(
      UNIT_BOX,
      materials.frame,
    );
    mesh.scale
      .set(
        sizeX,
        sizeY,
        PANE_TUNING.frameBar * PANE_TUNING.barDepthFactor,
      );
    mesh.position
      .set(
        x,
        y,
        0,
      );
    return mesh;
  }
  /**
   * Half bar cross-section, spacing bars off the glass edges.
   */
  const barHalf = PANE_TUNING.frameBar / 2;
  group.add(
    bar({
      sizeX: (spec.halfWidth * 2) + (PANE_TUNING.frameBar * 2),
      sizeY: PANE_TUNING.frameBar,
      x: 0,
      y: spec.centerY + spec.halfHeight
        + barHalf,
    },),
    bar({
      sizeX: (spec.halfWidth * 2) + (PANE_TUNING.frameBar * 2),
      sizeY: PANE_TUNING.frameBar,
      x: 0,
      y: spec.centerY - spec.halfHeight
        - barHalf,
    },),
    bar({
      sizeX: PANE_TUNING.frameBar,
      sizeY: spec.halfHeight * 2,
      x: -spec.halfWidth - barHalf,
      y: spec.centerY,
    },),
    bar({
      sizeX: PANE_TUNING.frameBar,
      sizeY: spec.halfHeight * 2,
      x: spec.halfWidth + barHalf,
      y: spec.centerY,
    },),
  );
  scene.add(group,);
  group.updateMatrixWorld(true,);
  registry.push({
    kind: spec.kind,
    group,
    sheet,
    glass,
    halfWidth: spec.halfWidth,
    halfHeight: spec.halfHeight,
    state: 'intact',
    holdUntil: Number.POSITIVE_INFINITY,
  },);
}
