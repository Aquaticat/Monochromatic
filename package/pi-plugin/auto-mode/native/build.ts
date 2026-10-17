/**
 Build the maintained native artifact without private integration imports.

 @module
 */
import {
  cp,
  mkdir,
  mkdtemp,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import spawn from 'nano-spawn';
import { buildPiSource, } from './build-source.ts';
import { NativeSourceBuildError, qualifiedRelease, } from './build-contract.ts';
import { activateNativeBuild } from './build-activation.ts';
import { reuseNativeBuildFiles } from './build-reuse.ts';

//region The maintained artifact owns every native module loaded at runtime.

if (process.env
  .PI_AUTO_MODE_NATIVE_BUILD
  === '1')
  throw new NativeSourceBuildError('Recursive native host build is forbidden',);
/**
 User arguments exclude the runtime executable and script location.
 */
const arguments_ = process.argv
  .slice(2);
if ((arguments_.length > 1) || ((arguments_.length === 1) && (arguments_[0] !== '--owned')))
  throw new NativeSourceBuildError('Native build accepts only the optional --owned flag',);

/**
 Maintained package owning the complete native artifact.
 */
const packageRoot = dirname(import.meta.dirname,);
/**
 Stable command location changes only after the new release has loaded successfully.
 */
const active = join(
  packageRoot,
  'dist/native',
);
await mkdir(
  dirname(active),
  { recursive: true, },
);
/** Each release keeps stable module URLs, including while another release is activated. */
const output=await mkdtemp(join(dirname(active),'native-release-'));
if (arguments_[0] !== '--owned') await buildPiSource({packageRoot,output});
else {
  await cp(join(active,'pi'),join(output,'pi'),{recursive:true});
  await cp(join(active,'source-manifest.json'),join(output,'source-manifest.json'));
  await cp(join(active,'PI-LICENSE.txt'),join(output,'PI-LICENSE.txt'));
}
// Bind this release to the same maintained policy build instead of a future mutable output.
await cp(join(packageRoot,'dist/final/node'),join(output,'policy'),{recursive:true});
await cp(
  join(
    import.meta.dirname,
    'contract',
  ),
  join(
    output,
    'contract',
  ),
  { recursive: true, },
);
await cp(
  join(
    import.meta.dirname,
    'loader.mjs',
  ),
  join(
    output,
    'loader.mjs',
  ),
);
await cp(
  join(
    import.meta.dirname,
    'loader.ts'
  ),
  join(
    output,
    'loader.ts'
  ),
);
await cp(
  join(
    import.meta.dirname,
    'cli.mjs',
  ),
  join(
    output,
    'cli.mjs',
  ),
);
/**
 Loader binds original upstream modules to their maintained transformed counterparts.
 */
const loader = join(
  output,
  'loader.mjs',
);
/**
 Build-time generator applies the qualified original-source transformations.
 */
const prepare = join(
  output,
  'contract/integration/native-batch/prepare.ts',
);
await spawn(
  process.execPath,
  [
    '--import',
    loader,
    prepare,
  ],
  {
    cwd: packageRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      PI_AUTO_MODE_NATIVE_BUILD: '1',
    },
  },
);
/** Loading the actual CLI validates the generated module graph before publication. */
const checked=await spawn(process.execPath,[join(output,'cli.mjs'),'--version'],{
  cwd:packageRoot,
  stderr:'inherit',
});
if(checked.stdout.trim()!==qualifiedRelease.version)
  throw new NativeSourceBuildError('Generated native command did not report the qualified version');
/** Identical files share storage only after generation and loading have succeeded. */
const reused = await reuseNativeBuildFiles({ output, active });
await activateNativeBuild({output,active});
console.log(JSON.stringify({
  complete: true,
  output,
  active,
  installedSourcesModified: false,
  reused,
},),);

//endregion
