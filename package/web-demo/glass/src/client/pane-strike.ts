/**
 * The crack stage: registering a ball strike on a pane.
 *
 * A first hit computes the fracture cells, paints them as the spider-web
 * overlay, and arms the hold timer; a second hit collapses the hold
 * immediately. Kept beside, not inside, the pane system so both files
 * stay under the size budget.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Mesh,
  MeshBasicMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three/webgpu';

import { paintCrackWeb, } from './crack-texture.ts';
import {
  fractureCells,
  type PanePoint,
  type RandomSource,
} from './fracture.ts';
import { UNIT_PLANE, } from './pane-assembly.ts';
import {
  type Pane,
  PANE_TUNING,
  type PaneState,
} from './pane-model.ts';

/**
 * Disposes a pane's crack overlay resources, when present.
 *
 * @param pane - pane whose overlay should be dropped
 *
 * @mutates pane - `pane.overlayMaterial.map.dispose()` and `pane.overlayMaterial.dispose()` free the crack texture, `pane.group.remove(pane.overlay)` detaches the overlay, and the overlay and overlayMaterial slots clear.
 *
 * @example
 * ```ts
 * dropOverlay(pane,);
 * ```
 */
export function dropOverlay(pane: Pane,): void {
  if ((pane.overlay === undefined) || (pane.overlayMaterial === undefined))
    return;
  pane.overlayMaterial
    .map
    ?.dispose();
  pane.overlayMaterial
    .dispose();
  pane.group
    .remove(pane.overlay,);
  delete pane.overlay;
  delete pane.overlayMaterial;
}

/**
 * Registers a ball strike: cracks an intact pane or collapses the hold of
 * an already-cracked one. The fracture is computed once here and reused
 * at collapse, so the crack lines and the shard boundaries are the same
 * lines.
 *
 * @param pane - struck pane
 *
 * @param impactLocal - impact point in pane-local meters
 *
 * @param ballVelocity - ball velocity at impact, world m/s
 *
 * @param now - wall-clock seconds
 *
 * @param random - uniform random source
 *
 * @mutates pane - the break state, cells, hold timer, and impact snapshot advance; `pane.group.add(overlay)` attaches the crack overlay; `overlay.position.copy(pane.glass.position)` reads the sheet position through a three.js method the analyzer cannot inspect.
 *
 * @mutates ballVelocity - `ballVelocity.clone()` is a three.js method the analyzer cannot inspect; it only reads components.
 *
 * @mutates random - fracture and hold-timer draws advance the caller-supplied generator state.
 *
 * @returns the stage the pane entered
 *
 * @example
 * ```ts
 * const stage = strikePane({
 *   pane,
 *   impactLocal: { x: 0.1, y: -0.2 },
 *   ballVelocity,
 *   now: 12.4,
 *   random: Math.random,
 * },);
 * ```
 */
export function strikePane(
  {
    pane,
    impactLocal,
    ballVelocity,
    now,
    random,
  }: {
    readonly pane: Pane;
    readonly impactLocal: PanePoint;
    readonly ballVelocity: Vector3;
    readonly now: number;
    readonly random: RandomSource;
  },
): PaneState {
  if (pane.state === 'cracked') {
    pane.holdUntil = now;
    pane.impactLocal = impactLocal;
    pane.impactVelocity = ballVelocity.clone();
    return 'shattered';
  }
  /**
   * Fracture computed once at crack time and reused at collapse.
   */
  const cells = fractureCells({
    halfWidth: pane.halfWidth,
    halfHeight: pane.halfHeight,
    impact: impactLocal,
    random,
  },);
  pane.cells = cells;
  pane.impactLocal = impactLocal;
  pane.impactVelocity = ballVelocity.clone();
  pane.holdUntil = now
    + PANE_TUNING.holdMin
    + (random() * PANE_TUNING.holdExtra);
  pane.state = 'cracked';
  /**
   * Crack texture painted from the exact fracture cells.
   */
  const texture = new CanvasTexture(paintCrackWeb({
    cells,
    impact: impactLocal,
    halfWidth: pane.halfWidth,
    halfHeight: pane.halfHeight,
  },),);
  texture.colorSpace = SRGBColorSpace;
  /**
   * Additive overlay material owning the crack texture.
   */
  const overlayMaterial = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  },);
  /**
   * Additive overlay plane on the player-facing surface.
   */
  const overlay = new Mesh(
    UNIT_PLANE,
    overlayMaterial,
  );
  overlay.scale
    .set(
      pane.halfWidth * 2,
      pane.halfHeight * 2,
      1,
    );
  overlay.position
    .copy(pane.glass
      .position,)
    .add(new Vector3(
      0,
      0,
      (PANE_TUNING.thickness / 2) + PANE_TUNING.overlayLift,
    ),);
  pane.group
    .add(overlay,);
  pane.overlay = overlay;
  pane.overlayMaterial = overlayMaterial;
  return 'cracked';
}
