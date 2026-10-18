/** Project-first default destination selection, with strict explicit destinations. @module */
import { stat, } from 'node:fs/promises';
import { dirname, join, } from 'node:path';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { reportLoggerFallback, } from '../error-format.ts';
import { openLogFile, } from './file-open.ts';
import { findNodeModulesUp, NO_NODE_MODULES_FOUND, } from './file-project.ts';
import { userLogDirectory, } from './file-state.ts';

//region Fallback is visible and cannot redirect a caller-selected destination.
/**
 Verify user state before announcing that records will be written there.

 @param reason - evidence explaining why project-local logging is unavailable
 @returns Exclusively owned and verified file path.
 */
async function openFallback(reason: string,): Promise<string> {
  const directory = userLogDirectory();
  const filePath = await openLogFile(directory,);
  reportLoggerFallback({ directory, reason, },);
  return filePath;
}

/**
 Select and verify a file without silently redirecting explicit destinations.

 @param directory - caller-selected destination, absent for project discovery
 @returns Verified file owned by this sink.
 */
export async function openFileDestination({ directory, }: { readonly directory?: string; },): Promise<string> {
  if (directory !== undefined)
    return await openLogFile(directory,);
  const nodeModules = await findNodeModulesUp({ cwd: process.cwd(), stat, dirname, join, },);
  if (nodeModules === NO_NODE_MODULES_FOUND)
    return await openFallback('No ancestor node_modules directory was found',);
  const projectDirectory = join(nodeModules, '.monochromatic',);
  try {
    return await openLogFile(projectDirectory,);
  }
  catch (error: unknown) {
    return await openFallback(`Project directory ${JSON.stringify(projectDirectory,)}: ${caughtValueText(error,)}`,);
  }
}
//endregion
