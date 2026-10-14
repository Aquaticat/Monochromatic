/**
 Emit the qualified upstream graph inside the maintained native artifact.

 @module
 */
import {
  cp,
  rm,
  mkdir,
  realpath,
  symlink,
  writeFile,
} from 'node:fs/promises';
import {
  basename,
  dirname,
  join,
} from 'node:path';
import spawn from 'nano-spawn';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { copyAssets, } from './build-assets.ts';
import {
  NativeSourceBuildError,
  nativeBuildLog,
  qualifiedRelease,
} from './build-contract.ts';
import {
  packageVersion,
} from './build-input.ts';

//region Qualified upstream source is a build input, never an installed source edit.

/**
 Source emission diagnostics retain their module boundary.
 */
const l = tagged({
  tag: 'build-emission',
  l: nativeBuildLog,
},);

/**
 Create a dependency link or verify the existing artifact retains the same target.

 @param target - dependency directory inside the emitted upstream package

 @param source - installed dependency directory selected by the qualified package

 @throws NativeSourceBuildError when an existing dependency link targets another installation
 */
async function linkDependencies({
  target,
  source,
}: {
  readonly target: string;
  readonly source: string
},): Promise<void> {
  /**
   Dependency-link checks remain distinguishable from compiler emission.
   */
  const rl = tagged({
    tag: linkDependencies.name,
    l,
  },);
  rl.debug('linking qualified installed dependencies',);
  try {
    await symlink(
      source,
      target,
      'dir',
    );
  }
  catch (error) {
    if (((typeof error) !== 'object') || (error === null)
      || (!('code' in error))
      || (error.code !== 'EEXIST'))
      throw error;
    rl.debug(caughtValueText(error,),);
    if (await realpath(target,) !== await realpath(source,))
      throw new NativeSourceBuildError(
        `Emitted dependency link targets another installation: ${target}`,
        { cause: error, },
      );
  }
}

/**
 Emit one qualified upstream package with its installed dependency boundary.

 @param packageRoot - working directory used by the installed compiler

 @param output - native artifact directory receiving this package

 @param installedSdk - qualified installed host supplying sibling package locations

 @param sourceRoot - verified immutable upstream checkout

 @param compiler - installed compiler executable

 @param specification - upstream package and folder emitted by this operation

 @throws NativeSourceBuildError when source and installed package versions differ

 @example
 ```ts
 await emitPackage({ packageRoot, output, installedSdk, sourceRoot, compiler,
   specification: { folder: 'agent', name: '@earendil-works/pi-agent-core' } });
 ```
 */
export async function emitPackage({
  packageRoot,
  output,
  installedSdk,
  sourceRoot,
  compiler,
  specification
}: {
  readonly packageRoot: string;
  readonly output: string;
  readonly installedSdk: string;
  readonly sourceRoot: string;
  readonly compiler: string;
  readonly specification: {
    readonly folder: string;
    readonly name: string
  };
}): Promise<void> {
  /**
   Each package emission retains its operation boundary in diagnostics.
   */
  const rl = tagged({
    tag: emitPackage.name,
    l
  });
  rl.debug(`emitting upstream package: ${specification.name}`);
    /**
     Match each source package to its installed dependency tree.
     */
    const installed = await realpath(join(
      dirname(installedSdk,),
      basename(specification.name,),
    ),);
    /**
     Original package source inside the verified checkout.
     */
    const upstream = join(
      sourceRoot,
      'packages',
      specification.folder,
    );
    if (await packageVersion(upstream,) !== await packageVersion(installed,))
      throw new NativeSourceBuildError(`Source and installed package versions differ: ${specification.name}`,);
    /**
     Emit each upstream package with its own module and dependency boundary.
     */
    const target = join(
      output,
      'pi',
      specification.folder,
    );
    // Source emission owns this generated package tree, including its dependency link.
    await rm(
      target,
      {
        recursive: true,
        force: true
      }
    );
    await mkdir(
      target,
      { recursive: true, },
    );
    await cp(
      join(
        upstream,
        'src',
      ),
      join(
        target,
        'src',
      ),
      { recursive: true, },
    );
    await cp(
      join(
        upstream,
        'package.json',
      ),
      join(
        target,
        'package.json',
      ),
    );
    await linkDependencies({
      target: join(
        target,
        'node_modules',
      ),
      source: dirname(dirname(installed,),),
    },);
    /**
     Emission preserves native module syntax without rechecking upstream source.
     */
    const configuration = join(
      target,
      'tsconfig.stage.json',
    );
    await writeFile(
      configuration,
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2024',
            module: 'NodeNext',
            moduleResolution: 'NodeNext',
            rootDir: 'src',
            outDir: 'dist',
            noCheck: true,
            noResolve: true,
            declaration: false,
            sourceMap: false,
            verbatimModuleSyntax: true,
            rewriteRelativeImportExtensions: true,
            resolveJsonModule: true,
            skipLibCheck: true,
            types: [],
          },
          include: ['src/**/*.ts',],
          exclude: ['src/experimental',],
        },
        null,
        2,
      ),
    );
    await spawn(
      process.execPath,
      [
        compiler,
        '--project',
        configuration,
      ],
      {
        cwd: packageRoot,
        stdio: 'inherit',
      },
    );
    await copyAssets({
      source: join(
        target,
        'src',
      ),
      target: join(
        target,
        'dist',
      ),
    },);
    if (specification.folder === 'ai')
      await cp(
        join(
          installed,
          'dist/providers/data',
        ),
        join(
          target,
          'dist/providers/data',
        ),
        { recursive: true, },
      );
    console.log(JSON.stringify({
      emitted: specification.name,
      version: qualifiedRelease.version,
    },),);
  rl.debug('upstream package emission completed');
}

//endregion Qualified upstream source is a build input, never an installed source edit.
