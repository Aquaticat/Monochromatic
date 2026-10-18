/**
 Tests for which source files the pre-launch cache check reads: the package's
 own `src` where the package stands alone, and the `src` of every package of
 the translation-repair family where it stands in the family's directory,
 since a cache version now lives in whichever package declares the constant.

 Each case builds a throwaway repository, so nothing here reads this
 repository's history. Fixtures are cat-themed invention.

 @module
 */

import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  auditCacheAccounts,
  auditedSourcesOf,
} from '../../dist/final/node/index.mjs';
import { scratchDir, } from '@monochromatic-dev/translation-repair-test-fixture/ts/scratch-dir.test-fixture.ts';
import {
  commitFileAt,
  makeCacheAccountRepo,
} from './cache-account-repo.test-fixture.ts';
import { lineOf, } from '@monochromatic-dev/translation-repair-run/ts/corpus-run/command-line.test-fixture.ts';
import { divertingConsoleLog, } from '@monochromatic-dev/translation-repair-test-fixture/ts/corpus-run/console-log-capture.test-fixture.ts';

/**
 Where the family's packages sit in the repository.
 */
const FAMILY = 'package/translation-repair';

/**
 Adds two family packages to a repository: one declaring a cache version, one
 declaring another and holding a test file, and a package outside the family
 declaring a third.

 @param cloneDir - repository directory

 @example
 ```ts
 await addFamily({ cloneDir: repo.path, },);
 ```
 */
async function addFamily({ cloneDir, }: { readonly cloneDir: string; },): Promise<void> {
  await commitFileAt({
    cloneDir,
    day: 5,
    path: `${FAMILY}/alpha/src/alpha-cache-version.ts`,
    text: 'export const ALPHA_CACHE_VERSION = 2;\n',
    subject: 'set the alpha cache version',
  },);
  await commitFileAt({
    cloneDir,
    day: 6,
    path: `${FAMILY}/beta/src/beta-cache-version.ts`,
    text: 'export const BETA_CACHE_VERSION = 5;\n',
    subject: 'set the beta cache version',
  },);
  await commitFileAt({
    cloneDir,
    day: 7,
    path: `${FAMILY}/beta/src/beta.unit.test.ts`,
    text: 'export const BETA_TEST_CACHE_VERSION = 9;\n',
    subject: 'test beta',
  },);
  await commitFileAt({
    cloneDir,
    day: 8,
    path: 'package/stray/src/stray-cache-version.ts',
    text: 'export const STRAY_CACHE_VERSION = 1;\n',
    subject: 'set the stray cache version',
  },);
}

await describe({
  name: auditedSourcesOf.name,
  children: [
    it({
      name: 'LISTS THE SOURCE OF EVERY PACKAGE OF THE FAMILY where the package sits in the family directory, '
        + 'leaving out tests and what stands outside the family',
      fn: async () => {
        await using repo = await makeCacheAccountRepo({ versions: 'none', },);
        await addFamily({ cloneDir: repo.path, },);

        expect(await auditedSourcesOf({
          packageDirectory: join(
            repo.path,
            FAMILY,
            'alpha',
          ),
        },),).toEqual({
          sources: `${FAMILY}/*/src`,
          files: [
            `${FAMILY}/alpha/src/alpha-cache-version.ts`,
            `${FAMILY}/beta/src/beta-cache-version.ts`,
          ],
        },);
      },
    },),
    it({
      name: 'LISTS ONLY THE PACKAGE\'S OWN SOURCE where the package stands outside the family directory',
      fn: async () => {
        await using repo = await makeCacheAccountRepo({ versions: 'none', },);
        await addFamily({ cloneDir: repo.path, },);

        expect(await auditedSourcesOf({
          packageDirectory: join(
            repo.path,
            'package',
            'stray',
          ),
        },),).toEqual({
          sources: 'package/stray/src',
          files: ['package/stray/src/stray-cache-version.ts',],
        },);
      },
    },),
  ],
},);

await describe({
  name: `${auditCacheAccounts.name} over the family`,
  children: [
    it({
      name: 'READS THE CACHE VERSIONS OF EVERY FAMILY PACKAGE and names the family\'s source directories in its heading',
      fn: async (ctx) => {
        using printed = divertingConsoleLog({ sinon: ctx.sinon, },);
        await using repo = await makeCacheAccountRepo({ versions: 'none', },);
        await using runs = await scratchDir({ prefix: 'cache-account-sources-runs-', },);
        await addFamily({ cloneDir: repo.path, },);

        await auditCacheAccounts({
          line: lineOf({ command: 'cache-account-audit', typed: [], },),
          packageDirectory: join(
            repo.path,
            FAMILY,
            'beta',
          ),
          runsDir: runs.path,
        },);

        expect({
          heading: printed.lines.filter(function opensReport(line,): boolean {
            return line.startsWith('cache-account-audit: ',);
          },),
          settings: printed.lines
            .filter(function namesVersion(line,): boolean {
              return line.startsWith('  ALPHA',) || line.startsWith('  BETA',);
            },)
            .map(function beforeHash(line,): string {
              return line.slice(
                0,
                line.indexOf(': set in',),
              );
            },),
        },).toEqual({
          heading: [`cache-account-audit: 2 cache versions under ${FAMILY}/*/src`,],
          settings: [
            `  ALPHA_CACHE_VERSION = 2 (${FAMILY}/alpha/src/alpha-cache-version.ts)`,
            `  BETA_CACHE_VERSION = 5 (${FAMILY}/beta/src/beta-cache-version.ts)`,
          ],
        },);
      },
    },),
  ],
},);
