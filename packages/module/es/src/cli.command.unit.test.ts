import {
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import findUp from 'find-up';
import { exec } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {
  dirname,
  join,
} from 'node:path';
import { promisify } from 'node:util';
import {
  describe,
  expect,
  test as baseTest,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

const execAsync = promisify(exec);

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

interface CommandTestFixtures {
  cliPath: string;
  testDir: string;
  testScript: string;
}

const test = baseTest.extend<CommandTestFixtures>({
  cliPath: async ({}, use) => {
    const testFileDir = import.meta.dirname;
    const cliPath = join(testFileDir, 'cli.command.ts');
    await use(cliPath);
  },

  testDir: async ({}, use) => {
    const testFileDir = import.meta.dirname;
    const packageJsonPath = await findUp('package.json', { cwd: testFileDir });
    if (!packageJsonPath) {
      throw new Error('Could not find package.json');
    }

    const packageDir = dirname(packageJsonPath);
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const testDir = join(packageDir, 'dist', 'temp', 'test',
      `cli-command-${timestamp}-${randomId}`);

    // Create test directory
    if (!existsSync(testDir)) {
      mkdirSync(testDir, { recursive: true });
    }

    await use(testDir);

    // Clean up test directory
    if (existsSync(testDir)) {
      rmdirSync(testDir, { recursive: true });
    }
  },

  testScript: async ({ testDir }, use) => {
    const testScript = join(testDir, 'test-script.js');

    // Create test script
    writeFileSync(testScript, createTestScript());

    await use(testScript);

    // Clean up test script
    if (existsSync(testScript)) {
      unlinkSync(testScript);
    }
  },
});

describe('cli.command', () => {
  test('executes command successfully with exit code 0', async ({ cliPath, testScript }) => {
    const { stdout, stderr } = await execAsync(
      `bun ${cliPath} -- node ${testScript} success`,
    );

    expect(stdout).toContain('Success');
    expect(stderr).toBe('');
  });

  test('executes command and propagates failure exit code', async ({ cliPath, testScript }) => {
    await expect(execAsync(`bun ${cliPath} -- node ${testScript} fail`))
      .rejects
      .toThrow();

    try {
      await execAsync(`bun ${cliPath} -- node ${testScript} fail`);
    } catch (error: any) {
      expect(error.code).toBe(1);
      expect(error.stderr).toContain('Error: Test failure');
    }
  });

  test('executes command with --allowFailure flag and exits with 0', async ({ cliPath, testScript }) => {
    const { stdout, stderr } = await execAsync(
      `bun ${cliPath} --allowFailure -- node ${testScript} fail`,
    );

    expect(stderr).toContain('Error: Test failure');
    // Command should succeed despite the script failing
  });

  test('uses short flag -a for allowFailure', async ({ cliPath, testScript }) => {
    const { stdout, stderr } = await execAsync(
      `bun ${cliPath} -a -- node ${testScript} fail`,
    );

    expect(stderr).toContain('Error: Test failure');
    // Command should succeed despite the script failing
  });

  test('preserves stdout and stderr output', async ({ cliPath, testScript }) => {
    const { stdout, stderr } = await execAsync(
      `bun ${cliPath} -- node ${testScript} output`,
    );

    expect(stdout).toContain('stdout output');
    expect(stderr).toContain('stderr output');
  });

  test('passes multiple arguments to the command', async ({ cliPath }) => {
    const { stdout } = await execAsync(`bun ${cliPath} -- echo "arg1" "arg2" "arg3"`);

    expect(stdout).toContain('arg1 arg2 arg3');
  });

  test('executes shell commands with --shell flag', async ({ cliPath }) => {
    const { stdout } = await execAsync(
      `bun ${cliPath} --shell -- "echo hello && echo world"`,
    );

    expect(stdout).toContain('hello');
    expect(stdout).toContain('world');
  });

  test('uses short flag -s for shell', async ({ cliPath }) => {
    const { stdout } = await execAsync(`bun ${cliPath} -s -- "echo test"`);

    expect(stdout).toContain('test');
  });

  test('fails when no command is specified', async ({ cliPath }) => {
    await expect(execAsync(`bun ${cliPath}`)).rejects.toThrow();
  });

  test('fails when only -- is provided without command', async ({ cliPath }) => {
    await expect(execAsync(`bun ${cliPath} --`)).rejects.toThrow();
  });

  test('propagates custom exit codes', async ({ cliPath, testScript }) => {
    try {
      await execAsync(`bun ${cliPath} -- node ${testScript} fail-with-code 42`);
    } catch (error: any) {
      expect(error.code).toBe(42);
    }
  });

  test('handles non-existent command', async ({ cliPath }) => {
    await expect(execAsync(`bun ${cliPath} -- nonexistentcommand123`)).rejects.toThrow();
  });

  test('handles non-existent command with allowFailure', async ({ cliPath }) => {
    // Should not throw with allowFailure
    const result = await execAsync(
      `bun ${cliPath} --allowFailure -- nonexistentcommand123`,
    );
    // Command succeeds even though the subcommand doesn't exist
  });

  test('executes commands with special characters', async ({ cliPath }) => {
    const { stdout } = await execAsync(`bun ${cliPath} -- echo "Hello $USER!"`);

    expect(stdout).toContain('Hello');
    expect(stdout).toContain('!');
  });

  test('handles command termination by signal', { skip: process.platform === 'win32' },
    async ({ cliPath, testDir }) => {
      // Create a script that sleeps and can be killed
      const sleepScript = join(testDir, 'sleep-script.js');
      writeFileSync(sleepScript, `
      process.on('SIGTERM', () => {
        console.log('Received SIGTERM');
        process.exit(0);
      });
      setTimeout(() => {}, 10000); // Sleep for 10 seconds
    `);

      // Start the command in background and kill it
      const childProcess = exec(`bun ${cliPath} -- node ${sleepScript}`);

      // Give it time to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Kill the process
      if (childProcess.pid) {
        process.kill(childProcess.pid, 'SIGTERM');
      }

      // Wait for the process to finish
      await new Promise((resolve, reject) => {
        childProcess.on('exit', resolve);
        childProcess.on('error', reject);
      });

      // Clean up
      if (existsSync(sleepScript)) {
        unlinkSync(sleepScript);
      }
    }); // Skip on Windows as signals work differently

  test('combines multiple flags', async ({ cliPath }) => {
    const { stdout } = await execAsync(
      `bun ${cliPath} -a -s -- "echo combined && exit 1"`,
    );

    expect(stdout).toContain('combined');
    // Should succeed despite exit 1 due to allowFailure
  });
});
