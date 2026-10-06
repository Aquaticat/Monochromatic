/**
 A child process that runs a few lines against the built package, for a case
 that needs a first call of a memoised function in a process of its own.

 @module
 */

import { join, } from 'node:path';
import { pathToFileURL, } from 'node:url';

import spawn from 'nano-spawn';

import { scratchDir, } from '../scratch-dir.test-fixture.ts';

/**
 Runs lines against the built package in a fresh process and returns what it
 wrote to its standard output.

 @param body - module source run after `built`, the built package's namespace, is bound; it writes its answer with `process.stdout.write`

 @returns The child's standard output

 @throws SubprocessError when the child never started or exited with a failure

 @example
 ```ts
 const written = await runBuiltInChild({ body: 'process.stdout.write(await built.resolveGit());', },);
 ```
 */
export async function runBuiltInChild(
  { body, }: { readonly body: string; },
): Promise<string> {
  /**
   Directory the child runs in, so nothing it logs lands in the checkout.
   */
  await using scratch = await scratchDir({ prefix: 'built-child-', },);
  /**
   The built package, by absolute URL so the child can run from anywhere.
   */
  const builtUrl = pathToFileURL(join(
    import.meta.dirname,
    '..',
    '..',
    'dist',
    'final',
    'node',
    'index.mjs',
  ),);
  /**
   What the child wrote, a failed exit refusing instead.
   */
  const { stdout, } = await spawn(
    process.execPath,
    [
      '--input-type=module',
      '--eval',
      `const built = await import(${JSON.stringify(builtUrl.href,)});\n${body}`,
    ],
    { cwd: scratch.path, },
  );
  return stdout;
}
