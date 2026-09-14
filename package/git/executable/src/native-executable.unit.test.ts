import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { resolveRealGit, } from '../dist/final/node/index.mjs';

//region Native executable fixtures

/**
 File mode making native-format fixtures executable by owner.
 */
const EXECUTABLE_MODE = 0o755;

/**
 Marker-like payload proving native executables bypass text self-shim inspection.
 */
const MARKER_PAYLOAD = Buffer.from('@monochromatic-dev/git-policy-cli',);

/**
 Supported native executable signatures.
 */
const NATIVE_HEADER_CASES: readonly {
  readonly name: string;
  readonly hexPrefix: string;
}[] = [
  { name: 'ELF', hexPrefix: '7f454c46', },
  { name: 'PE', hexPrefix: '4d5a', },
  { name: 'big-endian 32-bit Mach-O', hexPrefix: 'feedface', },
  { name: 'big-endian 64-bit Mach-O', hexPrefix: 'feedfacf', },
  { name: 'little-endian 32-bit Mach-O', hexPrefix: 'cefaedfe', },
  { name: 'little-endian 64-bit Mach-O', hexPrefix: 'cffaedfe', },
  { name: 'big-endian universal Mach-O', hexPrefix: 'cafebabe', },
  { name: 'little-endian universal Mach-O', hexPrefix: 'bebafeca', },
  { name: 'big-endian 64-bit universal Mach-O', hexPrefix: 'cafebabf', },
  { name: 'little-endian 64-bit universal Mach-O', hexPrefix: 'bfbafeca', },
];

/**
 Disposable temporary directory used by native-header tests.
 */
type TempDirectory = {
  readonly path: string;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 Creates disposable temporary directory for native executable fixture.
 
 @returns Directory removed when async disposal completes.
 
 @example
 ```ts
 await using tempDirectory = await createTempDirectory();
 ```
 */
async function createTempDirectory(): Promise<TempDirectory> {
  /**
   Absolute fixture root unique to current test.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'git-executable-native-',
  ),);

  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

//endregion Native executable fixtures

await describe({
  name: resolveRealGit.name,
  children: NATIVE_HEADER_CASES.map(function mapNativeHeaderCase(nativeHeaderCase,) {
    return it({
      name: `accepts ${nativeHeaderCase.name} header before marker-like payload`,
      fn: async function acceptsNativeHeader(): Promise<void> {
        await using tempDirectory = await createTempDirectory();
        /**
         PATH directory containing native-format candidate.
         */
        const nativeBin = join(tempDirectory.path, 'native-bin',);
        await mkdir(nativeBin,);
        /**
         Native-format candidate containing wrapper marker after recognized header.
         */
        const nativeGit = join(nativeBin, 'git',);
        await writeFile(
          nativeGit,
          Buffer.concat([
            Buffer.from(nativeHeaderCase.hexPrefix, 'hex',),
            MARKER_PAYLOAD,
          ],),
          { mode: EXECUTABLE_MODE, },
        );
        await chmod(
          nativeGit,
          EXECUTABLE_MODE,
        );

        expect(await resolveRealGit({
          pathEnv: nativeBin,
          commonGitPaths: [nativeGit,],
        },),).toBe(nativeGit,);
      },
    },);
  },),
},);
