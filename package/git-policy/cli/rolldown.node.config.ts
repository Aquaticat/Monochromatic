import {
  nodeConfig,
  type NodeFlavorConfig,
} from '@monochromatic-dev/config-rolldown/.node.ts';

import packageMetadata from './package.json' with { type: 'json', };

/**
 Separator between independently supported Node runtime lines.
 */
const NODE_ENGINE_RANGE_SEPARATOR = ' || ';
/**
 Prefix for each exact minimum in the Node engine range.
 */
const NODE_ENGINE_RANGE_PREFIX = '^';
/**
 Number of components required by an exact Node runtime version.
 */
const SEMANTIC_VERSION_COMPONENT_COUNT = 3;
/**
 Canonical package runtime contract.
 */
const { node: nodeEngineRange, } = packageMetadata.engines;
/**
 Supported Node runtime ranges from the package manifest.
 */
const nodeEngineRanges = nodeEngineRange.split(NODE_ENGINE_RANGE_SEPARATOR,);

/**
 Checks whether one version component is an unsigned canonical integer.

 @param component - Version component from package engine floor.

 @returns Whether component has canonical integer spelling.

 @example
 ```ts
 isCanonicalVersionComponent('11');
 ```
 */
function isCanonicalVersionComponent(component: string,): boolean {
  if (component === '')
    return false;
  /**
   Numeric value used to reject unsafe and noncanonical components.
   */
  const numericComponent = Number(component,);
  return Number.isSafeInteger(numericComponent,)
    && (numericComponent >= 0)
    && (String(numericComponent,) === component);
}

/**
 Extracts and validates one exact minimum from a caret runtime range.

 @param runtimeRange - One package engine range.

 @returns Exact minimum runtime version.

 @example
 ```ts
 extractNodeVersion('^24.11.0');
 ```
 */
function extractNodeVersion(runtimeRange: string,): string {
  if (!runtimeRange.startsWith(NODE_ENGINE_RANGE_PREFIX,))
    throw new Error(`cli-git Node engine must contain caret ranges, received ${nodeEngineRange}`,);
  /**
   Exact version text after the caret range prefix.
   */
  const version = runtimeRange.slice(NODE_ENGINE_RANGE_PREFIX.length,);
  /**
   Components used to validate exact version spelling.
   */
  const components = version.split('.',);
  if ((components.length !== SEMANTIC_VERSION_COMPONENT_COUNT)
    || (!components.every(isCanonicalVersionComponent,))) {
    throw new Error(`cli-git Node engine must contain canonical versions, received ${nodeEngineRange}`,);
  }
  return version;
}

/**
 Compares two exact Node runtime versions.

 @param leftVersion - First exact runtime version.

 @param rightVersion - Second exact runtime version.

 @returns Numeric ordering of runtime versions.

 @example
 ```ts
 compareNodeVersions({ leftVersion: '24.11.0', rightVersion: '26.0.0', });
 ```
 */
function compareNodeVersions({
  leftVersion,
  rightVersion,
}: {
  readonly leftVersion: string;
  readonly rightVersion: string;
},): number {
  /**
   Numeric components from first runtime version.
   */
  const [leftMajor = 0, leftMinor = 0, leftPatch = 0,] = leftVersion
    .split('.',)
    .map(Number,);
  /**
   Numeric components from second runtime version.
   */
  const [rightMajor = 0, rightMinor = 0, rightPatch = 0,] = rightVersion
    .split('.',)
    .map(Number,);
  return (leftMajor - rightMajor)
    || (leftMinor - rightMinor)
    || (leftPatch - rightPatch);
}

/**
 Exact runtime versions supported by the package.
 */
const supportedNodeVersions = nodeEngineRanges.map(extractNodeVersion,);
/**
 Exact minimum runtime used as the build transform target.
 */
const minimumNodeVersion = supportedNodeVersions.reduce(
  function selectMinimum(currentMinimum: string, candidate: string,): string {
    return compareNodeVersions({
      leftVersion: candidate,
      rightVersion: currentMinimum,
    }) < 0 ? candidate : currentMinimum;
  },
);

/**
 Shared Node flavor before cli-git's package-specific runtime target.
 */
const baseConfig: NodeFlavorConfig = nodeConfig({
  outputOverrides: {
    minify: false,
    codeSplitting: false,
  },
},);

/**
 Node build configuration for shadow bin and authoring API.

 Transform target comes from same manifest range used by package managers and
 minimum-runtime CI. Unminified single-chunk output keeps trust diagnostics,
 stack traces,
 and dynamic imports in one auditable file.
 */
const config: NodeFlavorConfig = {
  ...baseConfig,
  transform: {
    ...baseConfig.transform,
    target: `node${minimumNodeVersion}`,
  },
};

export default config;
