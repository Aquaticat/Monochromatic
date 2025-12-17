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
function withNoMinify(
  config: UserConfig | VitestUserConfig,
): UserConfig | VitestUserConfig {
  return mergeConfig(config, { build: { minify: false, }, },);
}

function withNodeResolveConditions(config: UserConfig,): UserConfig;
function withNodeResolveConditions(config: VitestUserConfig,): VitestUserConfig;
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

    // Apply mode-specific transformations using reduce for immutability
    const config = modes.reduce(
      (currentConfig: UserConfig | VitestUserConfig, currentMode,):
        | UserConfig
        | VitestUserConfig =>
      {
        switch (currentMode) {
          case 'development':
            return withNoMinify(currentConfig,);
          case 'node':
            return withNodeResolveConditions(currentConfig,);
          default:
            return currentConfig;
        }
      },
      sharedFactory(configDir,),
    );

    return config;
  };
}

//endregion Configuration Modifiers

export {
  withNoMinify,
  withNodeResolveConditions,
  createModeConfig,
};
