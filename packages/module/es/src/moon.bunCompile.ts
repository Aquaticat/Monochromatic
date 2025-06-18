/**
 * Compiles moon.*.ts scripts to standalone executables for multiple platforms.
 *
 * This script uses Bun's compile feature to create platform-specific executables
 * from TypeScript moon scripts, enabling distribution without requiring Bun runtime.
 *
 * Usage:
 *   bun moon.bunCompile.ts
 */

import findUp from 'find-up';
import spawn from 'nano-spawn';
import { mkdir } from 'node:fs/promises';
import {
  basename,
  dirname,
  join,
} from 'node:path';
import { glob } from 'tinyglobby';

//region Target definitions -- Platform-specific compilation targets

const targets = [
  { name: 'bun-linux-x64', os: 'Linux', arch: 'x64', libc: 'glibc' },
  { name: 'bun-linux-arm64', os: 'Linux', arch: 'arm64', libc: 'glibc' },
  { name: 'bun-windows-x64', os: 'Windows', arch: 'x64', libc: '-' },
  { name: 'bun-darwin-x64', os: 'macOS', arch: 'x64', libc: '-' },
  { name: 'bun-darwin-arm64', os: 'macOS', arch: 'arm64', libc: '-' },
  { name: 'bun-linux-x64-musl', os: 'Linux', arch: 'x64', libc: 'musl' },
  { name: 'bun-linux-arm64-musl', os: 'Linux', arch: 'arm64', libc: 'musl' },
] as const;

//endregion Target definitions

//region Helper functions -- Utility functions for file operations and compilation

/**
 * Gets the package root directory by finding the nearest package.json.
 * @returns absolute path to the package root directory.
 */
async function getPackageRoot(): Promise<string> {
  const packageJsonPath = await findUp('package.json', {
    cwd: import.meta.dirname,
  });

  if (!packageJsonPath) {
    throw new Error('Could not find package.json');
  }

  return dirname(packageJsonPath);
}

/**
 * Extracts script name from filename.
 * @param filename - moon.*.ts filename.
 * @returns script name without moon prefix and .ts extension.
 */
function extractScriptName(filename: string): string {
  const base = basename(filename, '.ts');
  // Remove 'moon.' prefix
  return base.replace(/^moon\./v, '');
}

/**
 * Constructs output path for compiled executable.
 * @param scriptName - name of the script.
 * @param target - compilation target.
 * @param packageRoot - root directory of the package.
 * @returns full output path.
 */
function getOutputPath(scriptName: string, target: string, packageRoot: string): string {
  const outputDir = join(packageRoot, 'dist', 'final');
  // Bun automatically adds .exe on Windows
  return join(outputDir, `moon.${scriptName}.${target}`);
}

/**
 * Compiles a single script for a specific target.
 * @param scriptPath - path to the TypeScript file.
 * @param target - compilation target.
 * @param packageRoot - root directory of the package.
 * @returns promise that resolves when compilation is complete.
 */
async function compileScript(scriptPath: string, target: string,
  packageRoot: string): Promise<void>
{
  const scriptName = extractScriptName(scriptPath);
  const outputPath = getOutputPath(scriptName, target, packageRoot);

  // Ensure output directory exists
  await mkdir(dirname(outputPath), { recursive: true });

  console.log(`Compiling ${basename(scriptPath)} for ${target}...`);

  try {
    await spawn('bun', [
      'build',
      scriptPath,
      '--compile',
      `--target=${target}`,
      `--outfile=${outputPath}`,
    ], {
      stdout: 'inherit',
      stderr: 'inherit',
    });

    console.log(`✓ Compiled ${basename(scriptPath)} for ${target}`);
  } catch (error) {
    console.error(`✗ Failed to compile ${basename(scriptPath)} for ${target}:`);
    if (error && typeof error === 'object' && 'exitCode' in error) {
      const subprocessError = error as { exitCode?: number; message: string; };
      console.error(`  Exit code: ${subprocessError.exitCode}`);
    }
    throw error;
  }
}

//endregion Helper functions

//region Main execution -- Script entry point and parallel compilation

// Get the package root directory
const packageRoot = await getPackageRoot();

// Find all moon.*.ts files in the src directory
const srcDir = join(packageRoot, 'src');
const scriptPaths = await glob('moon.*.ts', {
  cwd: srcDir,
});

if (scriptPaths.length === 0) {
  console.log('No moon.*.ts scripts found to compile');
} else {
  console.log(`Found ${scriptPaths.length} script(s) to compile:`);
  scriptPaths.forEach((script) => {
    console.log(`  - ${basename(script)}`);
  });
  console.log('');

  // Create all compilation tasks
  const compilationTasks: Promise<void>[] = [];

  for (const scriptPath of scriptPaths) {
    // Construct full path to the script
    const fullScriptPath = join(srcDir, scriptPath);
    for (const target of targets) {
      compilationTasks.push(compileScript(fullScriptPath, target.name, packageRoot));
    }
  }

  console.log(`Starting compilation of ${compilationTasks.length} targets...\n`);

  // Run all compilations in parallel
  const results = await Promise.allSettled(compilationTasks);

  // Report results
  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  console.log('\n=== Compilation Summary ===');
  console.log(`Total: ${results.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);

  if (failed > 0) {
    throw new Error(`${failed} compilation(s) failed. See errors above.`);
  }

  console.log('\nAll compilations completed successfully!');
}

//endregion Main execution
