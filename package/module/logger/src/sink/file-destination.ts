/**
 Project-first default destination selection, with strict explicit destinations. @module
 */
import { stat, } from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { reportLoggerFallback, } from '../error-format.ts';
import { openLogFile, } from './file-open.ts';
import {
  findNodeModulesUp,
  NO_NODE_MODULES_FOUND,
} from './file-project.ts';
import { userLogDirectory, } from './file-state.ts';

//region Fallback is visible and cannot redirect a caller-selected destination.
/**
 Verify user state before announcing that records will be written there.

 @param reason - evidence explaining why project-local logging is unavailable
 
 @returns Exclusively owned and verified file path.
 */
async function openFallback(reason: string,): Promise<string> {
  /**
   Fallback destination is resolved only after default project selection fails.
   */
  const directory = userLogDirectory();
  /**
   Only this verified file can receive queued records.
   */
  const filePath = await openLogFile(directory,);
  reportLoggerFallback({
    directory,
    reason,
  },);
  return filePath;
}

/**
 Select a default project file or visibly fall back to verified user state.
 
 @returns Verified file owned by this sink.

 @example
 ```ts
 const file = await openDefaultLogFile();
 ```
 */
export async function openDefaultLogFile(): Promise<string> {
  /**
   Nearest project dependency directory or the explicit missing-project sentinel.
   */
  const nodeModules = await findNodeModulesUp({
    cwd: process.cwd(),
    stat,
    dirname,
    join,
  },);
  if (nodeModules === NO_NODE_MODULES_FOUND)
    return await openFallback('No ancestor node_modules directory was found',);
  /**
   Existing default project location remains first choice.
   */
  const projectDirectory = join(
    nodeModules,
    '.monochromatic',
  );
  try {
    return await openLogFile(projectDirectory,);
  }
  catch (error: unknown) {
    return await openFallback(`Project directory ${JSON.stringify(projectDirectory,)}: ${caughtValueText(error,)}`,);
  }
}
//endregion
