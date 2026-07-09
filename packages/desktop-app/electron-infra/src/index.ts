/**
 * Reusable no-Vite Electron app build, distribution, and Wayland-test helpers.
 *
 * @example
 * ```ts
 * import { stageElectronApp } from '@monochromatic-dev/desktop-app-electron-infra/ts';
 * ```
 *
 * @packageDocumentation
 */

export {
  writeJsonFileAtomically,
  type JsonObject,
  type JsonScalar,
} from './atomic-json.ts';
export {
  distributeElectronApp,
  selectDistributionTargets,
  type ElectronAppDistributionOptions,
} from './distribute.ts';
export {
  parseElectronDistributionArgs,
  type DistributionCliOptions,
} from './distribution-args.ts';
export {
  DISTRIBUTION_TARGETS,
  targetKey,
  type DistributionArch,
  type DistributionPlatform,
  type DistributionTarget,
} from './distribution-targets.ts';
export { readElectronVersion, } from './electron-version.ts';
export {
  stageElectronApp,
  type ElectronAppStageOptions,
  type StaticAssetMapping,
} from './stage.ts';
export {
  runWaylandElectronBoundaryTest,
  type ExpectedObservedState,
  type WaylandBoundaryStep,
  type WaylandElectronBoundaryTestOptions,
} from './wayland-test.ts';
