import spawn from 'nano-spawn';
import { existsSync, } from 'node:fs';
import { join, } from 'node:path';
import { match, } from 'ts-pattern';

const startTotal = performance.now();

// Check if node_modules exists and has content
console.log('Checking node_modules state...',);
const startCheck = performance.now();
const nodeModulesPath = join(process.cwd(), 'node_modules',);
const nodeModulesExists = existsSync(nodeModulesPath,);
const lockfilePath = join(process.cwd(), 'pnpm-lock.yaml',);
const lockfileExists = existsSync(lockfilePath,);
console.log(`Check completed in ${(performance.now() - startCheck).toFixed(2,)}ms`,);

await match({ nodeModulesExists, lockfileExists, },)
  .with({ nodeModulesExists: false, }, { lockfileExists: false, }, async () => {
    // Need to install
    console.log('Running pnpm install...',);
    const startInstall = performance.now();
    await spawn('pnpm', [
      'install',
      '--prefer-frozen-lockfile',
      '--optimistic-repeat-install',
      '--prefer-offline',
    ], {
      stdio: 'inherit',
    },);
    console.log(
      `Installation completed in ${(performance.now() - startInstall).toFixed(2,)}ms`,
    );
  },)
  .otherwise(async () => {
    // Check if we're being prompted for reinstall
    console.log('Running pnpm install with auto-decline...',);
    const startInstall = performance.now();

    try {
      // Use shell to pipe 'n' to pnpm install, automatically declining any prompts
      await spawn('sh', [
        '-c',
        'echo n | pnpm install --prefer-frozen-lockfile --optimistic-repeat-install --prefer-offline',
      ], {
        stdio: 'inherit',
      },);

      console.log(
        `pnpm install check completed in ${
          (performance.now() - startInstall).toFixed(2,)
        }ms`,
      );
    }
    catch (error) {
      // Check if it's the expected "aborted remove modules" error
      const errorMessage = error instanceof Error ? error.message : String(error,);
      if (errorMessage.includes('ERR_PNPM_ABORTED_REMOVE_MODULES_DIR',)) {
        console.log(
          `pnpm install check completed in ${
            (performance.now() - startInstall).toFixed(2,)
          }ms (reinstall declined)`,
        );
      }
      else {
        throw error;
      }
    }
  },);

console.log(`Total time: ${(performance.now() - startTotal).toFixed(2,)}ms`,);
