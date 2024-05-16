// TODO: Make this into a dedicated package.

import { getLogger } from '@logtape/logtape';
import { path } from '@monochromatic.dev/module-fs-path';
import pm from '@monochromatic.dev/module-pm';
import { Buffer } from 'node:buffer';
import {
  exec,
  type ExecOptions,
} from 'node:child_process';
import type { ObjectEncodingOptions } from 'node:fs';
import { promisify } from 'node:util';
const l = getLogger(['app', 'child']);

const execP = promisify(exec);

const peMap = new Map([['bun', 'bun run '], ['npm', 'npm exec -- '], ['pnpm', 'pnpm exec '], [
  'yarn',
  'yarn run -T -B ',
]]);

const myExecP = async (processedCommand: string, defaultedOptions: Parameters<typeof execP>[1]) => {
  const result: Awaited<ReturnType<typeof execP>> = Object.fromEntries(
    Object.entries(await execP(processedCommand, defaultedOptions)).map((
      [stdwhat, stdcontent],
    ) => [stdwhat, Buffer.isBuffer(stdcontent) ? stdcontent : stdcontent.trim()]),
  ) as Awaited<ReturnType<typeof execP>>;

  return {
    ...result,
    stdoe: Buffer.isBuffer(result.stdout)
      ? Buffer.isBuffer(result.stderr) ? Buffer.concat([result.stdout, result.stderr]) : result.stdout
      : Buffer.isBuffer(result.stderr)
      ? result.stdout
      : `${result.stdout}\n${result.stderr}`.trim(),
  };
};

const commandExists = async (command: string): Promise<boolean> => {
  try {
    await execP(`command -v ${command}`);
    return true;
  } catch {}
  l.warn`command ${command} doesn't exist`;
  return false;
};

export default async function $(...args: Parameters<typeof execP>) {
  const command = args[0];
  const passedOptions: ObjectEncodingOptions & ExecOptions = arguments.length === 1
    ? {}
    : args[1] || {};
  const defaultedOptions = {
    ...passedOptions,
    timeout: passedOptions?.timeout ?? 5000,
    windowsHide: passedOptions?.windowsHide ?? true,
    shell: passedOptions?.shell || '/usr/bin/bash',
  };
  if (await commandExists(command)) {
    return await myExecP(command, defaultedOptions);
  }
  l.info`trying \${pe} ${command}`;

  const { packageManager } = await pm(passedOptions?.cwd ? path.resolve(String(passedOptions.cwd)) : path.resolve());

  return await myExecP(`${peMap.get(packageManager)} ${command}`, defaultedOptions);
}

// TODO: Actually migrate to this.

export const js = JSON.stringify;
