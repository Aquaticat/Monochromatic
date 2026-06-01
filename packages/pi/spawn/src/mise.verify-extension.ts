/**
 * Verifies built spawn-pi extension and CLI artifacts.
 *
 * @module
 */

import { spawnSync, } from 'node:child_process';
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import { join, } from 'node:path';
import { fileURLToPath, } from 'node:url';

import type { ExtensionFactory, } from '@earendil-works/pi-coding-agent';

import {
  createExtensionContext,
  createSessionShutdownEvent,
  createSessionStartEvent,
  fakePiApi,
  onlyHandler,
} from './pi-test-harness.ts';
import {
  envVar,
  tempDir,
} from './test-support.ts';

//region Constants

/**
 * Built extension path consumed by Pi.
 */
const BUILT_EXTENSION_PATH = '../dist/final/node/index.mjs';

/**
 * Built CLI path exposed by package bin.
 */
const BUILT_CLI_PATH = '../dist/final/node/cli.mjs';

/**
 * Expected Node shebang for built CLI artifact.
 */
const EXPECTED_NODE_SHEBANG = '#!/usr/bin/env node';

/**
 * Expected extension registrations from built spawn-pi entry point.
 */
const EXPECTED_REGISTRATIONS = [
  'event:session_start',
  'event:session_shutdown',
  'event:agent_end',
] as const;

//endregion Constants

//region Types

/**
 * Built spawn-pi extension module shape.
 */
type SpawnPiExtensionModule = {
  /**
   * Pi extension factory.
   */
  readonly default: ExtensionFactory;
};

//endregion Types

//region Verification

/**
 * Verifies built extension and CLI shape.
 *
 * @returns verification result text.
 *
 * @throws when any built artifact check fails.
 *
 * @example
 * ```typescript
 * console.log(await verifyBuiltSpawnPi());
 * ```
 */
async function verifyBuiltSpawnPi(): Promise<string> {
  await verifyBuiltExtension();
  verifyBuiltCli();

  return 'spawn-pi verified: extension registrations, Node CLI artifact, and inert CLI help';
}

/**
 * Verifies built extension registers expected events and starts cleanly.
 *
 * @throws when extension module shape or event registration is wrong.
 *
 * @example
 * ```typescript
 * await verifyBuiltExtension();
 * ```
 */
async function verifyBuiltExtension(): Promise<void> {
  /**
   * Built extension module namespace.
   */
  const mod: unknown = await import(BUILT_EXTENSION_PATH);
  if (!isSpawnPiExtensionModule(mod,))
    throw new Error('built spawn-pi extension does not export a default extension factory',);

  /**
   * Fake Pi API harness capturing built extension registrations.
   */
  const harness = fakePiApi();
  await mod.default(harness.api,);

  for (const registration of EXPECTED_REGISTRATIONS) {
    /**
     * Whether built extension registered expected lifecycle event.
     */
    const hasRegistration = harness
      .registrations
      .includes(registration,);

    if (!hasRegistration)
      throw new Error(`missing spawn-pi registration: ${registration}`,);
  }

  /**
   * Temporary Pi agent directory for inert extension startup.
   */
  using dir = tempDir({ prefix: 'spawn-pi-verify-', },);
  /**
   * Environment override routing extension state into temp directory.
   */
  using _agentDir = envVar({
    name: 'PI_CODING_AGENT_DIR',
    value: dir.path,
  },);

  /**
   * Built extension event handlers captured by fake API.
   */
  const { handlers, } = harness;
  /**
   * Built extension session-start handler.
   */
  const sessionStartHandler = onlyHandler(handlers.sessionStart,);
  /**
   * Built extension session-shutdown handler.
   */
  const sessionShutdownHandler = onlyHandler(handlers.sessionShutdown,);

  await sessionStartHandler(
    createSessionStartEvent(),
    createExtensionContext({
      sessionId: 'verify-session',
      sessionFile: join(
        dir.path,
        'verify.jsonl',
      ),
      cwd: dir.path,
    },),
  );
  await sessionShutdownHandler(
    createSessionShutdownEvent(),
    createExtensionContext({ sessionId: 'verify-session', },),
  );
}

/**
 * Verifies built CLI exists, carries Node shebang, and prints help without spawning a terminal.
 *
 * @throws when CLI artifact shape or help invocation is wrong.
 *
 * @example
 * ```typescript
 * verifyBuiltCli();
 * ```
 */
function verifyBuiltCli(): void {
  /**
   * Absolute built CLI path.
   */
  const builtCliPath = fileURLToPath(new URL(
    BUILT_CLI_PATH,
    import.meta.url,
  ),);

  if (!existsSync(builtCliPath,))
    throw new Error(`missing built spawn-pi CLI: ${builtCliPath}`,);

  /**
   * Built CLI source text for shebang verification.
   */
  const builtCliText = readFileSync(
    builtCliPath,
    'utf8',
  );
  if (!builtCliText.startsWith(EXPECTED_NODE_SHEBANG,))
    throw new Error('built spawn-pi CLI does not use Node shebang',);

  /**
   * Inert CLI help invocation result.
   */
  const helpResult = spawnSync(
    process.execPath,
    [
      builtCliPath,
      '--help',
    ],
    {
      encoding: 'utf8',
    },
  );

  if (helpResult.status !== 0) {
    throw new Error([
      'spawn-pi --help failed',
      `status: ${String(helpResult.status,)}`,
      `stdout: ${helpResult.stdout}`,
      `stderr: ${helpResult.stderr}`,
    ].join('\n',),);
  }
}

/**
 * Detects built spawn-pi extension module shape.
 *
 * @param value - imported module namespace.
 *
 * @returns whether module exports extension factory.
 *
 * @example
 * ```typescript
 * isSpawnPiExtensionModule(await import('../dist/final/node/index.mjs'));
 * ```
 */
function isSpawnPiExtensionModule(value: unknown,): value is SpawnPiExtensionModule {
  if ((value === null) || ((typeof value) !== 'object'))
    return false;
  return ('default' in value) && ((typeof value.default) === 'function');
}

//endregion Verification

console.log(await verifyBuiltSpawnPi(),);
