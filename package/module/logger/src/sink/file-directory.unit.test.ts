/** Verify configured destinations through the actual sink and default logger. @module */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, it } from '@monochromatic-dev/module-test/ts';
import { createFileSink } from './file.ts';

//region Actual filesystem and child-process boundaries retain independent destinations.
/** Node owns subprocess cancellation and completion. */
const run = promisify(execFile);
/** Create disposable workspaces without changing shared process environment or cwd. */
async function workspace() {
  const scratch = join(homedir(), 'temp', 'agent');
  await mkdir(scratch, { recursive: true, mode: 0o700 });
  await chmod(scratch, 0o700);
  const path = await mkdtemp(join(scratch, 'logger-directory-'));
  return { path, async [Symbol.asyncDispose]() { await rm(path, { recursive: true }); } };
}
/** Read the real JSONL records rather than an intercepted write callback. */
async function records(directory: string): Promise<unknown[]> {
  const result: unknown[] = [];
  for (const name of await readdir(directory)) {
    const content = await readFile(join(directory, name), 'utf8');
    for (const line of content.trim().split('\n')) result.push(JSON.parse(line));
  }
  return result;
}
/** Match ordinary serialized data without asserting any backend state. */
function hasMessage({ values, message }: Readonly<{ values: readonly unknown[]; message: string }>): boolean {
  return values.some(value => typeof value === 'object' && value !== null && 'message' in value && value.message === message);
}

await describe({ name: createFileSink, children: [
  it({ name: 'writes and verifies an explicit destination with real ordered records', fn: async function explicitDirectory() {
    await using fixture = await workspace();
    const directory = join(fixture.path, 'explicit');
    const sink = createFileSink({ directory });
    assert.equal(await sink.verify(), true);
    await sink.write({ level: 'info', timestamp: 0, message: 'first directory record' });
    await sink.write({ level: 'info', timestamp: 1, message: 'second directory record' });
    const values = await records(directory);
    assert.equal(hasMessage({ values, message: 'first directory record' }), true);
    assert.equal(hasMessage({ values, message: 'second directory record' }), true);
  } }),
  it({ name: 'default logger honors the environment destination and preserves unset ancestor discovery', fn: async function defaultDirectory() {
    await using fixture = await workspace();
    const cwd = join(fixture.path, 'project');
    await mkdir(join(cwd, 'node_modules'), { recursive: true });
    const ordinary = join(cwd, 'node_modules', '.monochromatic');
    const configured = join(fixture.path, 'configured');
    const source = `import {logger} from ${JSON.stringify(new URL('../index.ts', import.meta.url).href)}; logger.info(process.env.LOGGER_DIRECTORY_MARKER); await logger.flush();`;
    for (const contrast of [{ directory: '', marker: 'ancestor control' }, { directory: configured, marker: 'configured control' }]) {
      await run(process.execPath, ['--max-old-space-size=128', '--input-type=module', '--eval', source], {
        cwd, env: { ...process.env, HOME: fixture.path, MONOCHROMATIC_LOG_DIRECTORY: contrast.directory,
          LOGGER_DIRECTORY_MARKER: contrast.marker },
      });
    }
    assert.equal(hasMessage({ values: await records(ordinary), message: 'ancestor control' }), true);
    assert.equal(hasMessage({ values: await records(ordinary), message: 'configured control' }), false);
    assert.equal(hasMessage({ values: await records(configured), message: 'configured control' }), true);
  } }),
] });
//endregion
