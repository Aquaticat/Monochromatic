#!/usr/bin/env node
/**
 * Built cli-git verification at package's exact minimum Node runtime.
 *
 * @module
 */

import { spawnSync, } from 'node:child_process';
import { fileURLToPath, } from 'node:url';

import packageMetadata from '../package.json' with { type: 'json', };

//region Runtime contract -- Derive one maintained LTS floor from package metadata.

/**
 * Engine range form reserved for one maintained Node LTS line.
 */
const NODE_LTS_RANGE_PREFIX = '^';
/**
 * Number of components required by package's exact minimum Node version.
 */
const SEMANTIC_VERSION_COMPONENT_COUNT = 3;
/**
 * Consumer runtime contract declared by package manifest.
 */
const nodeEngineRange = packageMetadata.engines.node;

if (!nodeEngineRange.startsWith(NODE_LTS_RANGE_PREFIX,))
  throw new Error(`cli-git Node engine must be one caret range, received ${nodeEngineRange}`,);

/**
 * Exact minimum runtime extracted from package's single-line LTS range.
 */
const minimumNodeVersion = nodeEngineRange.slice(NODE_LTS_RANGE_PREFIX.length,);
/**
 * Components used to reject unions, aliases, and noncanonical versions.
 */
const minimumNodeVersionComponents = minimumNodeVersion.split('.',);
/**
 * Whether every version component is an unsigned canonical integer.
 */
const hasCanonicalMinimumNodeVersion = minimumNodeVersionComponents.length === SEMANTIC_VERSION_COMPONENT_COUNT
  && minimumNodeVersionComponents.every(function isCanonicalVersionComponent(component: string,): boolean {
    return component !== '' && String(Number(component,)) === component;
  },);

if (!hasCanonicalMinimumNodeVersion)
  throw new Error(`cli-git Node engine must contain one canonical version, received ${nodeEngineRange}`,);
if (process.versions.node !== minimumNodeVersion) {
  throw new Error(
    `minimum-runtime evidence requires Node ${minimumNodeVersion}, received ${process.versions.node}`,
  );
}

//endregion Runtime contract

//region Built consumer evidence -- Import public API and exercise authored CLI diagnostics.

/**
 * Public application artifact consumed by package imports and shadow executable.
 */
const builtArtifactUrl = new URL('../dist/final/node/index.mjs', import.meta.url,);
/**
 * Filesystem path passed to child Node invocations.
 */
const builtArtifactPath = fileURLToPath(builtArtifactUrl,);
/**
 * Exact success marker proving package import emitted no other output.
 */
const expectedImportOutput = 'cli-git-import-ok\n';
/**
 * Syntax-boundary-safe import probe for public authoring API.
 */
const importProbeSource = `
const packageModule = await import(${JSON.stringify(builtArtifactUrl.href,)})
if (typeof packageModule.definePolicy !== 'function') {
  throw new TypeError('built cli-git package does not export definePolicy')
}
process.stdout.write(${JSON.stringify(expectedImportOutput,)})
`;
/**
 * Isolated import result retaining stdout and stderr for side-effect checks.
 */
const importResult = spawnSync(
  process.execPath,
  [
    '--input-type=module',
    '--eval',
    importProbeSource,
  ],
  { encoding: 'utf8', },
);

if (importResult.error !== undefined)
  throw importResult.error;
if (importResult.status !== 0 || importResult.stdout !== expectedImportOutput || importResult.stderr !== '') {
  throw new Error(
    `built import failed: status=${String(importResult.status,)} stdout=${JSON.stringify(importResult.stdout,)} stderr=${JSON.stringify(importResult.stderr,)}`,
  );
}

/**
 * Management help result proving representative successful CLI dispatch.
 */
const helpResult = spawnSync(
  process.execPath,
  [
    builtArtifactPath,
    'cli-git',
    '--help',
  ],
  { encoding: 'utf8', },
);

if (helpResult.error !== undefined)
  throw helpResult.error;
if (
  helpResult.status !== 0
  || helpResult.stderr !== ''
  || !helpResult.stdout.includes('Usage: git cli-git <command> [options]',)
) {
  throw new Error(
    `built help failed: status=${String(helpResult.status,)} stdout=${JSON.stringify(helpResult.stdout,)} stderr=${JSON.stringify(helpResult.stderr,)}`,
  );
}

/**
 * Invalid trust result proving authored usage routing and nonzero exit contract.
 */
const invalidUsageResult = spawnSync(
  process.execPath,
  [
    builtArtifactPath,
    'cli-git',
    'trust',
    '--unknown',
  ],
  { encoding: 'utf8', },
);

if (invalidUsageResult.error !== undefined)
  throw invalidUsageResult.error;
if (
  invalidUsageResult.status !== 2
  || invalidUsageResult.stdout !== ''
  || !invalidUsageResult.stderr.includes('Usage: git cli-git trust [--yes]',)
) {
  throw new Error(
    `built invalid-usage check failed: status=${String(invalidUsageResult.status,)} stdout=${JSON.stringify(invalidUsageResult.stdout,)} stderr=${JSON.stringify(invalidUsageResult.stderr,)}`,
  );
}

console.log(`cli-git minimum Node ${minimumNodeVersion} runtime contract passed`,);

//endregion Built consumer evidence
