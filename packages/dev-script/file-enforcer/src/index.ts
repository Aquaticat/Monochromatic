import { findUp, } from 'find-up';
import { startWatching, } from './watch.ts';

//region CLI entry point -- finds and imports file-enforcer.config.ts, optionally watches

/** Config file name to search for upward from cwd */
const CONFIG_NAME = 'file-enforcer.config.ts';

/** Raw CLI arguments after the script path */
const args = process.argv.slice(2);

/** Whether --watch was passed, enabling continuous file watching */
const watchMode = args.includes('--watch');

/** Positional args with flags stripped, used as an optional config path override */
const positionalArgs = args.filter((arg) => !arg.startsWith('--'));

/** Config path from CLI arg, or found by walking up from cwd */
const configPath = positionalArgs[0] ?? await findUp(CONFIG_NAME);

if (configPath === undefined) {
  throw new Error(`Could not find ${CONFIG_NAME} in any parent directory`);
}

console.log(`[file-enforcer] loading config: ${configPath}`);

// Importing the config executes it -- the config uses top-level await
await import(configPath);

if (watchMode) {
  await startWatching(configPath);
}

//endregion CLI entry point
