import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  copyFile,
  mkdir,
  mkdtemp,
  rm,
  symlink,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { fileURLToPath, } from 'node:url';

//region Disposable consumer

/**
 Runs copied extension and helper artifacts without modifying installed files.

 @param scenario - startup dependency removed by fixture driver

 @returns consumer stdout after successful verification
 */
export async function runStartupFixture(scenario: string,): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ask-startup-fixture-',),);
  try {
    const bundleDirectory = join(directory, 'bundle with spaces',);
    await mkdir(bundleDirectory,);
    await symlink(
      fileURLToPath(new URL('../node_modules', import.meta.url,),),
      join(directory, 'node_modules',),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await Promise.all(['index.mjs', 'answer-helper.mjs',].map(async function copyArtifact(filename,) {
      await copyFile(
        new URL(`../dist/final/node/${filename}`, import.meta.url,),
        join(bundleDirectory, filename,),
      );
    },),);
    const driver = join(bundleDirectory, 'driver.ts',);
    await copyFile(new URL('./request-startup-driver.fixture.ts', import.meta.url,), driver,);
    const runtime = scenario === 'runtime-removed'
      ? join(directory, 'node',)
      : process.execPath;
    if (scenario === 'runtime-removed')
      await copyFile(process.execPath, runtime,);
    const child = spawn(runtime, [driver, scenario,], {
      cwd: directory,
      stdio: ['ignore', 'pipe', 'pipe',],
    },);
    const output = { stdout: '', stderr: '', };
    child.stdout.setEncoding('utf8',);
    child.stderr.setEncoding('utf8',);
    child.stdout.on('data', function captureOutput(chunk: string,): void {
      output.stdout += chunk;
    },);
    child.stderr.on('data', function captureError(chunk: string,): void {
      output.stderr += chunk;
    },);
    const [code,] = await once(child, 'close',);
    if (code !== 0)
      throw new Error(`Startup fixture ${scenario} exited ${String(code,)}:\n${output.stderr}`,);
    if (output.stderr !== '')
      throw new Error(`Startup fixture ${scenario} wrote unexpected stderr:\n${output.stderr}`,);
    return output.stdout;
  }
  finally {
    await rm(directory, { recursive: true, force: true, },);
  }
}

//endregion Disposable consumer
