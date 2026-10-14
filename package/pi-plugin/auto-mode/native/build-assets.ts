/**
 Copy source assets alongside the separately emitted JavaScript modules.

 @module
 */
import { cp, mkdir, readdir, } from 'node:fs/promises';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { NativeSourceBuildError, nativeBuildLog, } from './build-contract.ts';

//region An explicit work stack traverses directories without recursion

/**
 Asset traversal diagnostics retain their module boundary.
 */
const l = tagged({ tag: 'build-assets', l: nativeBuildLog, },);

/**
 Source and destination directory pair retained during traversal.
 */
type AssetDirectory = {
  /**
   Original upstream directory containing assets and source files.
   */
  readonly source: string;
  /**
   Emitted directory receiving only the non-TypeScript assets.
   */
  readonly target: string;
};

/**
 Preserve source assets while leaving the compiler's JavaScript output intact.

 @param source - original source directory to traverse

 @param target - emitted module directory receiving adjacent assets

 @throws NativeSourceBuildError when traversal loses its pending directory
 */
export async function copyAssets({ source, target, }: AssetDirectory,): Promise<void> {
  /**
   Name asset-copy activity independently of upstream compilation.
   */
  const rl = tagged({ tag: copyAssets.name, l, },);
  /**
   Pending directory work is bounded by the observed source tree.
   */
  const pending = [{ source, target, },];
  rl.debug('copying upstream non-TypeScript assets',);
  while (pending.length > 0) {
    /**
     Remove one directory so every observed subtree is traversed once.
     */
    const current = pending.pop();
    if (current === undefined)
      throw new NativeSourceBuildError('Asset traversal lost its pending directory',);
    await mkdir(current.target, { recursive: true, },);
    for (const item of await readdir(current.source, { withFileTypes: true, },)) {
      /**
       Original path retains upstream asset naming and content.
       */
      const sourcePath = join(current.source, item.name,);
      /**
       Corresponding emitted path remains inside the package artifact.
       */
      const targetPath = join(current.target, item.name,);
      if (item.isDirectory()) pending.push({ source: sourcePath, target: targetPath, },);
      else if (!item.name.endsWith('.ts',)) await cp(sourcePath, targetPath,);
    }
  }
  rl.debug('upstream asset copy completed',);
}

//endregion An explicit work stack traverses directories without recursion
