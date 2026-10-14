/**
 Build the maintained native artifact without private integration imports.

 @module
 */
import { cp, mkdir, } from 'node:fs/promises';
import { dirname, join, } from 'node:path';
import spawn from 'nano-spawn';
import { buildPiSource, } from './build-source.ts';
import { NativeSourceBuildError, } from './build-contract.ts';

//region The maintained artifact owns every native module loaded at runtime.

if (process.env.PI_AUTO_MODE_NATIVE_BUILD === '1')
  throw new NativeSourceBuildError('Recursive native host build is forbidden',);
if (process.argv.length > 3 || (process.argv.length === 3 && process.argv[2] !== '--owned'))
  throw new NativeSourceBuildError('Native build accepts only the optional --owned flag',);

/**
 Maintained package owning the complete native artifact.
 */
const packageRoot = dirname(import.meta.dirname,);
/**
 Ignored build destination contains upstream emission and owned transformations.
 */
const output = join(packageRoot, 'dist/native',);
await mkdir(output, { recursive: true, },);
if (process.argv[2] !== '--owned') await buildPiSource({ packageRoot, output, },);
await cp(join(import.meta.dirname, 'contract',), join(output, 'contract',), { recursive: true, },);
await cp(join(import.meta.dirname, 'loader.mjs',), join(output, 'loader.mjs',),);
await cp(join(import.meta.dirname, 'cli.mjs',), join(output, 'cli.mjs',),);
/**
 Loader binds original upstream modules to their maintained transformed counterparts.
 */
const loader = join(output, 'loader.mjs',);
/**
 Build-time generator applies the qualified original-source transformations.
 */
const prepare = join(output, 'contract/integration/native-batch/prepare.mjs',);
await spawn(process.execPath, ['--import', loader, prepare,], {
  cwd: packageRoot, stdio: 'inherit', env: { ...process.env, PI_AUTO_MODE_NATIVE_BUILD: '1', },
},);
console.log(JSON.stringify({ complete: true, output, installedSourcesModified: false, },),);

//endregion
