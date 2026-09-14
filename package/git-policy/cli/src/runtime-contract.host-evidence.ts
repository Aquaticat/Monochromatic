#!/usr/bin/env node
/**
 Built cli-git verification at package's exact minimum Node runtime.
 
 @module
 */

import { fileURLToPath, } from 'node:url';

import nanoSpawn, {
  type Result,
  SubprocessError,
} from 'nano-spawn';

import packageMetadata from '../package.json' with { type: 'json', };

//region Runtime contract: Derive one maintained LTS floor from package metadata.

/**
 Engine range form reserved for one maintained Node LTS line.
 */
const NODE_LTS_RANGE_PREFIX = '^';
/**
 Number of components required by package's exact minimum Node version.
 */
const SEMANTIC_VERSION_COMPONENT_COUNT = 3;
/**
 Consumer runtime contract declared by package manifest.
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
 Node version executing this host-evidence program.
 */
const { node: currentNodeVersion, } = process.versions;

if (currentNodeVersion !== minimumNodeVersion) {
  throw new Error(
    `minimum-runtime evidence requires Node ${minimumNodeVersion}, received ${currentNodeVersion}`,
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

console.log(`cli-git minimum Node ${minimumNodeVersion} runtime contract passed`,);

//endregion Built consumer evidence
