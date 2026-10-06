import {
  type ChildRun,
  runBuiltCommand,
} from '../child-environment.test-fixture.ts';

//region Report built run
// RUNS A BUILT REPORT COMMAND IN A CHILD PROCESS THAT HOLDS NO PROVIDER KEY.
//
// The child is started by the shared keyless fixture
// (`child-environment.test-fixture.ts`), which removes every provider key and
// every setting of the package from its environment, so a case can neither
// refuse for the wrong reason nor spend, whatever the runner's own environment
// holds. The runs directory is the one the case names, never the operator's.
// The reports of this family read files and print, so nothing here needs more
// than that.

/**
 Runs one built report command with every provider key withheld.

 @param command - runner's name, which names `dist/final/node/<command>.mjs`

 @param args - command line after the script

 @param runsDir - directory the child takes for its runs directory

 @returns Exit code and both streams

 @example
 ```ts
 const run = await runBuiltReport({ command: 'meter-report', args: [path,], runsDir: scratch.path, },);
 ```
 */
export async function runBuiltReport(
  {
    command,
    args,
    runsDir,
  }: {
    readonly command: string;
    readonly args: readonly string[];
    readonly runsDir: string;
  },
): Promise<ChildRun> {
  return await runBuiltCommand({
    command,
    args,
    env: { TRANSLATION_REPAIR_RUNS_DIR: runsDir, },
  },);
}

//endregion Report built run
