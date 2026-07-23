/**
 * Crack overlay lifecycle: painting the rim's spider web onto the pane.
 *
 * The overlay draws only the surviving rim cells: the hole region stays
 * clear because there is no glass left there to crack. Additive blending
 * lets the web read on top of the transmission glass without occluding
 * the corridor behind it.
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
import type { PanePoint, } from './fracture.ts';
import { UNIT_PLANE, } from './pane-assembly.ts';
import {
  type Pane,
  PANE_TUNING,
} from './pane-model.ts';

/**
 * Mounts the crack overlay painted from a pane's stored rim cells.
 *
 * @param pane - cracked pane whose rim cells are already stored
 *
 * @param impactLocal - impact point in pane-local meters
 *
 * @mutates pane - `overlay.scale.set` and `overlay.position.copy(pane.glass.position)` place the overlay through three.js methods the analyzer cannot inspect, `position.add(lift)` offsets it off the sheet, `pane.group.add(overlay)` mounts it, and the overlay and overlayMaterial slots fill.
 *
 * @example
 * ```ts
 * attachCrackOverlay({
 *   pane,
 *   impactLocal: { x: 0.1, y: -0.2 },
 * },);
 * ```
 */
export function attachCrackOverlay(
  {
    pane,
    impactLocal,
  }: {
    readonly pane: Pane;
    readonly impactLocal: PanePoint;
  },
): void {
  /**
   * Crack texture painted from the surviving rim cells; the hole region
   * stays unpainted because its glass is already gone.
   */
  const texture = new CanvasTexture(paintCrackWeb({
    cells: pane.rimCells ?? [],
    impact: impactLocal,
    halfWidth: pane.halfWidth,
    halfHeight: pane.halfHeight,
    omitImpactBlob: true,
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
  /**
   * Player-facing offset lifting the overlay off the sheet plane.
   */
  const lift = new Vector3(
    0,
    0,
    (PANE_TUNING.thickness / 2) + PANE_TUNING.overlayLift,
  );
  /**
   * Overlay position alias keeping each mutation a single statement.
   */
  const { position, } = overlay;
  position.copy(pane.glass
    .position,);
  position.add(lift,);
  pane.group
    .add(overlay,);
  pane.overlay = overlay;
  pane.overlayMaterial = overlayMaterial;
}

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
