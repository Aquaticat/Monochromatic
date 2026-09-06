import {
  nodeConfig,
  type NodeFlavorConfig,
} from '@monochromatic-dev/config-rolldown/.node.ts';

import packageMetadata from './package.json' with { type: 'json', };

/**
 Engine range form reserved for one maintained Node LTS line.
 */
const NODE_LTS_RANGE_PREFIX = '^';
/**
 Number of components required by package's exact minimum Node version.
 */
const SEMANTIC_VERSION_COMPONENT_COUNT = 3;
/**
 Canonical package runtime contract.
 */
const { node: nodeEngineRange, } = packageMetadata.engines;

if (!nodeEngineRange.startsWith(NODE_LTS_RANGE_PREFIX,))
  throw new Error(`cli-git Node engine must be one caret range, received ${nodeEngineRange}`,);

/**
 Exact minimum runtime extracted from package's single-line LTS range.
 */
const minimumNodeVersion = nodeEngineRange.slice(NODE_LTS_RANGE_PREFIX.length,);
/**
 Components used to reject unions,
 aliases,
 and noncanonical versions.
 */
const minimumNodeVersionComponents = minimumNodeVersion.split('.',);

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
  return String(Number(component,)) === component;
}

if (minimumNodeVersionComponents.length !== SEMANTIC_VERSION_COMPONENT_COUNT) {
  throw new Error(`cli-git Node engine must contain one canonical version, received ${nodeEngineRange}`,);
}
if (!minimumNodeVersionComponents.every(isCanonicalVersionComponent,)) {
  throw new Error(`cli-git Node engine must contain one canonical version, received ${nodeEngineRange}`,);
}

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
