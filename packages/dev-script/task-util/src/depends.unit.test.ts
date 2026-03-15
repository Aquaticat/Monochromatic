import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { exec, } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { join, } from 'node:path';
import { promisify, } from 'node:util';

const execAsync = promisify(exec,);

//region Fixture Setup -- temp directory with controllable source and output files

let cliPath: string;
let testDir: string;
let srcDir: string;
let outDir: string;

/** Marker file written by the command to prove it ran */
let markerPath: string;

beforeEach(() => {
  const testFileDir = import.meta.dirname;
  cliPath = join(testFileDir, 'depends.ts',);

  const packageDir = join(testFileDir, '..',);
  const timestamp = Date.now();
  const randomId = Math.random().toString(36,).slice(2, 8,);
  testDir = join(packageDir, 'dist', 'temp', 'test',
    `cli-depends-${timestamp}-${randomId}`,);
  srcDir = join(testDir, 'src',);
  outDir = join(testDir, 'out',);
  markerPath = join(testDir, 'ran.marker',);

  mkdirSync(srcDir, { recursive: true, },);
  mkdirSync(outDir, { recursive: true, },);
},);

afterEach(() => {
  if (existsSync(testDir,))
    rmSync(testDir, { recursive: true, },);
},);

//endregion Fixture Setup

//region Helpers

/**
 * Creates a file and optionally sets its mtime to the past.
 *
 * @param path - Absolute file path
 * @param ageMs - How many milliseconds in the past to set mtime (0 = now)
 *
 * @example
 * ```ts
 * touch(join(srcDir, 'a.ts'), 5000); // 5 seconds old
 * ```
 */
function touch(path: string, ageMs = 0,): void {
  writeFileSync(path, `file: ${path}`,);
  if (ageMs > 0) {
    const past = new Date(Date.now() - ageMs,);
    utimesSync(path, past, past,);
  }
}

/**
 * Builds the command string that writes a marker file to prove execution.
 *
 * Output is collapsed, so we verify execution via side effects (file creation)
 * rather than stdout content.
 *
 * @returns Shell command string that creates the marker file
 *
 * @example
 * ```ts
 * const cmd = writeMarkerCmd();
 * ```
 */
function writeMarkerCmd(): string {
  return `node -e "require('fs').writeFileSync('${markerPath}', 'ran')"`;
}

//endregion Helpers

describe('task-depends file-based staleness', () => {
  test('runs command when no output files exist', async () => {
    touch(join(srcDir, 'a.ts',),);

    await execAsync(
      `bun ${cliPath} -s "${srcDir}/**" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('runs command when sources are newer than outputs', async () => {
    touch(join(outDir, 'a.js',), 5_000,);
    touch(join(srcDir, 'a.ts',),);

    await execAsync(
      `bun ${cliPath} -s "${srcDir}/**" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('skips command when outputs are newer than sources', async () => {
    touch(join(srcDir, 'a.ts',), 5_000,);
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} -s "${srcDir}/**" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });

  test('verbose flag logs staleness reason', async () => {
    touch(join(srcDir, 'a.ts',),);

    const { stderr, } = await execAsync(
      `bun ${cliPath} -v -s "${srcDir}/**" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(stderr,).toContain('[task-depends]',);
    expect(stderr,).toContain('stale',);
  });

  test('verbose flag logs up-to-date message when skipping', async () => {
    touch(join(srcDir, 'a.ts',), 5_000,);
    touch(join(outDir, 'a.js',),);

    const { stderr, } = await execAsync(
      `bun ${cliPath} -v -s "${srcDir}/**" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(stderr,).toContain('fresh',);
  });

  test('accepts multiple --sources globs', async () => {
    const libDir = join(testDir, 'lib',);
    mkdirSync(libDir, { recursive: true, },);
    touch(join(srcDir, 'a.ts',),);
    touch(join(libDir, 'b.ts',),);

    await execAsync(
      `bun ${cliPath} -s "${srcDir}/**" -s "${libDir}/**" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('accepts multiple --outputs globs', async () => {
    const dist2Dir = join(testDir, 'dist2',);
    mkdirSync(dist2Dir, { recursive: true, },);
    touch(join(srcDir, 'a.ts',), 5_000,);
    touch(join(outDir, 'a.js',),);
    touch(join(dist2Dir, 'b.js',),);

    await execAsync(
      `bun ${cliPath} -s "${srcDir}/**" -o "${outDir}/**" -o "${dist2Dir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });

  test('runs when source files exist but no output files match', async () => {
    touch(join(srcDir, 'a.ts',),);

    await execAsync(
      `bun ${cliPath} -s "${srcDir}/**" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('skips when source glob matches nothing and output files exist', async () => {
    // Empty source glob → no timestamps → sourceTime = -Infinity → fresh
    // Use srcDir (exists) with a non-matching extension to avoid ENOENT on missing dirs
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} -s "${srcDir}/**/*.xyz" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });
});

describe('task-depends sh: output with Infinity/-Infinity', () => {
  test('runs command when sh: output returns -Infinity (missing)', async () => {
    await execAsync(
      `bun ${cliPath} -s "sh:echo Infinity" -o "sh:echo -Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('skips command when sh: output returns Infinity (exists)', async () => {
    await execAsync(
      `bun ${cliPath} -s "sh:echo -Infinity" -o "sh:echo Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });

  test('newest strategy hides -Infinity when mixed with Infinity', async () => {
    // With default newest: Math.max(Infinity, -Infinity) = Infinity → fresh
    await execAsync(
      `bun ${cliPath} -s "sh:echo -Infinity" -o "sh:echo Infinity" -o "sh:echo -Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });

  test('oldest strategy catches -Infinity in mixed outputs', async () => {
    // With oldest: Math.min(Infinity, -Infinity) = -Infinity → stale
    await execAsync(
      `bun ${cliPath} -s "sh:echo 0" --output-time-strategy oldest -o "sh:echo Infinity" -o "sh:echo -Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('skips when all sh: outputs return Infinity', async () => {
    await execAsync(
      `bun ${cliPath} -s "sh:echo -Infinity" -o "sh:echo Infinity" -o "sh:echo Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });

  test('verbose flag logs resolved timestamp', async () => {
    const { stderr, } = await execAsync(
      `bun ${cliPath} -v -s "sh:echo Infinity" -o "sh:echo -Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(stderr,).toContain('Infinity',);
    expect(stderr,).toContain('-Infinity',);
  });
});

describe('task-depends sh: source with Infinity/-Infinity', () => {
  test('runs when sh: source returns Infinity (dirty)', async () => {
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} -s "sh:echo Infinity" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('skips when sh: source returns -Infinity (clean)', async () => {
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} -s "sh:echo -Infinity" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });
});

describe('task-depends sh: timestamp output', () => {
  test('uses unix epoch seconds from sh: command stdout', async () => {
    // Source returns a timestamp far in the future (year 2040)
    // Output files are from now -- source is newer → stale
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} -s "sh:echo 2208988800" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('uses unix epoch milliseconds from sh: command stdout', async () => {
    // Source returns a timestamp far in the future (year 2040, in ms)
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} -s "sh:echo 2208988800000" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('uses ISO 8601 date from sh: command stdout', async () => {
    // Source returns a date far in the future
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} -s "sh:echo 2040-01-01T00:00:00Z" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('skips when sh: timestamp is older than outputs', async () => {
    // Source returns a very old timestamp (year 2000)
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} -s "sh:echo 946684800" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });

  test('uses timestamp from sh: output command', async () => {
    // Output returns a very old timestamp → older than sources → stale
    touch(join(srcDir, 'a.ts',),);

    await execAsync(
      `bun ${cliPath} -s "${srcDir}/**" -o "sh:echo 946684800" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });
});

describe('task-depends sh: command errors', () => {
  test('throws when sh: command fails with non-zero exit', async () => {
    await expect(
      execAsync(
        `bun ${cliPath} -s "sh:exit 1" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
      ),
    )
      .rejects
      .toThrow();
  });

  test('throws when sh: command returns unparseable output', async () => {
    await expect(
      execAsync(
        `bun ${cliPath} -o "sh:echo hello" -- ${writeMarkerCmd()}`,
      ),
    )
      .rejects
      .toThrow();
  });

  test('throws when sh: command returns empty output', async () => {
    await expect(
      execAsync(
        `bun ${cliPath} -o "sh:echo" -- ${writeMarkerCmd()}`,
      ),
    )
      .rejects
      .toThrow();
  });
});

describe('task-depends time strategies', () => {
  test('source-time-strategy oldest uses minimum source timestamp', async () => {
    // Two sources: one very old (epoch), one very new (now)
    // With oldest: min picks the old one → old > new output → false → fresh
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} --source-time-strategy oldest -s "sh:echo 946684800" -s "sh:echo 2208988800" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });

  test('source-time-strategy newest uses maximum source timestamp', async () => {
    // Same sources as above, but with newest: max picks the new one → new > output → stale
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} --source-time-strategy newest -s "sh:echo 946684800" -s "sh:echo 2208988800" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('output-time-strategy oldest catches missing output in mixed list', async () => {
    // File output exists (fresh) + sh: output is -Infinity (missing)
    // With oldest: min picks -Infinity → source > -Infinity → stale
    touch(join(srcDir, 'a.ts',),);
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} --output-time-strategy oldest -s "${srcDir}/**" -o "${outDir}/**" -o "sh:echo -Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('output-time-strategy newest hides missing output in mixed list', async () => {
    // Same setup but with newest: max picks the real mtime → source (old) < output → fresh
    touch(join(srcDir, 'a.ts',), 5_000,);
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} --output-time-strategy newest -s "${srcDir}/**" -o "${outDir}/**" -o "sh:echo -Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });

  test('rejects invalid strategy value', async () => {
    await expect(
      execAsync(
        `bun ${cliPath} --source-time-strategy invalid -s "${srcDir}/**" -o "${outDir}/**" -- echo test`,
      ),
    )
      .rejects
      .toThrow();
  });

  test('sh: strategy receives timestamps via stdin and returns aggregated value', async () => {
    // Custom strategy using sort -n | head -1 (minimum, like oldest)
    // Two sources: year 2000 (946684800s) and year 2040 (2208988800s)
    // Strategy receives parsed ms values, picks minimum (year 2000) → older than output → fresh
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} --source-time-strategy "sh:sort -n | head -1" -s "sh:echo 946684800" -s "sh:echo 2208988800" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });

  test('sh: strategy can use sort -rn for maximum (newest)', async () => {
    // Custom strategy using sort -rn | head -1 (maximum, like newest)
    // Max picks year 2040 → newer than output → stale
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} --source-time-strategy "sh:sort -rn | head -1" -s "sh:echo 946684800" -s "sh:echo 2208988800" -o "${outDir}/**" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('accepts sh: prefix for output-time-strategy', async () => {
    // Custom output strategy: sort -n picks minimum → -Infinity dominates → stale
    touch(join(srcDir, 'a.ts',),);

    await execAsync(
      `bun ${cliPath} --output-time-strategy "sh:sort -n | head -1" -s "${srcDir}/**" -o "sh:echo Infinity" -o "sh:echo -Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });
});

describe('task-depends no sources behavior', () => {
  test('skips when no -s flags and output returns Infinity', async () => {
    // No sources → sourceTime = -Infinity → -Infinity > Infinity → false → fresh
    await execAsync(
      `bun ${cliPath} -o "sh:echo Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });

  test('skips when no -s flags and output returns -Infinity', async () => {
    // No sources → sourceTime = -Infinity → -Infinity > -Infinity → false → fresh
    await execAsync(
      `bun ${cliPath} -o "sh:echo -Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });

  test('runs with explicit Infinity source and -Infinity output', async () => {
    // Explicit "always dirty" source pattern for gate checks
    await execAsync(
      `bun ${cliPath} -s "sh:echo Infinity" -o "sh:echo -Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });
});

describe('task-depends combined file and sh: checks', () => {
  test('runs when file sources are newer and sh: output is Infinity', async () => {
    // Source is now, output sh: returns Infinity → source_mtime > Infinity → false → fresh
    // This is correct: Infinity means "output exists and is infinitely fresh"
    touch(join(srcDir, 'a.ts',),);

    await execAsync(
      `bun ${cliPath} -s "${srcDir}/**" -o "sh:echo Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });

  test('runs when file sources are newer and sh: output returns old timestamp', async () => {
    touch(join(srcDir, 'a.ts',),);

    await execAsync(
      `bun ${cliPath} -s "${srcDir}/**" -o "sh:echo 946684800" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(true,);
  });

  test('skips when both file and sh: checks are fresh', async () => {
    touch(join(srcDir, 'a.ts',), 5_000,);
    touch(join(outDir, 'a.js',),);

    await execAsync(
      `bun ${cliPath} -s "${srcDir}/**" -o "${outDir}/**" -o "sh:echo Infinity" -- ${writeMarkerCmd()}`,
    );

    expect(existsSync(markerPath,),).toBe(false,);
  });
});

describe('task-depends output collapsing', () => {
  test('hides stdout on successful command execution', async () => {
    touch(join(srcDir, 'a.ts',),);

    const { stdout, } = await execAsync(
      `bun ${cliPath} -s "${srcDir}/**" -o "${outDir}/**" -- echo HIDDEN_OUTPUT`,
    );

    expect(stdout,).not.toContain('HIDDEN_OUTPUT',);
  });

  test('shows stdout on failed command execution', async () => {
    touch(join(srcDir, 'a.ts',),);

    try {
      await execAsync(
        `bun ${cliPath} -s "${srcDir}/**" -o "${outDir}/**" -- node -e "console.log('VISIBLE_OUTPUT'); process.exit(1)"`,
      );
      expect(true,).toBe(false,);
    }
    catch (error) {
      const execError = error as { stdout: string; stderr: string; };
      expect(execError.stdout,).toContain('VISIBLE_OUTPUT',);
    }
  });

  test('shows stderr on failed command execution', async () => {
    touch(join(srcDir, 'a.ts',),);

    try {
      await execAsync(
        `bun ${cliPath} -s "${srcDir}/**" -o "${outDir}/**" -- node -e "console.error('ERROR_OUTPUT'); process.exit(1)"`,
      );
      expect(true,).toBe(false,);
    }
    catch (error) {
      const execError = error as { stdout: string; stderr: string; };
      expect(execError.stderr,).toContain('ERROR_OUTPUT',);
    }
  });
});

describe('task-depends error handling', () => {
  test('propagates command failure exit code', async () => {
    touch(join(srcDir, 'a.ts',),);

    await expect(
      execAsync(
        `bun ${cliPath} -s "${srcDir}/**" -o "${outDir}/**" -- node -e "process.exit(42)"`,
      ),
    )
      .rejects
      .toThrow();
  });

  test('allowFailure flag suppresses command failure', async () => {
    touch(join(srcDir, 'a.ts',),);

    const result = await execAsync(
      `bun ${cliPath} -a -s "${srcDir}/**" -o "${outDir}/**" -- node -e "process.exit(1)"`,
    );

    expect(result,).toBeDefined();
  });

  test('fails when no -o provided', async () => {
    await expect(
      execAsync(`bun ${cliPath} -s "${srcDir}/**" -- echo test`,),
    )
      .rejects
      .toThrow();
  });

  test('fails when no command provided', async () => {
    await expect(
      execAsync(`bun ${cliPath} -s "${srcDir}/**" -o "${outDir}/**"`,),
    )
      .rejects
      .toThrow();
  });
});
