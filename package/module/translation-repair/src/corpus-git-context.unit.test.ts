/**
 Tests for the environment every corpus git child runs in: the caller's, with
 its repository routing, its credentials and the package's settings stated
 absent, the clone's own objects pinned, and git's messages in the C locale.

 WHY THE LOCALE IS SET. The corpus reader tells a page a pinned commit lacks
 from every other failed read by the English words git prints (`does not exist
 in`), and git translates its messages into the caller's language: under
 `LANGUAGE=de` it prints the same refusal in German, which the reader then
 reads as another failure. `LC_ALL=C` holds git to its own English whatever
 the caller's locale variables say.

 THE LOCALE CASE RUNS REAL GIT against a throwaway repository through the
 shared child fixture, handing the child the caller's locale with and without
 the corpus environment around it, so the control shows this machine's git
 translating before the case reads the English back.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { devNull, } from 'node:os';

import { resolveRealGit as resolveGit, } from '@monochromatic-dev/git-executable/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { corpusGitEnvironment, } from '../dist/final/node/index.mjs';
import { makeNamingArchive, } from './archive-naming.test-fixture.ts';
import { runKeyless, } from './child-environment.test-fixture.ts';

/**
 Native executable, never the current repository's command-policy wrapper.
 */
const REAL_GIT = await resolveGit();

/**
 Path no commit of the throwaway repository holds.
 */
const ABSENT_PATH = 'people/absent-cat/page.md';

/**
 A caller's locale under which git translates into German: an English locale
 for the rest, German first in the language list, and neither `LC_ALL` nor
 `LC_MESSAGES` set, so the language list is what git's messages follow.
 */
const CALLER_LOCALE: Readonly<Record<string, string>> = {
  LANG: 'en_US.UTF-8',
  LANGUAGE: 'de',
  LC_ALL: '',
  LC_MESSAGES: '',
};

/**
 The variables an environment sets, as the shared child fixture takes them.

 @param environment - environment a builder made from names it keeps or sets

 @returns Each variable's value by name

 @throws Error when the builder stated a variable absent, which it does only
 for a name it removes, and the caller's locale holds none

 @example
 ```ts
 const extra = variablesSet({ environment: corpusGitEnvironment({ environment: CALLER_LOCALE, },), },);
 ```
 */
function variablesSet({ environment, }: { readonly environment: NodeJS.ProcessEnv; },): Readonly<Record<string, string>> {
  return Object.fromEntries(Object
    .entries(environment,)
    .map(function setOne([name, value,],): readonly [
      string,
      string,
    ] {
      if (value === undefined)
        throw new Error(`the corpus environment stated ${name} absent, though the caller's locale holds no name it removes`,);
      return [
        name,
        value,
      ];
    },),);
}

await describe({
  name: corpusGitEnvironment.name,
  children: [
    it({
      name: 'BUILDS THE CORPUS ENVIRONMENT WHOLE: the caller\'s plain variables and locale kept, its repository '
        + 'routing, its credential and its setting stated absent, the clone\'s own objects pinned, and git\'s '
        + 'messages held to the C locale over every locale variable the caller sets',
      fn: async () => {
        expect(corpusGitEnvironment({
          environment: {
            PATH: '/usr/bin',
            HOME: '/home/tabby',
            LANG: 'de_DE.UTF-8',
            LANGUAGE: 'de',
            LC_ALL: 'de_DE.UTF-8',
            LC_MESSAGES: 'de_DE.UTF-8',
            GIT_DIR: '/home/tabby/basket/.git',
            GIT_CONFIG_KEY_0: 'core.pager',
            GIT_CONFIG_VALUE_0: 'purr',
            GIT_NO_REPLACE_OBJECTS: '0',
            WHISKER_API_KEY: 'a cat naps',
            TRANSLATION_REPAIR_RUNS_DIR: '/home/tabby/runs',
          },
        },),).toEqual({
          PATH: '/usr/bin',
          HOME: '/home/tabby',
          LANG: 'de_DE.UTF-8',
          LANGUAGE: 'de',
          LC_ALL: 'C',
          LC_MESSAGES: 'de_DE.UTF-8',
          GIT_DIR: undefined,
          GIT_CONFIG_KEY_0: undefined,
          GIT_CONFIG_VALUE_0: undefined,
          GIT_GRAFT_FILE: devNull,
          GIT_NO_REPLACE_OBJECTS: '1',
          GIT_NO_LAZY_FETCH: '1',
          WHISKER_API_KEY: undefined,
          TRANSLATION_REPAIR_RUNS_DIR: undefined,
        },);
      },
    },),
    it({
      name: 'READS GIT\'S REFUSAL IN ENGLISH UNDER A CALLER\'S GERMAN LOCALE, from real git over a throwaway '
        + 'repository: a path the pinned commit lacks prints the words the corpus reader classifies by, where the '
        + 'same read in the caller\'s locale alone prints other words',
      fn: async () => {
        await using archive = await makeNamingArchive({},);
        /**
         The corpus read of a page the pinned commit lacks.
         */
        const args = [
          '-C',
          archive.pin.cloneDir,
          'show',
          `${archive.pin.commitSha}:${ABSENT_PATH}`,
        ];
        /**
         The read in the corpus environment built over the caller's locale.
         */
        const corpusRead = await runKeyless({
          file: REAL_GIT,
          args,
          extra: variablesSet({ environment: corpusGitEnvironment({ environment: CALLER_LOCALE, },), },),
        },);
        /**
         The same read in the caller's locale alone, the control showing this
         machine's git translates.
         */
        const callerRead = await runKeyless({
          file: REAL_GIT,
          args,
          extra: CALLER_LOCALE,
        },);
        expect(corpusRead,).toEqual({
          code: 128,
          stdout: '',
          stderr: `fatal: path '${ABSENT_PATH}' does not exist in '${archive.pin.commitSha}'\n`,
        },);
        expect(callerRead.code,).toBe(128,);
        expect(callerRead.stderr,).not.toBe(corpusRead.stderr,);
      },
    },),
  ],
},);
