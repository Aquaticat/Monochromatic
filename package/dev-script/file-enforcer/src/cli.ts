import {
  fileNamed,
  findRoot,
} from '@monochromatic-dev/module-fs-path/ts';
import { join, } from 'node:path';

import { setActiveConfigPath, } from './context.ts';
import { l, } from './logger.ts';
import { startWatching, } from './watch/watch.ts';

//region CLI entry point: finds and imports file-enforcer.config.ts, optionally watches

/**
 Config file name to search for upward from cwd
 */
const CONFIG_NAME = 'file-enforcer.config.ts';

/**
 Raw CLI arguments after the script path
 */
const args = process.argv
  .slice(2,);

/**
 Whether --watch was passed, enabling continuous file watching
 */
const watchMode = args.includes('--watch',);

/**
 Positional args with flags stripped, used as an optional config path override
 */
const positionalArgs = args.filter(function isPositional(arg,): boolean {
  return !arg.startsWith('--',);
},);

/**
 Config path from CLI arg, or the config file in the nearest ancestor of cwd that holds one.
 A missing config rejects with `RootNotFoundError`, which names the file and the start directory.
 */
const configPath = positionalArgs[0]
  ?? join(
    await findRoot({ marker: fileNamed(CONFIG_NAME,), },),
    CONFIG_NAME,
  );

l.info(`loading config: ${configPath}`,);
setActiveConfigPath({ configPath, },);

// Importing the config executes it: the config uses top-level await.
await import(configPath);

if (watchMode)
  await startWatching(configPath,);

//endregion CLI entry point
