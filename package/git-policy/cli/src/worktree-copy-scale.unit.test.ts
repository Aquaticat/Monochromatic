/**
 Worktree-copy cost at scale:
 the bytes one creation writes grow with the copied entry count,
 not with its square.

 @module
 */
import {
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { pathToFileURL, } from 'node:url';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';
import {
  commitPaths,
  copySummaryLines,
  createTempDirectory,
  initializeRepository,
  WRAPPER_PATH,
} from './worktree-copy-fixture.unit.test.ts';

/**
 Ignored package directories in the fixture tree.
 */
const PACKAGE_COUNT = 60;

/**
 Files in each ignored package directory.
 */
const FILES_PER_PACKAGE = 38;

/**
 Bytes in one mebibyte.
 */
const MEBIBYTE = 1_024 * 1_024;

/**
 Write budget for the whole creation.
 A copy that rewrote its whole journal for every entry wrote about 900 MiB for this tree.
 */
const WRITE_BUDGET_BYTES = 16 * MEBIBYTE;

/**
 Preload that records the wrapper process's own write counters when it exits.
 */
const IO_PRELOAD_SOURCE = [
  'import { readFileSync, writeFileSync } from "node:fs";',
  'process.on("exit", () => { writeFileSync(process.env.CLI_GIT_TEST_IO_REPORT, readFileSync("/proc/self/io", "utf8")); });',
].join('\n',);

/**
 Reads one named counter from `/proc/<pid>/io` text.

 @param report - counters text

 @param name - counter name

 @returns counter value

 @throws {@link Error} when the counter is absent

 @example
 ```ts
 ioCounter({ report: 'wchar: 12\n', name: 'wchar' });
 // => 12
 ```
 */
function ioCounter({
  report,
  name,
}: Readonly<{
  report: string;
  name: string;
}>,): number {
  /**
   Matching counter line.
   */
  const line = report.split('\n',).find(function namedLine(candidate,): boolean {
    return candidate.startsWith(`${name}: `,);
  },);
  if (line === undefined)
    throw new Error(`Missing ${name} in /proc/self/io report.`,);
  return Number(line.slice(name.length + 2,),);
}

await describe({
  name: 'worktree-copy cost at scale',
  concurrency: 1,
  children: [
    it({
      name: 'a creation copying thousands of ignored entries writes a budget linear in the entry count',
      skip: process.platform === 'linux' ? false : 'reads /proc/self/io',
      fn: async function testLinearWrites(): Promise<void> {
        await using fixture = await createTempDirectory();
        /** Linked source worktree. */
        const repositoryRoot = join(fixture.path, 'repository',);
        await initializeRepository(repositoryRoot,);
        await writeFile(join(repositoryRoot, '.gitignore',), 'node_modules/\n',);
        await commitPaths({ repositoryRoot, message: 'ignore dependencies', paths: ['.gitignore',], },);
        await Promise.all(Array.from({ length: PACKAGE_COUNT, }, async function writePackage(_unused, index,): Promise<void> {
          /** Package directory. */
          const directory = join(repositoryRoot, 'node_modules', `package-${String(index,)}`, 'lib',);
          await mkdir(directory, { recursive: true, },);
          await Promise.all(Array.from({ length: FILES_PER_PACKAGE, }, function writeModule(_file, fileIndex,): Promise<void> {
            return writeFile(join(directory, `module-${String(fileIndex,)}.js`,), `export default ${String(fileIndex,)};\n`,);
          },),);
        },),);
        /** Preload module. */
        const preload = join(fixture.path, 'io-preload.mjs',);
        await writeFile(preload, IO_PRELOAD_SOURCE,);
        /** Counters written at wrapper exit. */
        const report = join(fixture.path, 'io-report.txt',);
        /** Destination worktree. */
        const destinationRoot = join(fixture.path, 'scale-topic',);

        /** Wrapped creation. */
        const result = await nanoSpawn(
          process.execPath,
          ['--import', pathToFileURL(preload,).href, WRAPPER_PATH, 'worktree', 'add', '-b', 'scale-topic', destinationRoot,],
          { cwd: repositoryRoot, env: { CLI_GIT_TEST_IO_REPORT: report, }, },
        );

        expect(copySummaryLines(result.stderr,),).toHaveLength(1,);
        expect(await readFile(join(destinationRoot, 'node_modules', 'package-7', 'lib', 'module-9.js',), 'utf8',),).toBe('export default 9;\n',);
        expect(ioCounter({ report: await readFile(report, 'utf8',), name: 'wchar', },),).toBeLessThan(WRITE_BUDGET_BYTES,);
      },
    },),
  ],
},);
