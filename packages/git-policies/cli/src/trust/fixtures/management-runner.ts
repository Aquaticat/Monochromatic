/**
 * Disposable trust management subprocess harness. @module
 */
import { runManagementCommand, } from '../../management.ts';

/**
 * Arguments after Node launcher fields.
 */
const harnessArgs = process.argv
  .slice(2,);
/**
 * Injected roots and management arguments.
 */
const [registryRoot, repositoryRoot, ...args] = harnessArgs;
if ((registryRoot === undefined) || (repositoryRoot === undefined))
  throw new Error('management runner requires registry and repository roots',);
process.exitCode = await runManagementCommand({
  args,
  gitGlobalArgs: [
    '-C',
    repositoryRoot,
  ],
  registryRoot,
},);
