/**
 Emit the qualified upstream graph inside the maintained native artifact.

 @module
 */
import { cp, mkdir, realpath, symlink, writeFile, } from 'node:fs/promises';
import { createRequire, } from 'node:module';
import { basename, dirname, join, } from 'node:path';
import spawn from 'nano-spawn';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { copyAssets, } from './build-assets.ts';
import { NativeSourceBuildError, nativeBuildLog, qualifiedRelease, } from './build-contract.ts';
import { packageVersion, sourceCheckout, } from './build-input.ts';

//region Qualified upstream source is a build input, never an installed source edit.

/**
 Create a dependency link or verify the existing artifact retains the same target.

 @param target - dependency directory inside the emitted upstream package

 @param source - installed dependency directory selected by the qualified package

 @throws NativeSourceBuildError when an existing dependency link targets another installation
 */
async function linkDependencies({ target, source, }: { readonly target: string; readonly source: string; },): Promise<void> {
  try {
    await symlink(source, target, 'dir',);
  }
  catch (error) {
    if ((typeof error !== 'object') || (error === null) || !('code' in error) || (error.code !== 'EEXIST'))
      throw error;
    if (await realpath(target,) !== await realpath(source,))
      throw new NativeSourceBuildError(`Emitted dependency link targets another installation: ${target}`, { cause: error, },);
  }
}

/**
 Build upstream modules and metadata without editing an installed Pi package.

 @param packageRoot - maintained package owning output and installed dependencies

 @param output - native artifact directory receiving the upstream graph

 @throws NativeSourceBuildError when source or installed dependencies leave the qualified release
 */
export async function buildPiSource({ packageRoot, output, }: { readonly packageRoot: string; readonly output: string; },): Promise<void> {
  /**
   Track source emission separately from owned transformations.
   */
  const rl = tagged({ tag: buildPiSource.name, l: nativeBuildLog, },);
  /**
   Resolve the actual installed package independently of symlink spelling.
   */
  const installedSdk = await realpath(join(packageRoot, 'node_modules/@earendil-works/pi-coding-agent',),);
  if (await packageVersion(installedSdk,) !== qualifiedRelease.version)
    throw new NativeSourceBuildError('Installed Pi differs from the qualified native source release',);
  /**
   Verified checkout supplies build input only.
   */
  const sourceRoot = await sourceCheckout(packageRoot,);
  /**
   Resolve the compiler relative to the maintained package's dependency boundary.
   */
  const require = createRequire(join(packageRoot, 'package.json',),);
  /**
   Compiler metadata supplies the artifact's recorded compiler version.
   */
  const compilerMetadata = require.resolve('typescript/package.json',);
  /**
   Invoke the selected compiler's executable through the current Node runtime.
   */
  const compiler = join(dirname(compilerMetadata,), 'bin/tsc',);
  /**
   Host, Agent, and AI source share the qualified upstream revision.
   */
  const specifications = [
    { folder: 'agent', name: '@earendil-works/pi-agent-core', },
    { folder: 'ai', name: '@earendil-works/pi-ai', },
    { folder: 'coding-agent', name: '@earendil-works/pi-coding-agent', },
  ] as const;
  rl.debug('emitting the qualified native source graph',);
  for (const specification of specifications) {
    /**
     Match each source package to its installed dependency tree.
     */
    const installed = await realpath(join(dirname(installedSdk,), basename(specification.name,),),);
    /**
     Original package source inside the verified checkout.
     */
    const upstream = join(sourceRoot, 'packages', specification.folder,);
    if (await packageVersion(upstream,) !== await packageVersion(installed,))
      throw new NativeSourceBuildError(`Source and installed package versions differ: ${specification.name}`,);
    /**
     Emit each upstream package with its own module and dependency boundary.
     */
    const target = join(output, 'pi', specification.folder,);
    await mkdir(target, { recursive: true, },);
    await cp(join(upstream, 'src',), join(target, 'src',), { recursive: true, },);
    await cp(join(upstream, 'package.json',), join(target, 'package.json',),);
    await linkDependencies({ target: join(target, 'node_modules',), source: dirname(dirname(installed,),), },);
    /**
     Emission preserves native module syntax without rechecking upstream source.
     */
    const configuration = join(target, 'tsconfig.stage.json',);
    await writeFile(configuration, JSON.stringify({
      compilerOptions: {
        target: 'ES2024', module: 'NodeNext', moduleResolution: 'NodeNext', rootDir: 'src', outDir: 'dist',
        noCheck: true, noResolve: true, declaration: false, sourceMap: false, verbatimModuleSyntax: true,
        rewriteRelativeImportExtensions: true, resolveJsonModule: true, skipLibCheck: true, types: [],
      },
      include: ['src/**/*.ts',], exclude: ['src/experimental',],
    }, null, 2,),);
    await spawn(process.execPath, [compiler, '--project', configuration,], { cwd: packageRoot, stdio: 'inherit', },);
    await copyAssets({ source: join(target, 'src',), target: join(target, 'dist',), },);
    if (specification.folder === 'ai')
      await cp(join(installed, 'dist/providers/data',), join(target, 'dist/providers/data',), { recursive: true, },);
    console.log(JSON.stringify({ emitted: specification.name, version: qualifiedRelease.version, },),);
  }
  await cp(join(sourceRoot, 'LICENSE',), join(output, 'PI-LICENSE.txt',),);
  await writeFile(join(output, 'source-manifest.json',), JSON.stringify({
    ...qualifiedRelease, compilerVersion: await packageVersion(dirname(compilerMetadata,),),
  }, null, 2,),);
  rl.debug('qualified native source emission completed',);
}

//endregion
