import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type Plugin,
  rolldown,
  VERSION,
} from 'rolldown';

import {
  CHECKOUT_BUNDLER_PLUGIN_NAME,
  checkoutBundlerPlugin,
} from './checkout-bundler.ts';
import { familyLibraryNodeConfig, } from './index.node.ts';

/**
 Disposable entry-source fixture directory.
 */
type EntryFixture = {
  readonly path: string;
  [Symbol.dispose]: () => void;
};

/**
 Creates a disposable directory holding one entry source and a manifest with no family members.

 @returns Disposable fixture outside repository state.

 @example
 ```ts
 using fixture = createEntryFixture();
 ```
 */
function createEntryFixture(): EntryFixture {
  /**
   Fresh fixture directory under the system temp root.
   */
  const path = mkdtempSync(join(tmpdir(), 'checkout-bundler-',),);
  writeFileSync(join(path, 'entry.ts',), 'export const cat = 1;\n',);
  writeFileSync(join(path, 'package.json',), JSON.stringify({ name: '@x/family-markup', },),);
  return {
    path,
    [Symbol.dispose]: function removeFixture(): void {
      rmSync(path, {
        force: true,
        recursive: true,
      },);
    },
  };
}

/**
 Builds the fixture entry through the guard, told the given installed version.

 @param packageDir - fixture directory holding entry.ts

 @param installedVersion - version the guard is told this checkout installs, the running one or another

 @example
 ```ts
 await buildGuarded({ packageDir: fixture.path, installedVersion: VERSION, },);
 ```
 */
async function buildGuarded({
  packageDir,
  installedVersion,
}: {
  readonly packageDir: string;
  readonly installedVersion: string;
},): Promise<void> {
  /**
   Real rolldown build of the fixture entry.
   */
  const build = await rolldown({
    input: [join(packageDir, 'entry.ts',),],
    plugins: [checkoutBundlerPlugin({ installedVersion, },),],
  },);
  await build.close();
}

/**
 Builds the fixture entry through the guard and returns what the build threw.

 @param packageDir - fixture directory holding entry.ts

 @param installedVersion - version the guard is told this checkout installs

 @returns The thrown value, or undefined when the build went through

 @example
 ```ts
 const refusal = await refusalOf({ packageDir: fixture.path, installedVersion: '0.0.0', },);
 ```
 */
async function refusalOf({
  packageDir,
  installedVersion,
}: {
  readonly packageDir: string;
  readonly installedVersion: string;
},): Promise<unknown> {
  try {
    await buildGuarded({
      packageDir,
      installedVersion,
    },);
    return undefined;
  } catch (error) {
    return error;
  }
}

await describe({
  name: checkoutBundlerPlugin.name,
  children: [
    it({
      name: 'lets a build through when the running bundler is the version this checkout installs',
      fn: async function admitsInstalledVersion(): Promise<void> {
        using fixture = createEntryFixture();
        await buildGuarded({
          packageDir: fixture.path,
          installedVersion: VERSION,
        },);
      },
    },),
    it({
      name: 'refuses a build run by another version, naming both versions, PATH and each way to fix it',
      fn: async function refusesOtherVersion(): Promise<void> {
        using fixture = createEntryFixture();
        /**
         Rejection the guarded build raised.
         */
        const refusal = await refusalOf({
          packageDir: fixture.path,
          installedVersion: '0.0.0-installed',
        },);
        expect(refusal,).toBeInstanceOf(Error,);
        /**
         The refusal's text.
         */
        const message = String((refusal as Error).message,);
        expect(message,).toContain(`running rolldown ${VERSION}`,);
        expect(message,).toContain('installs rolldown 0.0.0-installed',);
        expect(message,).toContain('PATH',);
        expect(message,).toContain('node_modules/.bin',);
        expect(message,).toContain('--setenv=PATH',);
        expect(message,).toContain('reinstall',);
      },
    },),
  ],
},);

await describe({
  name: `${familyLibraryNodeConfig.name} bundler guard`,
  children: [
    it({
      name: 'carries the checkout bundler guard first, ahead of every plugin that writes output',
      fn: async function carriesGuardFirst(): Promise<void> {
        using fixture = createEntryFixture();
        /**
         Library config for a member with no family siblings.
         */
        const config = await familyLibraryNodeConfig({
          familyPrefix: '@x/family-',
          packageDir: fixture.path,
        },);
        /**
         Plugins the config carries, in order.
         */
        const plugins = config.plugins as readonly Plugin[];
        expect(plugins.at(0,)?.name,).toBe(CHECKOUT_BUNDLER_PLUGIN_NAME,);
      },
    },),
  ],
},);
