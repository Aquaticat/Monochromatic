/**
 * Creates a performance benchmark fixture at /tmp/file-enforcer-perf/
 * with ~240 files across 20 simulated packages, including 6-level deep
 * directory nesting for testing glob traversal performance.
 *
 * Files are small (100-3000 bytes each) -- no large file testing since
 * managing files over 1MB is considered a user error for file-enforcer.
 */

import {
  mkdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

/** Root directory for all fixture files, respects $TMPDIR for sandbox compatibility */
const FIXTURE_DIR = join(tmpdir(), 'file-enforcer-perf');

/** Number of simulated packages to create */
const PACKAGE_COUNT = 20;

/** Lines per documentation file (~3KB each at 100 lines) */
const LINES_PER_DOC = 100;

/** Lines per TypeScript source file (~2KB each at 50 lines) */
const LINES_PER_TS = 50;

/** Document file basenames inside each package's docs/ directory */
const DOC_NAMES = ['readme', 'guide', 'api', 'changelog', 'contributing'] as const;

/** TypeScript file basenames inside each package's lib/ directory */
const LIB_NAMES = ['index', 'utils', 'helpers'] as const;

/**
 * Generates deterministic documentation content for a package.
 * First line is shared across all packages (for dedup testing).
 * @param pkgIndex - Package index (0-19)
 * @param docName - Document basename
 * @returns Multi-line markdown content
 */
function generateDocContent(pkgIndex: number, docName: string): string {
  /** Shared header enables meaningful dedup testing across packages */
  const sharedHeader = '# Package Documentation\n\nThis is shared boilerplate across all packages.';
  const uniqueLines = Array.from(
    { length: LINES_PER_DOC - 2 },
    (_, lineIndex) =>
      `Line ${String(lineIndex)} of ${docName} in package-${String(pkgIndex).padStart(2, '0')}`,
  );
  return `${sharedHeader}\n${uniqueLines.join('\n')}`;
}

/**
 * Generates deterministic TypeScript source content.
 * @param pkgIndex - Package index (0-19)
 * @param fileName - Source file basename
 * @returns Multi-line TypeScript content
 */
function generateTsContent(pkgIndex: number, fileName: string): string {
  return Array.from(
    { length: LINES_PER_TS },
    (_, lineIndex) =>
      `export const pkg${String(pkgIndex).padStart(2, '0')}_${fileName}_line${String(lineIndex)} = ${String(lineIndex)};`,
  ).join('\n');
}

/**
 * Generates a settings.json with nested structure for getProperty testing.
 * @param pkgIndex - Package index (0-19)
 * @returns Formatted JSON string (~500 bytes)
 */
function generateSettingsJson(pkgIndex: number): string {
  /** Feature count per package, enough to test array extraction */
  const FEATURES_PER_PACKAGE = 10;
  /** Dependency count per package */
  const DEPS_PER_PACKAGE = 5;

  return JSON.stringify(
    {
      name: `package-${String(pkgIndex).padStart(2, '0')}`,
      version: '1.0.0',
      config: {
        debug: pkgIndex % 2 === 0,
        timeout: 1000 + pkgIndex * 100,
        features: Array.from(
          { length: FEATURES_PER_PACKAGE },
          (_, featureIndex) => `feature-${String(featureIndex)}`,
        ),
      },
      dependencies: Object.fromEntries(
        Array.from(
          { length: DEPS_PER_PACKAGE },
          (_, depIndex) => [`dep-${String(depIndex)}`, `^${String(depIndex + 1)}.0.0`],
        ),
      ),
    },
    null,
    2,
  );
}

/**
 * Creates all files for a single simulated package.
 * @param pkgIndex - Package index (0-19)
 */
async function createPackage(pkgIndex: number): Promise<void> {
  const pkgName = `pkg-${String(pkgIndex).padStart(2, '0')}`;
  const pkgDir = join(FIXTURE_DIR, 'src', pkgName);

  // Create directory structure including 6-level deep nesting
  await Promise.all([
    mkdir(join(pkgDir, 'config'), { recursive: true }),
    mkdir(join(pkgDir, 'docs'), { recursive: true }),
    mkdir(join(pkgDir, 'lib', 'deep', 'nested', 'very', 'deep'), { recursive: true }),
    mkdir(join(pkgDir, 'types'), { recursive: true }),
  ]);

  // Write all files for this package in parallel
  await Promise.all([
    writeFile(join(pkgDir, 'config', 'settings.json'), generateSettingsJson(pkgIndex)),
    ...DOC_NAMES.map((docName) =>
      writeFile(join(pkgDir, 'docs', `${docName}.md`), generateDocContent(pkgIndex, docName)),
    ),
    ...LIB_NAMES.map((libName) =>
      writeFile(join(pkgDir, 'lib', `${libName}.ts`), generateTsContent(pkgIndex, libName)),
    ),
    writeFile(
      join(pkgDir, 'lib', 'deep', 'nested', 'very', 'deep', 'module.ts'),
      generateTsContent(pkgIndex, 'deep-module'),
    ),
    writeFile(
      join(pkgDir, 'types', 'index.d.ts'),
      `export type Pkg${String(pkgIndex).padStart(2, '0')}Config = { readonly name: string; };`,
    ),
    writeFile(
      join(pkgDir, 'types', 'models.d.ts'),
      `export type Pkg${String(pkgIndex).padStart(2, '0')}Model = { readonly id: number; };`,
    ),
  ]);
}

// Clean any previous fixture
await rm(FIXTURE_DIR, { recursive: true, force: true });

// Create all packages in parallel
await Promise.all(
  Array.from({ length: PACKAGE_COUNT }, (_, index) => createPackage(index)),
);

// Create empty dest directory
await mkdir(join(FIXTURE_DIR, 'dest'), { recursive: true });

/** Total files: 20 packages * (1 json + 5 md + 3 ts + 1 deep ts + 2 d.ts) = 240 */
const TOTAL_FILES = PACKAGE_COUNT * (1 + DOC_NAMES.length + LIB_NAMES.length + 1 + 2);
console.log(`[perf-fixture] created ${String(TOTAL_FILES)} files across ${String(PACKAGE_COUNT)} packages at ${FIXTURE_DIR}`);
