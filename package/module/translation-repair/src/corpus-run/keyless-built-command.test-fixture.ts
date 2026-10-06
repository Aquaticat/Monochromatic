import { join, } from 'node:path';

import {
  type ChildRun,
  runBuiltCommand,
} from '../child-environment.test-fixture.ts';

//region Keyless built command
// RUNS A BUILT RUNNER IN A CHILD PROCESS THAT CARRIES NO PROVIDER KEY, so a
// case can read what the real command prints and how it exits without any
// chance of a call leaving the machine, whatever the parent's own
// environment holds.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. The child is started by the shared keyless
// fixture (`child-environment.test-fixture.ts`), which removes every provider
// key and every setting of the package from its environment, and the three
// places a runner reads from the operator's machine (the runs directory, the
// lookup cache and the corpus clone) point at directories the case owns.

/**
 The whole stderr a runner leaves when it reaches its first call with no
 provider key set: the stated refusal `createRunClient` raises, as
 `reportingRefusals` prints it.

 @param command - name of the built runner, which starts the line

 @returns The refusal line with its newline

 @example
 ```ts
 expect(run.stderr,).toBe(noKeyRefusal({ command: 'probe-sensitivity', },),);
 ```
 */
export function noKeyRefusal({ command, }: { readonly command: string; },): string {
  return `${command}: TRANSLATION_REPAIR_SYNTHETIC_API_KEY, TRANSLATION_REPAIR_CHARM_HYPER_API_KEY, `
    + 'TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY or TRANSLATION_REPAIR_OPENROUTER_API_KEY is not set; '
    + 'run under mise so sops injects it\n';
}

/**
 Runs one built runner with every provider key withheld.

 @param command - name of the built runner, as `build-entries.ts` names it

 @param runsDir - directory the child treats as its runs directory, owned by
 the calling case

 @param scratchDir - directory the child's lookup cache and corpus clone
 variables point under, so neither names the operator's own

 @param args - arguments after the script, none by default

 @returns Exit code and both streams

 @example
 ```ts
 const run = await runBuiltWithoutKeys({ command: 'probe-sensitivity', runsDir, scratchDir, },);
 ```
 */
export async function runBuiltWithoutKeys(
  {
    command,
    runsDir,
    scratchDir,
    args = [],
  }: {
    readonly command: string;
    readonly runsDir: string;
    readonly scratchDir: string;
    readonly args?: readonly string[];
  },
): Promise<ChildRun> {
  return await runBuiltCommand({
    command,
    args,
    env: {
      TRANSLATION_REPAIR_RUNS_DIR: runsDir,
      TRANSLATION_REPAIR_LOOKUP_CACHE_DIR: join(
        scratchDir,
        'lookup-cache',
      ),
      TRANSLATION_REPAIR_CORPUS_CLONE_DIR: join(
        scratchDir,
        'corpus-clone',
      ),
    },
  },);
}

//endregion Keyless built command
