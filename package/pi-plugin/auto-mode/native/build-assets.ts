/**
 Copy source assets alongside the separately emitted JavaScript modules.

 @module
 */
import {
  cp,
  lstat
} from 'node:fs/promises';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nativeBuildLog } from './build-contract.ts';

//region Native directory copying retains assets and excludes source files

/**
 Asset-copy diagnostics retain their module boundary.
 */
const l = tagged({
  tag: 'build-assets',
  l: nativeBuildLog
});

/**
 Preserve source assets while leaving the compiler's JavaScript output intact.

 @param source - original source directory containing adjacent assets

 @param target - emitted module directory receiving adjacent assets

 @example
 ```ts
 await copyAssets({ source: sourceDirectory, target: emittedDirectory });
 ```
 */
export async function copyAssets({
  source,
  target
}: {
  readonly source: string;
  readonly target: string;
}): Promise<void> {
  /**
   Name asset-copy activity independently of upstream compilation.
   */
  const rl = tagged({
    tag: copyAssets.name,
    l
  });
  rl.debug('copying upstream non-TypeScript assets');
  await cp(
    source,
    target,
    {
    recursive: true,
    async filter(path) {
      if (!path.endsWith('.ts')) return true;
      /**
       A directory suffix never suppresses its non-TypeScript descendants.
       */
      const metadata = await lstat(path);
      return metadata.isDirectory();
    },
  }
  );
  rl.debug('upstream asset copy completed');
}

//endregion Native directory copying retains assets and excludes source files
