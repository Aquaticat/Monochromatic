import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import { rm, } from 'node:fs/promises';
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
const outcome = await requestExternalAnswer({
  cwd: process.cwd(),
  registry: createRequestRegistry(),
  editorCommand,
  resolveTerminalEntryId: async () => 'fixture',
  launch: async ({ command, },) => {
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

//endregion Isolated running consumer
