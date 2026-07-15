/**
 * Packed shadow-bin recursive trust verification. @module
 */
import {
  mkdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';
import { assertAffectedRootSummary, } from './built-jsonl-assertions.ts';

/**
 * Exercises two-stage trust and cross-filesystem descendant enrollment.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyRecursiveConsumer({ env: process.env });
 * ```
 */
export async function verifyRecursiveConsumer({
  env,
}: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Outer recursive repository above mounted child.
   */
  const outer = '/work/recursive';
  /**
   * Child repository on task-provided tmpfs mount.
   */
  const child = join(
    outer,
    'child',
  );
  await mkdir(
    outer,
    { recursive: true, },
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--quiet',
    ],
    cwd: outer,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--quiet',
    ],
    cwd: child,
  },);
  /**
   * Outer recursive declaration.
   */
  const outerConfig = join(
    outer,
    'cli-git.config.mjs',
  );
  await writeFile(
    outerConfig,
    'export default { trust: { children: true } };\n',
  );
  /**
   * Ordinary child config.
   */
  const childConfig = join(
    child,
    'cli-git.config.mjs',
  );
  await writeFile(
    childConfig,
    'export default {};\n',
  );
  /**
   * Distinct mounted filesystem device evidence.
   */
  const [outerMetadata, childMetadata,] = await Promise.all([
    stat(outer,),
    stat(child,),
  ],);
  if (outerMetadata.dev === childMetadata.dev)
    throw new Error('Recursive child fixture did not cross a filesystem boundary.',);
  /**
   * Both explicit noninteractive disclosures.
   */
  const trusted = await execute({
    command: 'git',
    args: [
      'cli-git',
      'trust',
      '--yes',
    ],
    cwd: outer,
    env,
  },);
  assertIncludes({
    text: trusted.stderr,
    expected: 'cli-git recursive trust request',
    context: 'recursive disclosure',
  },);
  assertIncludes({
    text: trusted.stderr,
    expected: outer,
    context: 'recursive root path',
  },);
  assertIncludes({
    text: trusted.stderr,
    expected: 'crosses filesystem',
    context: 'mounted-volume warning',
  },);
  /**
   * First child check auto-enrolls exact snapshot without prompt.
   */
  await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--all',
    ],
    cwd: child,
    env,
  },);
  /**
   * Auto-enrolled child status.
   */
  const status = await execute({
    command: 'git',
    args: [
      'cli-git',
      'status',
    ],
    cwd: child,
    env,
  },);
  assertIncludes({
    text: status.stdout,
    expected: '"reason":"trusted"',
    context: 'auto-enrolled status',
  },);
  /**
   * Replace mounted filesystem while preserving canonical config path and bytes.
   */
  await execute({
    command: '/usr/bin/umount',
    args: [child,],
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--quiet',
    ],
    cwd: child,
  },);
  await writeFile(
    childConfig,
    'export default {};\n',
  );
  /**
   * Trust status immediately after filesystem replacement.
   */
  const swappedStatus = await execute({
    command: 'git',
    args: [
      'cli-git',
      'status',
    ],
    cwd: child,
    env,
  },);
  assertIncludes({
    text: swappedStatus.stdout,
    expected: '"reason":"untrusted"',
    context: 'mount-swap identity',
  },);
  /**
   * Recursive root enrolls replacement only through a new exact snapshot.
   */
  await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--all',
    ],
    cwd: child,
    env,
  },);
  // Missing-config recovery removes old and replacement identity records.
  await rm(childConfig,);
  /**
   * Recovered multi-identity untrust result.
   */
  const recoveredUntrust = await execute({
    command: 'git',
    args: [
      'cli-git',
      'untrust',
    ],
    cwd: child,
    env,
  },);
  assertIncludes({
    text: recoveredUntrust.stdout,
    expected: '"removed":true',
    context: 'mount-swap recovered untrust',
  },);
  /**
   * Outer authority enrolls new exact record after recovered cleanup.
   */
  await writeFile(
    childConfig,
    'export default {};\n',
  );
  await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--all',
    ],
    cwd: child,
    env,
  },);
  await writeFile(
    childConfig,
    'export default { policies: {} };\n',
  );
  /**
   * Changed descendant blocks until re-trust.
   */
  const changed = await execute({
    command: 'git',
    args: [
      'cli-git',
      'check',
      '--all',
    ],
    expectedExit: 2,
    cwd: child,
    env,
  },);
  assertIncludes({
    text: changed.stdout,
    expected: '"code":"config-changed"',
    context: 'changed descendant',
  },);
  /**
   * Restored bytes allow exact outer cascade test.
   */
  await writeFile(
    childConfig,
    'export default {};\n',
  );
  /**
   * Fresh sibling racing enrollment against independent revocation process.
   */
  const sibling = join(
    outer,
    'sibling',
  );
  await mkdir(sibling,);
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--quiet',
    ],
    cwd: sibling,
  },);
  await writeFile(
    join(
      sibling,
      'cli-git.config.mjs',
    ),
    'export default {};\n',
  );
  /**
   * Separate packed-bin processes serialized by registry-wide lock.
   */
  const [siblingRace, untrust,] = await Promise.all([
    execute({
      command: 'git',
      args: [
        'cli-git',
        'check',
        '--all',
      ],
      expectedExit: [
        0,
        2,
      ],
      cwd: sibling,
      env,
    },),
    execute({
      command: 'git',
      args: [
        'cli-git',
        'untrust',
      ],
      cwd: outer,
      env,
    },),
  ],);
  if (siblingRace.stderr
    .includes('EEXIST',)
    || siblingRace.stdout
    .includes('EEXIST',))
    throw new Error('Concurrent enrollment leaked filesystem lock error.',);
  assertAffectedRootSummary({
    text: untrust.stdout,
    root: outer,
    context: 'recursive untrust',
  },);
  assertIncludes({
    text: untrust.stderr,
    expected: `Affected recursive root: ${outer}`,
    context: 'cascade disclosure',
  },);
  /**
   * Sibling cannot retain orphaned authority after either race order.
   */
  const siblingStatus = await execute({
    command: 'git',
    args: [
      'cli-git',
      'status',
    ],
    cwd: sibling,
    env,
  },);
  assertIncludes({
    text: siblingStatus.stdout,
    expected: '"reason":"untrusted"',
    context: 'raced sibling status',
  },);
  /**
   * Child status after inherited authority removal.
   */
  const childStatus = await execute({
    command: 'git',
    args: [
      'cli-git',
      'status',
    ],
    cwd: child,
    env,
  },);
  assertIncludes({
    text: childStatus.stdout,
    expected: '"reason":"untrusted"',
    context: 'revoked child status',
  },);
}
