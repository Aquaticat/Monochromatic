/**
 * Container integration test for {@link ensurePackage}.
 * Runs inside a container via `podman run` -- never on the host.
 *
 * Test matrix (managed by the container runner):
 * - ubuntu:latest (apt) as root and user
 * - fedora:latest (dnf) as root and user
 *
 * Package shapes tested:
 * - String shorthand (`p('tree')`) -- binary = effname = package name
 * - Bin differs from effname (`p({ bin: 'rg', effname: 'ripgrep' })`)
 * - Per-manager overrides via yes tuples (`yes: [['dnf', 'ImageMagick']]`)
 */

import {
  ensurePackage,
  registerPackages,
} from './ensure-package.ts';
import {
  binaryExists,
  detectManager,
  resetManagerCache,
} from './manager.ts';
import { p, } from './p.ts';

//region Test packages

/**
 * Varied package shapes for testing.
 * Each shape exercises a different code path in {@link ensurePackage}.
 */
const TEST_PACKAGES = [
  /** Shape: string shorthand -- binary = effname = package name everywhere */
  p('tree',),
  p('jq',),
  /** Shape: bin differs from effname */
  p({
    bin: 'rg',
    effname: 'ripgrep',
  },),
  /** Shape: per-manager override where name varies (via yes tuples) */
  p({
    bin: 'convert',
    effname: 'imagemagick',
    yes: ['apt', ['dnf', 'ImageMagick',],],
  },),
  /** Shape: effname only (bin defaults to effname) */
  p({ effname: 'strace', },),
] as const;

//endregion Test packages

//region Test runner

/**
 * Attempts to ensure a binary and reports the result.
 * Does not throw -- captures errors for reporting.
 *
 * @param binary - Binary name to ensure
 *
 * @param label - Human-readable label for logging
 *
 * @returns Whether the test passed
 */
async function testEnsure(
  binary: string,
  label: string,
): Promise<boolean> {
  const before = await binaryExists(binary,);
  if (before) {
    console.log(`[container-test] ${label}: SKIP (already installed)`,);
    return true;
  }

  try {
    await ensurePackage(binary,);
  }
  catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error,);
    console.error(`[container-test] ${label}: INSTALL FAILED: ${msg}`,);
    return false;
  }

  const after = await binaryExists(binary,);
  if (!after) {
    console.error(`[container-test] ${label}: FAIL (not on PATH after install)`,);
    return false;
  }

  /** Verify idempotent second call */
  try {
    await ensurePackage(binary,);
  }
  catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error,);
    console.error(`[container-test] ${label}: IDEMPOTENT CALL FAILED: ${msg}`,);
    return false;
  }

  console.log(`[container-test] ${label}: PASSED`,);
  return true;
}

/**
 * Runs the full container test suite: registers test packages,
 * detects the manager, exercises each package shape, and reports results.
 */
async function run(): Promise<void> {
  resetManagerCache();
  registerPackages([...TEST_PACKAGES,],);

  const manager = await detectManager();
  console.log(`[container-test] detected manager: ${manager}`,);
  console.log(`[container-test] uid: ${process.getuid?.() ?? 'unavailable'}`,);

  /** Shape: string shorthand */
  const treeResult = await testEnsure(
    'tree',
    'tree (string shorthand)',
  );
  const jqResult = await testEnsure(
    'jq',
    'jq (string shorthand)',
  );

  /** Shape: bin differs from effname */
  const rgResult = await testEnsure(
    'rg',
    'rg (bin != effname)',
  );

  /** Shape: per-manager override */
  const convertResult = await testEnsure(
    'convert',
    'convert (manager override)',
  );

  /** Shape: effname only */
  const straceResult = await testEnsure(
    'strace',
    'strace (effname only)',
  );

  /** Unknown binary must throw */
  let unknownThrew = false;
  try {
    await ensurePackage('nonexistent-binary-that-should-not-exist-42',);
  }
  catch {
    unknownThrew = true;
  }
  console.log(`[container-test] unknown binary threw: ${unknownThrew}`,);

  /** Summary */
  const results = [
    treeResult,
    jqResult,
    rgResult,
    convertResult,
    straceResult,
    unknownThrew,
  ];
  const passed = results.filter(Boolean,).length;
  const total = results.length;
  console.log(`\n[container-test] ${passed}/${total} passed`,);

  if (passed < total)
    throw new Error(`${total - passed} test(s) failed`,);
  console.log('[container-test] ALL PASSED',);
}

await run();

//endregion Test runner
