/**
 * Compiles TypeScript scripts to standalone executables for multiple platforms.
 *
 * This script uses Bun's compile feature to create platform-specific executables
 * from TypeScript scripts with supported prefixes (moon, cli, etc.), enabling
 * distribution without requiring Bun runtime.
 *
 * Supported prefixes can be extended by modifying the SUPPORTED_PREFIXES array.
 *
 * Usage:
 *   bun moon.bunCompile.ts
 */

import { findUp, } from 'find-up';
import spawn from 'nano-spawn';
import { mkdir, } from 'node:fs/promises';
import {
  basename,
  dirname,
  join,
} from 'node:path';
import { serializeError, } from 'serialize-error';
import { glob, } from 'tinyglobby';

//region Target definitions -- Platform-specific compilation targets

/** Linux architectures */
type LinuxArch = 'x64' | 'arm64';

/** Linux libc variants */
type LinuxLibc = 'glibc' | 'musl';

/** Linux targets with explicit libc */
type LinuxTarget = `bun-linux-${LinuxArch}-${LinuxLibc}`;

/** Linux targets with implicit glibc */
type LinuxTargetImplicit = `bun-linux-${LinuxArch}`;

/** Windows targets */
type WindowsTarget = 'bun-windows-x64';

/** macOS targets */
type MacOSTarget = `bun-darwin-${'x64' | 'arm64'}`;

/** All valid compilation targets */
type CompilationTarget = LinuxTarget | LinuxTargetImplicit | WindowsTarget | MacOSTarget;

const targets: readonly CompilationTarget[] = [
  'bun-linux-x64',
  'bun-linux-arm64',
  'bun-windows-x64',
  'bun-darwin-x64',
  'bun-darwin-arm64',
  'bun-linux-x64-musl',
  'bun-linux-arm64-musl',
];

//endregion Target definitions

//region Helper functions -- Utility functions for file operations and compilation

/**
 * Gets the package root directory by finding the nearest package.json.
 * @returns absolute path to the package root directory.
 */
async function getPackageRoot(): Promise<string> {
  const packageJsonPath = await findUp('package.json', {
    cwd: import.meta.dirname,
  },);

  if (!packageJsonPath)
    throw new Error('Could not find package.json',);

  return dirname(packageJsonPath,);
}

/**
 * Supported script prefixes that can be compiled.
 */
const SUPPORTED_PREFIXES = ['moon', 'cli',] as const;

/**
 * Extracts script name and prefix from filename.
 * @param filename - script filename (e.g., moon.*.ts, cli.*.ts).
 * @returns object containing prefix and script name.
 */
function extractScriptInfo(filename: string,): { prefix: string; scriptName: string; } {
  const base = basename(filename, '.ts',);

  // Find which prefix matches
  for (const prefix of SUPPORTED_PREFIXES) {
    const prefixWithDot = `${prefix}.`;
    if (base.startsWith(prefixWithDot,)) {
      return {
        prefix,
        scriptName: base.slice(prefixWithDot.length,),
      };
    }
  }

  // This shouldn't happen if glob patterns are correct
  throw new Error(`Unexpected filename format: ${filename}`,);
}

/**
 * Constructs output path for compiled executable.
 * @param prefix - script prefix (moon, cli, etc.).
 * @param scriptName - name of the script.
 * @param target - compilation target.
 * @param packageRoot - root directory of the package.
 * @returns full output path.
 */
function getOutputPath(prefix: string, scriptName: string, target: string,
  packageRoot: string,): string
{
  const outputDir = join(packageRoot, 'dist', 'final',);
  // Bun automatically adds .exe on Windows
  return join(outputDir, `${prefix}.${scriptName}.${target}`,);
}

/**
 * Compiles a single script for a specific target.
 * @param scriptPath - path to the TypeScript file.
 * @param target - compilation target.
 * @param packageRoot - root directory of the package.
 * @returns promise that resolves when compilation is complete.
 */
async function compileScript(scriptPath: string, target: string,
  packageRoot: string,): Promise<void>
{
  const { prefix, scriptName, } = extractScriptInfo(scriptPath,);
  const outputPath = getOutputPath(prefix, scriptName, target, packageRoot,);

  // Ensure output directory exists
  await mkdir(dirname(outputPath,), { recursive: true, },);

  console.log(`Compiling ${basename(scriptPath,)} for ${target}...`,);

  try {
    await spawn('bun', [
      'build',
      scriptPath,
      '--compile',
      `--target=${target}`,
      `--outfile=${outputPath}`,
    ], { stdio: 'ignore', },);

    console.log(`✓ Compiled ${basename(scriptPath,)} for ${target}`,);
  }
  catch (error: any) {
    throw new Error(
      `✗ Failed to compile ${basename(scriptPath,)} for ${target}: ${
        serializeError(error,)
      }`,
    );
  }
}

//endregion Helper functions

//region Main execution -- Script entry point and parallel compilation

// Get the package root directory
const packageRoot = await getPackageRoot();

// Find all scripts with supported prefixes in the src directory
const srcDir = join(packageRoot, 'src',);
const globPatterns = SUPPORTED_PREFIXES.map(prefix => `${prefix}.*.ts`);
const scriptPaths = await glob(globPatterns, {
  cwd: srcDir,
  ignore: ['**/*.test.ts',],
},);

console.log(`Found ${scriptPaths.length} script(s) to compile:`,);
scriptPaths.forEach(script => {
  console.log(`  - ${basename(script,)}`,);
},);
console.log('',);

// Create all compilation tasks
const compilationTasks = scriptPaths.flatMap(scriptPath =>
  targets.map(target => compileScript(join(srcDir, scriptPath,), target, packageRoot,))
);

console.log(`Starting compilation of ${compilationTasks.length} targets...\n`,);

// Run all compilations in parallel
const results = await Promise.allSettled(compilationTasks,);

// Report results
const successful = results.filter(r => r.status === 'fulfilled').length;
const failed = results.filter(r => r.status === 'rejected').length;

console.log('\n=== Compilation Summary ===',);
console.log(`Total: ${results.length}`,);
console.log(`Successful: ${successful}`,);
console.log(`Failed: ${failed}`,);

if (failed > 0)
  throw new Error(`${failed} compilation(s) failed. See errors above.`,);

console.log('\nAll compilations completed successfully!',);

//endregion Main execution
