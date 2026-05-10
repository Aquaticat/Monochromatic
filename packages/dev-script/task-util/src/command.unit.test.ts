import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import { exec, } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, } from 'node:path';
import { promisify, } from 'node:util';

const execAsync = promisify(exec,);

const createTestScript = () => `
const arg = process.argv[2];
if (arg === 'fail') {
  console.error('Error: Test failure');
  process.exit(1);
} else if (arg === 'fail-with-code') {
  process.exit(parseInt(process.argv[3]) || 2);
} else if (arg === 'output') {
  console.log('stdout output');
  console.error('stderr output');
} else {
  console.log('Success');
}
`;

//region Fixture Setup: per-test fixtures

function setup() {
  const testFileDir = import.meta.dirname;
  const cliPath = join(testFileDir, 'command.ts',);

  const packageDir = join(testFileDir, '..',);
  const timestamp = Date.now();
  const randomId = Math.random().toString(36,).slice(2, 8,);
  const testDir = join(packageDir, 'dist', 'temp', 'test',
    `cli-command-${timestamp}-${randomId}`,);

  if (!existsSync(testDir,))
    mkdirSync(testDir, { recursive: true, },);

  const testScript = join(testDir, 'test-script.js',);
  writeFileSync(testScript, createTestScript(),);

  return { cliPath, testDir, testScript, };
}

function teardown({ testScript, testDir, }: { testScript: string; testDir: string; },) {
  if (existsSync(testScript,))
    unlinkSync(testScript,);

  if (existsSync(testDir,))
    rmSync(testDir, { recursive: true, },);
}

//endregion Fixture Setup

await describe({
  name: 'task-command',
  children: [
    it({
      name: 'executes command successfully with exit code 0',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, testScript, } = fixtures;

        const { stdout, stderr, } = await execAsync(
          `bun ${cliPath} -- node ${testScript} success`,
        );

        expect(stdout,).toContain('Success',);
        expect(stderr,).toBe('',);

        teardown(fixtures,);
      },
    },),
    it({
      name: 'executes command and propagates failure exit code',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, testScript, } = fixtures;

        await expect(execAsync(`bun ${cliPath} -- node ${testScript} fail`,),)
          .rejects
          .toThrow();

        try {
          await execAsync(`bun ${cliPath} -- node ${testScript} fail`,);
        }
        catch (error: unknown) {
          const execError = error as { code: number; stderr: string; };
          expect(execError.code,).toBe(1,);
          expect(execError.stderr,).toContain('Error: Test failure',);
        }

        teardown(fixtures,);
      },
    },),
    it({
      name: 'executes command with --allowFailure flag and exits with 0',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, testScript, } = fixtures;

        const { stdout, stderr, } = await execAsync(
          `bun ${cliPath} --allowFailure -- node ${testScript} fail`,
        );

        expect(stderr,).toContain('Error: Test failure',);
        // Command should succeed despite the script failing

        teardown(fixtures,);
      },
    },),
    it({
      name: 'uses short flag -a for allowFailure',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, testScript, } = fixtures;

        const { stdout, stderr, } = await execAsync(
          `bun ${cliPath} -a -- node ${testScript} fail`,
        );

        expect(stderr,).toContain('Error: Test failure',);
        // Command should succeed despite the script failing

        teardown(fixtures,);
      },
    },),
    it({
      name: 'preserves stdout and stderr output',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, testScript, } = fixtures;

        const { stdout, stderr, } = await execAsync(
          `bun ${cliPath} -- node ${testScript} output`,
        );

        expect(stdout,).toContain('stdout output',);
        expect(stderr,).toContain('stderr output',);

        teardown(fixtures,);
      },
    },),
    it({
      name: 'passes multiple arguments to the command',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, } = fixtures;

        const { stdout, } = await execAsync(
          `bun ${cliPath} -- echo "arg1" "arg2" "arg3"`,
        );

        expect(stdout,).toContain('arg1 arg2 arg3',);

        teardown(fixtures,);
      },
    },),
    it({
      name: 'executes shell commands with --shell flag',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, } = fixtures;

        const { stdout, } = await execAsync(
          `bun ${cliPath} --shell -- "echo hello && echo world"`,
        );

        expect(stdout,).toContain('hello',);
        expect(stdout,).toContain('world',);

        teardown(fixtures,);
      },
    },),
    it({
      name: 'uses short flag -s for shell',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, } = fixtures;

        const { stdout, } = await execAsync(`bun ${cliPath} -s -- "echo test"`,);

        expect(stdout,).toContain('test',);

        teardown(fixtures,);
      },
    },),
    it({
      name: 'fails when no command is specified',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, } = fixtures;

        try {
          await execAsync(`bun ${cliPath}`,);
          // Should not reach here
          expect(true,).toBe(false,);
        }
        catch (error: unknown) {
          const execError = error as { code: number; };
          expect(execError.code,).toBeGreaterThan(0,);
        }

        teardown(fixtures,);
      },
    },),
    it({
      name: 'fails when only -- is provided without command',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, } = fixtures;

        try {
          await execAsync(`bun ${cliPath} --`,);
          // Should not reach here
          expect(true,).toBe(false,);
        }
        catch (error: unknown) {
          const execError = error as { code: number; };
          expect(execError.code,).toBeGreaterThan(0,);
        }

        teardown(fixtures,);
      },
    },),
    it({
      name: 'propagates custom exit codes',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, testScript, } = fixtures;

        try {
          await execAsync(`bun ${cliPath} -- node ${testScript} fail-with-code 42`,);
        }
        catch (error: unknown) {
          const execError = error as { code: number; };
          expect(execError.code,).toBe(42,);
        }

        teardown(fixtures,);
      },
    },),
    it({
      name: 'handles non-existent command',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, } = fixtures;

        try {
          await execAsync(`bun ${cliPath} -- nonexistentcommand123`,);
          // Should not reach here
          expect(true,).toBe(false,);
        }
        catch (error: unknown) {
          const execError = error as { code: number; };
          expect(execError.code,).toBeGreaterThan(0,);
        }

        teardown(fixtures,);
      },
    },),
    it({
      name: 'handles non-existent command with allowFailure',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, } = fixtures;

        // Should not throw with allowFailure
        const result = await execAsync(
          `bun ${cliPath} --allowFailure -- nonexistentcommand123`,
        );
        // Command succeeds even though the subcommand doesn't exist

        teardown(fixtures,);
      },
    },),
    it({
      name: 'executes commands with special characters',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, } = fixtures;

        const { stdout, } = await execAsync(`bun ${cliPath} -- echo "Hello $USER!"`,);

        expect(stdout,).toContain('Hello',);
        expect(stdout,).toContain('!',);

        teardown(fixtures,);
      },
    },),
    it({
      name: 'handles command termination by signal',
      skip: process.platform === 'win32',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, testDir, } = fixtures;

        // Create a script that sleeps and can be killed
        const sleepScript = join(testDir, 'sleep-script.js',);
        writeFileSync(sleepScript, `
      process.on('SIGTERM', () => {
        console.log('Received SIGTERM');
        process.exit(0);
      });
      setTimeout(() => {}, 10000); // Sleep for 10 seconds
    `,);

        // Start the command in background and kill it
        const childProcess = exec(`bun ${cliPath} -- node ${sleepScript}`,);

        // Give it time to start
        // oxlint-disable-next-line eslint/no-promise-executor-return -- test delay
        await new Promise(resolve => setTimeout(resolve, 100,));

        // Kill the process
        if (childProcess.pid !== undefined && childProcess.pid !== 0)
          process.kill(childProcess.pid, 'SIGTERM',);

        // Wait for the process to finish
        await new Promise((resolve, reject,) => {
          childProcess.on('exit', resolve,);
          childProcess.on('error', reject,);
        },);

        // Clean up
        if (existsSync(sleepScript,))
          unlinkSync(sleepScript,);

        teardown(fixtures,);
      },
    },),
    it({
      name: 'combines multiple flags',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, } = fixtures;

        const { stdout, } = await execAsync(
          `bun ${cliPath} -a -s -- "echo combined && exit 1"`,
        );

        expect(stdout,).toContain('combined',);
        // Should succeed despite exit 1 due to allowFailure

        teardown(fixtures,);
      },
    },),
    it({
      name: 'executes command with timeout',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, testScript, } = fixtures;

        const { stdout, } = await execAsync(
          `bun ${cliPath} --timeout 5000 -- node ${testScript} success`,
        );

        expect(stdout,).toContain('Success',);

        teardown(fixtures,);
      },
    },),
    it({
      name: 'uses short flag -t for timeout',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, testScript, } = fixtures;

        const { stdout, } = await execAsync(
          `bun ${cliPath} -t 5000 -- node ${testScript} success`,
        );

        expect(stdout,).toContain('Success',);

        teardown(fixtures,);
      },
    },),
    it({
      name: 'timeout terminates long-running command',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, testDir, } = fixtures;

        // Create a script that runs longer than timeout
        const longScript = join(testDir, 'long-script.js',);
        writeFileSync(longScript, `
      console.log('Starting long task');
      setTimeout(() => {
        console.log('This should not print');
      }, 2000);
    `,);

        await expect(
          execAsync(`bun ${cliPath} --timeout 500 -- node ${longScript}`,),
        )
          .rejects
          .toThrow();

        // Clean up
        if (existsSync(longScript,))
          unlinkSync(longScript,);

        teardown(fixtures,);
      },
    },),
    it({
      name: 'timeout with allowFailure exits with 0',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, testDir, } = fixtures;

        // Create a script that runs longer than timeout
        const longScript = join(testDir, 'long-script-allow.js',);
        writeFileSync(longScript, `
      console.log('Starting long task');
      setTimeout(() => {
        console.log('This should not print');
      }, 2000);
    `,);

        const { stdout, } = await execAsync(
          `bun ${cliPath} --allowFailure --timeout 500 -- node ${longScript}`,
        );

        expect(stdout,).toContain('Starting long task',);

        // Clean up
        if (existsSync(longScript,))
          unlinkSync(longScript,);

        teardown(fixtures,);
      },
    },),
    it({
      name: 'command without timeout runs to completion',
      fn: async () => {
        const fixtures = setup();
        const { cliPath, testDir, } = fixtures;

        // Create a script that takes some time but completes
        const timedScript = join(testDir, 'timed-script.js',);
        writeFileSync(timedScript, `
      console.log('Start');
      setTimeout(() => {
        console.log('End');
        process.exit(0);
      }, 100);
    `,);

        const { stdout, } = await execAsync(
          `bun ${cliPath} -- node ${timedScript}`,
        );

        expect(stdout,).toContain('Start',);
        expect(stdout,).toContain('End',);

        // Clean up
        if (existsSync(timedScript,))
          unlinkSync(timedScript,);

        teardown(fixtures,);
      },
    },),
  ],
},);
