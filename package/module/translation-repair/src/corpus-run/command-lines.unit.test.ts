/**
 Tests the declaration of what every runner reads from its command line
 (ledger B75): that it declares every runner the build makes and nothing
 else, that each declaration can be read as written, and that each runner's
 mise task description offers exactly the flags its runner reads.

 @module
 */

import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  COMMAND_LINES,
  nodeEntries,
} from '../../dist/final/node/index.mjs';

/**
 The package's task file, beside `src`.
 */
const MISE_TOML = join(
  import.meta.dirname,
  '../..',
  'mise.toml',
);

/**
 Start of a task's run line naming a built runner.
 */
const RUN_PREFIX = 'run = "node dist/final/node/';

/**
 End of that run line.
 */
const RUN_SUFFIX = '.mjs"';

/**
 Start of a task's description line.
 */
const DESCRIPTION_PREFIX = 'description = ';

/**
 Start of a table header line in the task file.
 */
const HEADER_PREFIX = '[';

/**
 A long flag as a description spells one: two dashes, then a lowercase word
 that may carry inner dashes. A bare `--`, which descriptions write before
 the arguments mise passes on, has no word and is not one.
 */
const FLAG_PATTERN = /--[a-z][a-z-]*/gu;

/**
 Each runner's task description in the task file, by runner name.

 READ LINE BY LINE, NOT AS TOML, since the package has no TOML parser and
 every task here writes its description and run on lines of their own; a
 runner whose task this cannot find is missing from the answer, which the
 case holds against the runner list, so a change of layout fails loudly.

 @param text - the task file

 @returns Description of the task that runs each runner, by runner name

 @example
 ```ts
 const descriptions = taskDescriptions({ text: await readFile(MISE_TOML, 'utf8',), },);
 ```
 */
function taskDescriptions({ text, }: { readonly text: string; },): ReadonlyMap<string, string> {
  /**
   Descriptions found, by runner name.
   */
  const found = new Map<string, string>();

  /**
   Description of the task being read, empty until its line is reached.
   */
  let description = '';
  for (const line of text.split('\n',)) {
    if (line.startsWith(HEADER_PREFIX,))
      description = '';
    else if (line.startsWith(DESCRIPTION_PREFIX,)) {
      /**
       The description as TOML writes it, a quoted string JSON reads alike.
       */
      const parsed: unknown = JSON.parse(line.slice(DESCRIPTION_PREFIX.length,),);
      description = (typeof parsed === 'string') ? parsed : '';
    } else if (line.startsWith(RUN_PREFIX,) && line.endsWith(RUN_SUFFIX,)) {
      found.set(
        line.slice(
          RUN_PREFIX.length,
          -RUN_SUFFIX.length,
        ),
        description,
      );
    }
  }
  return found;
}

await describe({
  name: 'COMMAND_LINES',
  children: [
    it({
      name: 'DECLARES every runner the build makes and nothing else, so no runner reads a line undeclared',
      fn: async () => {
        expect(Object.keys(COMMAND_LINES,).toSorted(),).toEqual(
          Object.keys(nodeEntries,)
            .filter(function isRunner(name,): boolean {
              return name !== 'index';
            },)
            .toSorted(),
        );
      },
    },),
    it({
      name: 'DECLARES each flag once, under a name a long flag can carry, and positions that can be written',
      fn: async () => {
        /**
         What is wrong with each declaration, empty for none.
         */
        const problems = Object.entries(COMMAND_LINES,).flatMap(function problemsOf([command, spec,],): string[] {
          /**
           Every flag the declaration names, in all three groups.
           */
          const names = [
            ...Object.keys(spec.valued,),
            ...Object.keys(spec.repeatable,),
            ...Object.keys(spec.switches,),
          ];
          /**
           Names of the positions, how many must be written, and whether the last repeats.
           */
          const {
            names: positions,
            least,
            rest,
          } = spec.positionals;
          return [
            ...((new Set(names,).size === names.length) ? [] : [`${command} names a flag twice`,]),
            ...names
              .filter(function isMalformed(name,): boolean {
                return !/^[a-z][a-z-]*$/u.test(name,);
              },)
              .map(function malformed(name,): string {
                return `${command} names flag ${name}`;
              },),
            ...((least <= positions.length) ? [] : [`${command} requires more positions than it names`,]),
            ...((rest && (positions.length === 0)) ? [`${command} repeats a position it does not name`,] : []),
          ];
        },);
        expect(problems,).toEqual([],);
      },
    },),
    it({
      name: 'OFFERS in each runner\'s task description exactly the flags the runner reads, so a description '
        + 'cannot offer a flag the runner refuses or leave out one it reads',
      fn: async () => {
        /**
         Each runner's task description.
         */
        const descriptions = taskDescriptions({ text: await readFile(MISE_TOML, 'utf8',), },);

        /**
         The flags each description spells, by runner.
         */
        const offered = Object.fromEntries(Object.keys(COMMAND_LINES,).map(function offeredBy(command,): [
          string,
          readonly string[],
        ] {
          return [
            command,
            [...new Set((descriptions.get(command,) ?? '').match(FLAG_PATTERN,) ?? [],),].toSorted(),
          ];
        },),);

        /**
         The flags each runner reads, by runner.
         */
        const read = Object.fromEntries(Object.entries(COMMAND_LINES,).map(function readBy([command, spec,],): [
          string,
          readonly string[],
        ] {
          return [
            command,
            [
              ...Object.keys(spec.valued,),
              ...Object.keys(spec.repeatable,),
              ...Object.keys(spec.switches,),
            ]
              .map(function dashed(name,): string {
                return `--${name}`;
              },)
              .toSorted(),
          ];
        },),);

        expect([...descriptions.keys(),].toSorted(),).toEqual(Object.keys(COMMAND_LINES,).toSorted(),);
        expect(offered,).toEqual(read,);
      },
    },),
  ],
},);
