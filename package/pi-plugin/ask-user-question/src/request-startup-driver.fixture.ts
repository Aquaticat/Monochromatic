import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  rm,
  stat,
} from 'node:fs/promises';
import { dirname, } from 'node:path';

//region Isolated running consumer

// This file runs only after being copied beside disposable built artifacts.
const bundleUrl = new URL('./index.mjs', import.meta.url,);
const { createRequestRegistry, requestExternalAnswer, }: typeof import('../dist/final/node/index.mjs') =
  await import(bundleUrl.href);
const scenario = process.argv.at(-1,);
const originalRuntime = process.execPath;
const editorCommand = [
  originalRuntime,
  '--input-type=module',
  '--eval',
  'import {writeFile} from "node:fs/promises"; await writeFile(process.argv.at(-1), "first\\nsecond\\n");',
];
if (scenario === 'runtime-removed') {
  if (dirname(originalRuntime,) !== process.cwd())
    throw new Error('Refusing to remove runtime outside disposable fixture.',);
  await rm(originalRuntime,);
  // Editor also needs the same still-running executable after its path is removed.
  editorCommand[0] = `/proc/${String(process.pid,)}/exe`;
}
if (scenario === 'helper-missing-before-launch')
  await rm(new URL('./answer-helper.mjs', import.meta.url,),);
try {
const outcome = await requestExternalAnswer({
  cwd: process.cwd(),
  registry: createRequestRegistry(),
  editorCommand,
  resolveTerminalEntryId: async () => 'fixture',
  launch: async ({ command, },) => {
    if (scenario === 'helper-missing-before-launch')
      throw new Error('Opened terminal despite missing helper bundle.',);
    const helperPath = command[1];
    const requestPath = command.at(-1,);
    if ((helperPath === undefined) || (requestPath === undefined))
      throw new Error('Missing private helper or request path.',);
    if (dirname(helperPath,) !== dirname(requestPath,))
      throw new Error('Helper launch still depends on installed bundle path.',);
    if ((process.platform !== 'win32') && (((await stat(helperPath,)).mode & 0o777) !== 0o600))
      throw new Error('Private helper is not restricted to its owner.',);
    if (scenario === 'helper-removed-after-launch')
      await rm(new URL('./answer-helper.mjs', import.meta.url,),);
    const [executable, ...args] = command;
    if (executable === undefined)
      throw new Error('Fixture received empty helper command.',);
    const child = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe',], },);
    const output = { stderr: '', };
    child.stdout.resume();
    child.stderr.setEncoding('utf8',);
    child.stderr.on('data', function captureError(chunk: string,): void {
      output.stderr += chunk;
    },);
    const [code,] = await once(child, 'close',);
    if (code !== 0)
      throw new Error(`Detached helper exited ${String(code,)}:\n${output.stderr}`,);
    if (output.stderr !== '')
      throw new Error(`Detached helper wrote unexpected stderr:\n${output.stderr}`,);
  },
},);
if ((outcome.status !== 'answered') || (outcome.answer !== 'first\nsecond'))
  throw new Error(`Unexpected answer: ${JSON.stringify(outcome,)}`,);
console.log(`verified ${String(scenario,)}`,);
}
catch (error: unknown) {
  if ((scenario !== 'helper-missing-before-launch') || !(error instanceof Error)
    || (error.name !== 'AnswerLaunchError') || !error.message.includes('answer-helper.mjs'))
    throw error;
  console.log(`verified ${scenario}`,);
}

//endregion Isolated running consumer
