/* oxlint-disable typescript/no-duplicate-type-constituents -- vitest and vite right now has the exact same types, but may not be sometimes */

import {
  mergeConfig,
  type UserConfig,
  type UserConfigFnObject,
} from 'vite';
import type {
  ViteUserConfig as VitestUserConfig,
  ViteUserConfigFnObject as VitestUserConfigFnObject,
} from 'vitest/config';

//region Configuration Modifiers -- Functions that enhance base configs

function withNoMinify(config: UserConfig,): UserConfig;
function withNoMinify(config: VitestUserConfig,): VitestUserConfig;
/**
 * Disables minification in the build output.
 * Useful for development mode where readable output is preferred.
 *
 * @param config - Vite or Vitest config to modify
 *
 * @returns config with minification disabled
 */
function withNoMinify(
  config: UserConfig | VitestUserConfig,
): UserConfig | VitestUserConfig {
  return mergeConfig(config, { build: { minify: false, }, },);
}

function withNodeResolveConditions(config: UserConfig,): UserConfig;
function withNodeResolveConditions(config: VitestUserConfig,): VitestUserConfig;
/**
 * Adds Node.js-specific resolve conditions and sets the output filename to `index.node`.
 * Applied when the build mode includes `node`.
 *
 * @param config - Vite or Vitest config to modify
 *
 * @returns config with Node resolve conditions
 */
function withNodeResolveConditions(
  config: UserConfig | VitestUserConfig,
): UserConfig | VitestUserConfig {
  return mergeConfig(config, {
    resolve: {
      conditions: ['node', 'module', 'import', 'default',],
    },
    build: {
      lib: {
        fileName: 'index.node',
      },
    },
  },);
}

function createModeConfig(configDir: string,
  sharedFactory: (configDir: string,) => UserConfig,): UserConfigFnObject;
function createModeConfig(configDir: string,
  sharedFactory: (configDir: string,) => VitestUserConfig,): VitestUserConfigFnObject;
/**
 * Creates a Vite config function that applies mode-specific transformations
 * (e.g. `development` disables minification, `node` adds Node resolve conditions).
 *
 * @param configDir - absolute path to the package directory
 *
 * @param sharedFactory - factory that creates the base config from `configDir`
 *
 * @returns Vite config function that applies mode-based enhancements
 */
function createModeConfig(configDir: string,
  sharedFactory: (configDir: string,) => UserConfig | VitestUserConfig,
): UserConfigFnObject | VitestUserConfigFnObject {
  return function enhanceBaseConfig({ mode, },) {
    // Parse modes from space or comma-separated string
    const modes = mode.includes(' ',)
      ? mode.split(' ',)
      : (mode.includes(',',)
        ? mode.split(',',)
        : [mode,]);

    /**
     * Applies the mode-specific transformation for a single mode string.
     *
     * @param currentConfig - accumulated config so far
     *
     * @param currentMode - mode identifier to apply
     *
     * @returns config with mode-specific modifications applied
     */
    function applyModeTransform(
      currentConfig: UserConfig | VitestUserConfig,
      currentMode: string,
    ): UserConfig | VitestUserConfig {
      if (currentMode === 'development') {
        return withNoMinify(currentConfig,);
      }
      if (currentMode === 'node') {
        return withNodeResolveConditions(currentConfig,);
      }
      return currentConfig;
    }

    // Apply mode-specific transformations using reduce for immutability
    const config = modes.reduce(function applyMode(currentConfig, currentMode) { return applyModeTransform(currentConfig, currentMode); }, sharedFactory(configDir,),);

    return config;
  };
}

//endregion Configuration Modifiers

export {
  createModeConfig,
  withNodeResolveConditions,
  withNoMinify,
};
