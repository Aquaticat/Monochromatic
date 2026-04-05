#!/usr/bin/env bun
import nanoSpawn, { SubprocessError, } from 'nano-spawn';

import {
  l,
  tagged,
} from './log.ts';
import { resolveGit, } from './resolve-git.ts';
import { atomicPush, } from './rules/atomic-push.ts';
import { requireRoot, } from './rules/require-root.ts';

export {};

//region Rule pipeline -- validate and transform args before forwarding to real git

/** Tagged logger for the main entry point. */
const rl = tagged({
  tag: 'main',
  l,
},);

/** Raw arguments passed after the script name. */
const rawArgs: readonly string[] = process.argv.slice(2,);

/**
 * Subcommands that request version information.
 * After forwarding to real git, the wrapper appends its own identity.
 */
const VERSION_SUBCOMMANDS: ReadonlySet<string> = new Set([
  'version',
  '--version',
  '-v',
],);

/**
 * Rules applied in sequence. Each rule may transform args or throw to reject.
 * Order matters: root check runs first (fail fast), then arg transforms.
 */
const RULES: readonly ((args: readonly string[]) => readonly string[] | Promise<readonly string[]>)[] = [
  requireRoot,
  atomicPush,
];

//endregion Rule pipeline

//region Execution -- resolve real git, apply rules, spawn

try {
  /** Final arguments after all rules have been applied. */
  const processedArgs = await RULES.reduce(
    async function applyRule(
      accumulatedArgs,
      rule,
    ) {
      return rule(await accumulatedArgs,);
    },
    Promise.resolve(rawArgs,),
  );

  rl.debug(`final args: [${processedArgs.join(', ',)}]`,);

  /** Absolute path to the real git binary. */
  const gitPath = await resolveGit();
  rl.debug(`using real git at ${gitPath}`,);

  await nanoSpawn(
    gitPath,
    [...processedArgs,],
    { stdio: 'inherit', },
  );

  if (processedArgs.length > 0 && processedArgs[0] !== undefined && VERSION_SUBCOMMANDS.has(processedArgs[0],)) {
    console.log('cli-git wrapper (require-root, atomic-push)',);
  }
}
catch (error) {
  if (error instanceof SubprocessError) {
    process.exitCode = error.exitCode ?? 1;
  }
  else if (error instanceof Error) {
    console.error(error.message,);
    process.exitCode = 1;
  }
  else {
    throw error;
  }
}

//endregion Execution
