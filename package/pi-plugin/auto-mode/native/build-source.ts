/**
 Emit the qualified upstream graph inside the maintained native artifact.

 @module
 */
import {
  cp,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { createRequire, } from 'node:module';
import {
  dirname,
  join,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { emitPackage } from './build-emission.ts';
import {
  NativeSourceBuildError,
  nativeBuildLog,
  qualifiedRelease,
} from './build-contract.ts';
import {
  packageVersion,
  sourceCheckout,
} from './build-input.ts';

//region Qualified upstream source is a build input, never an installed source edit.

/**
 Source emission diagnostics retain their module boundary.
 */
const l = tagged({
  tag: 'build-source',
  l: nativeBuildLog,
},);

/**
 Build upstream modules and metadata without editing an installed Pi package.

 @param packageRoot - maintained package owning output and installed dependencies

 @param output - native artifact directory receiving the upstream graph

 @throws NativeSourceBuildError when source or installed dependencies leave the qualified release

 @example
 ```ts
 await buildPiSource({ packageRoot, output });
 ```
 */
export async function buildPiSource({
  packageRoot,
  output,
}: {
  readonly packageRoot: string;
  readonly output: string
},): Promise<void> {
  /**
   Track source emission separately from owned transformations.
   */
  const rl = tagged({
    tag: buildPiSource.name,
    l,
  },);
  /**
   Resolve the actual installed package independently of symlink spelling.
   */
  const installedSdk = await realpath(join(
    packageRoot,
    'node_modules/@earendil-works/pi-coding-agent',
  ),);
  if (await packageVersion(installedSdk,) !== qualifiedRelease.version)
    throw new NativeSourceBuildError('Installed Pi differs from the qualified native source release',);
  /**
   Verified checkout supplies build input only.
   */
  const sourceRoot = await sourceCheckout(packageRoot,);
  /**
   Resolve the compiler relative to the maintained package's dependency boundary.
   */
  const require = createRequire(join(
    packageRoot,
    'package.json',
  ),);
  /**
   Compiler metadata supplies the artifact's recorded compiler version.
   */
  const compilerMetadata = require.resolve('typescript/package.json',);
  /**
   Invoke the selected compiler's executable through the current Node runtime.
   */
  const compiler = join(
    dirname(compilerMetadata,),
    'bin/tsc',
  );
  /**
   Compiler processes run sequentially within the aggregate worker memory limit.
   */
  const inputs = { packageRoot, output, installedSdk, sourceRoot, compiler };
  rl.debug('emitting the qualified native source graph');
  await emitPackage({ ...inputs, specification: { folder: 'agent', name: '@earendil-works/pi-agent-core' } });
  await emitPackage({ ...inputs, specification: { folder: 'ai', name: '@earendil-works/pi-ai' } });
  await emitPackage({ ...inputs, specification: { folder: 'coding-agent', name: '@earendil-works/pi-coding-agent' } });
  await cp(
    join(
      sourceRoot,
      'LICENSE',
    ),
    join(
      output,
      'PI-LICENSE.txt',
    ),
  );
  await writeFile(
    join(
      output,
      'source-manifest.json',
    ),
    JSON.stringify(
      {
        ...qualifiedRelease,
        compilerVersion: await packageVersion(dirname(compilerMetadata,),),
      },
      null,
      2,
    ),
  );
  rl.debug('qualified native source emission completed',);
}

//endregion
