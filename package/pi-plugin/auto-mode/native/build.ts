import { execFileSync, } from 'node:child_process';
import { cpSync, mkdirSync, } from 'node:fs';
import { dirname, join, } from 'node:path';
import { buildPiSource, NativeSourceBuildError, } from './build-source.ts';

//region The maintained artifact owns every native module loaded at runtime.

if (process.env.PI_AUTO_MODE_NATIVE_BUILD === '1')
  throw new NativeSourceBuildError('Recursive native host build is forbidden',);
if (process.argv.length > 3 || (process.argv.length === 3 && process.argv[2] !== '--owned'))
  throw new NativeSourceBuildError('Native build accepts only the optional --owned flag',);

const packageRoot = dirname(import.meta.dirname,);
const output = join(packageRoot, 'dist/native',);
mkdirSync(output, { recursive: true, },);
if (process.argv[2] !== '--owned') buildPiSource({ packageRoot, output, },);
cpSync(join(import.meta.dirname, 'contract',), join(output, 'contract',), { recursive: true, },);
cpSync(join(import.meta.dirname, 'loader.mjs',), join(output, 'loader.mjs',),);
const loader = join(output, 'loader.mjs',);
const prepare = join(output, 'contract/integration/native-batch/prepare.mjs',);
execFileSync(process.execPath, ['--import', loader, prepare,], {
  cwd: packageRoot, stdio: 'inherit', env: { ...process.env, PI_AUTO_MODE_NATIVE_BUILD: '1', },
},);
console.log(JSON.stringify({ complete: true, output, installedSourcesModified: false, },),);

//endregion
