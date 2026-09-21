#!/usr/bin/env node
/**
 Built cli-git verification at package's supported Node runtime floors.

 @module
 */

import { fileURLToPath, } from 'node:url';

import nanoSpawn, {
  type Result,
  SubprocessError,
} from 'nano-spawn';

import packageMetadata from '../package.json' with { type: 'json', };

//region Runtime contract: Derive supported runtime floors from package metadata.

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
 Consumer runtime contract declared by package manifest.
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
  return String(Number(component,)) === component;
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
 Exact runtime versions supported by the package.
 */
const supportedNodeVersions = nodeEngineRanges.map(extractNodeVersion,);
/**
 Exact minimum runtime in the declared range.
 */
const [minimumNodeVersion,] = supportedNodeVersions;

if (minimumNodeVersion === undefined)
  throw new Error(`cli-git Node engine contains no runtime ranges, received ${nodeEngineRange}`,);

/**
 Node version executing this host-evidence program.
 */
const { node: currentNodeVersion, } = process.versions;

if (!supportedNodeVersions.includes(currentNodeVersion,)) {
  throw new Error(
    `runtime evidence requires Node ${supportedNodeVersions.join(', ')}, received ${currentNodeVersion}`,
  );
}

//endregion Runtime contract

//region Built consumer evidence: Import public API and exercise authored CLI diagnostics.

/**
 Public application artifact consumed by package imports and shadow executable.
 */
const builtArtifactUrl = new URL(
  '../dist/final/node/index.mjs',
  import.meta.url,
);
/**
 Filesystem path passed to child Node invocations.
 */
const builtArtifactPath = fileURLToPath(builtArtifactUrl,);
/**
 Node executable proven to be package's declared floor.
 */
const { execPath: nodeExecutable, } = process;
/**
 Exact success marker proving package import emitted no other output.
 */
const expectedImportOutput = 'cli-git-import-ok';
/**
 Syntax-boundary-safe import probe for public authoring API.
 */
const importProbeSource = `
const packageModule = await import(${JSON.stringify(builtArtifactUrl.href,)})
if (typeof packageModule.definePolicy !== 'function') {
  throw new TypeError('built cli-git package does not export definePolicy')
}
process.stdout.write(${JSON.stringify(expectedImportOutput,)})
`;
/**
 Isolated import result retaining stdout and stderr for side-effect checks.
 */
const {
  stdout: importStdout,
  stderr: importStderr,
} = await nanoSpawn(
  nodeExecutable,
  [
    '--input-type=module',
    '--eval',
    importProbeSource,
  ],
);

if (importStdout !== expectedImportOutput)
  throw new Error(`built import emitted unexpected stdout: ${JSON.stringify(importStdout,)}`,);
if (importStderr !== '')
  throw new Error(`built import emitted unexpected stderr: ${JSON.stringify(importStderr,)}`,);

/**
 Management help result proving representative successful CLI dispatch.
 */
const {
  stdout: helpStdout,
  stderr: helpStderr,
} = await nanoSpawn(
  nodeExecutable,
  [
    builtArtifactPath,
    'cli-git',
    '--help',
  ],
);

if (helpStderr !== '')
  throw new Error(`built help emitted unexpected stderr: ${JSON.stringify(helpStderr,)}`,);
if (!helpStdout.includes('Usage: git cli-git <command> [options]',))
  throw new Error(`built help emitted unexpected stdout: ${JSON.stringify(helpStdout,)}`,);

/**
 Invokes built CLI while retaining expected nonzero result as evidence.
 
 @param args - Exact CLI argument vector after Node executable.
 
 @returns Successful result or structured subprocess failure.
 
 @example
 ```ts
 await invokeAllowingFailure({ args: ['cli.mjs', '--invalid'] });
 ```
 */
async function invokeAllowingFailure({ args, }: {
  readonly args: readonly string[];
},): Promise<Result | SubprocessError> {
  try {
    return await nanoSpawn(
      nodeExecutable,
      [...args,],
    );
  }
  catch (error: unknown) {
    if (error instanceof SubprocessError)
      return error;
    throw error;
  }
}

/**
 Invalid trust result proving authored usage routing and nonzero exit contract.
 */
const invalidUsageResult = await invokeAllowingFailure({
  args: [
    builtArtifactPath,
    'cli-git',
    'trust',
    '--unknown',
  ],
},);
/**
 Captured invalid-usage process fields.
 */
const {
  stdout: invalidUsageStdout,
  stderr: invalidUsageStderr,
} = invalidUsageResult;

if (!(invalidUsageResult instanceof SubprocessError))
  throw new Error('built invalid usage exited successfully',);
if (invalidUsageResult.exitCode !== 2) {
  throw new Error(
    `built invalid usage exited ${String(invalidUsageResult.exitCode,)}`,
  );
}
if (invalidUsageStdout !== '') {
  throw new Error(
    `built invalid usage emitted unexpected stdout: ${JSON.stringify(invalidUsageStdout,)}`,
  );
}
if (!invalidUsageStderr.includes('Usage: git cli-git trust [--yes]',)) {
  throw new Error(
    `built invalid usage emitted unexpected stderr: ${JSON.stringify(invalidUsageStderr,)}`,
  );
}

console.log(
  `cli-git Node ${currentNodeVersion} runtime contract passed (minimum ${minimumNodeVersion})`,
);

//endregion Built consumer evidence
