import {
  type ChildRun,
  runBuiltCommand,
} from '../child-environment.test-fixture.ts';

//region Built command without keys
// RUNS A BUILT COMMAND IN A CHILD PROCESS whose environment holds no provider
// key and none of the package's own `TRANSLATION_REPAIR_` variables the
// runner's own environment carries, so a case can neither spend nor read the
// operator's runs, caches or clone whatever the process running the suite
// holds. A case names the variables its command reads, each at a scratch
// location it made.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. The child is started by the shared keyless
// fixture (`child-environment.test-fixture.ts`); this is the name the as-built
// suites of the report runners call it by, with every argument required so a
// case states the variables it hands over.

/**
 Runs a built command with every provider key withheld.

 @param command - built entry's name, such as `cap-census`

 @param args - arguments after it

 @param env - variables the command reads, each pointing at a scratch location
 the case made

 @param cwd - directory to run it from, the package directory when omitted

 @returns Exit code and both streams

 @example
 ```ts
 const run = await runBuiltWithoutKeys({ command: 'cap-census', args: [logPath,], env: {}, },);
 ```
 */
export async function runBuiltWithoutKeys(
  {
    command,
    args,
    env,
    cwd,
  }: {
    readonly command: string;
    readonly args: readonly string[];
    readonly env: Readonly<Record<string, string>>;
    readonly cwd?: string;
  },
): Promise<ChildRun> {
  return await runBuiltCommand({
    command,
    args,
    env,
    ...((cwd === undefined) ? {} : { cwd, }),
  },);
}

//endregion Built command without keys
