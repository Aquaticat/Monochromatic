/**
 Qualified upstream source selection for the maintained native build.

 @module
 */
import { chmod, mkdir, readFile, realpath, } from 'node:fs/promises';
import { homedir, } from 'node:os';
import { join, } from 'node:path';
import spawn from 'nano-spawn';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { NativeSourceBuildError, nativeBuildLog, qualifiedRelease, } from './build-contract.ts';

//region Resolve and verify source before emitting native modules

/**
 Source-input diagnostics retain their module boundary.
 */
const l = tagged({ tag: 'build-input', l: nativeBuildLog, },);

/**
 Read package metadata without assuming the parsed JSON shape.

 @param directory - package whose declared version gates source admission

 @returns declared package version

 @throws NativeSourceBuildError when the package has no string version
 */
export async function packageVersion(directory: string,): Promise<string> {
  /**
   Version reads remain distinguishable from checkout retrieval.
   */
  const rl = tagged({ tag: packageVersion.name, l, },);
  rl.debug('reading package version for native build qualification',);
  /**
   Untrusted package metadata is narrowed before selecting its version.
   */
  const metadata: unknown = JSON.parse(await readFile(join(directory, 'package.json',), 'utf8',),);
  if ((typeof metadata !== 'object') || (metadata === null) || !('version' in metadata)
    || (typeof metadata.version !== 'string'))
    throw new NativeSourceBuildError(`Package version is unavailable: ${directory}`,);
  return metadata.version;
}

/**
 Reuse an existing checkout or fetch the qualified release before validating its commit.

 @param packageRoot - working directory for the source retrieval command

 @returns original checkout containing the qualified immutable source revision

 @throws NativeSourceBuildError when the source revision differs from the qualified release
 */
export async function sourceCheckout(packageRoot: string,): Promise<string> {
  /**
   Keep source retrieval and revision checks in the same diagnostic boundary.
   */
  const rl = tagged({ tag: sourceCheckout.name, l, },);
  /**
   Persistent private scratch root keeps source checkouts across host reboots.
   */
  const scratch = join(homedir(), 'temp/agent',);
  await mkdir(scratch, { recursive: true, mode: 0o700, },);
  await chmod(scratch, 0o700,);
  /**
   Explicit source overrides affect the build input only, never runtime resolution.
   */
  const sourceRoot = process.env.PI_AUTO_MODE_SOURCE ?? join(scratch, `auto-mode-pi-source-${qualifiedRelease.version}`,);
  try {
    await realpath(sourceRoot,);
  }
  catch (error) {
    if ((typeof error !== 'object') || (error === null) || !('code' in error) || (error.code !== 'ENOENT'))
      throw error;
    rl.debug(caughtValueText(error,),);
    rl.debug('source checkout is absent; retrieving the qualified release',);
    await spawn('gh', ['repo', 'clone', 'earendil-works/pi', sourceRoot, '--', '--depth', '1',
      '--branch', `v${qualifiedRelease.version}`,], { cwd: packageRoot, stdio: 'inherit', },);
  }
  /**
   Git reports the actual selected revision independently of the directory or tag name.
   */
  const revision = await spawn('git', ['rev-parse', 'HEAD',], { cwd: sourceRoot, },);
  /**
   Ignore only terminal whitespace in the revision command's machine-readable output.
   */
  const commit = revision.stdout.trim();
  if (commit !== qualifiedRelease.commit)
    throw new NativeSourceBuildError(`Pi source revision differs from the qualified release: ${commit}`,);
  rl.debug('qualified source revision verified',);
  return sourceRoot;
}

//endregion Resolve and verify source before emitting native modules
