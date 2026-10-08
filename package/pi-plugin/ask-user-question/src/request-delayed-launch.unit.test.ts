import { execFile, } from 'node:child_process';
import { access, } from 'node:fs/promises';
import { setTimeout as wait, } from 'node:timers/promises';
import { promisify, } from 'node:util';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';

import { createRequestRegistry, requestExternalAnswer, } from '../dist/final/node/index.mjs';

//region Detached startup regressions

/**
 Captures the real helper's complete output, including shutdown diagnostics.
 */
const execute = promisify(execFile,);

/**
 Runs the exact argv handed to the detached terminal, without shell parsing.

 @param command - runtime and arguments captured at the production launch boundary

 @returns complete stdout after a clean exit with no stderr
 */
async function runCommand(command: readonly string[],): Promise<string> {
  const [executable, ...args] = command;
  if (executable === undefined)
    throw new Error('Missing detached helper command.',);
  const output = await execute(executable, args, { timeout: 10_000, },);
  expect(output.stderr,).toBe('',);
  return output.stdout;
}

await describe({
  name: 'delayed answer terminal',
  children: [
    it({
      name: 'keeps the question answerable beyond the former startup deadline',
      timeout: 45_000,
      fn: async () => {
        const controller = new AbortController();
        const state: { command: readonly string[]; settled: boolean; } = { command: [], settled: false, };
        const outcome = requestExternalAnswer({
          cwd: process.cwd(),
          registry: createRequestRegistry(),
          signal: controller.signal,
          resolveTerminalEntryId: async () => 'fixture-terminal',
          editorCommand: [process.execPath, '--input-type=module', '--eval',
            String.raw`import {writeFile} from 'node:fs/promises'; await writeFile(process.argv.at(-1), 'delayed\nanswer\n');`,],
          launch: async ({ command, },) => {
            state.command = command;
          },
        },);
        /**
         Observe rejection immediately while the simulated desktop delays execution.
         */
        const observed = (async function observe() {
          try {
            return await outcome;
          }
          finally {
            state.settled = true;
          }
        })();
        const settled = Promise.allSettled([observed,],);
        try {
          await wait(31_000,);
          expect(state.settled,).toBe(false,);
          await runCommand(state.command,);
          expect(await outcome,).toEqual({ status: 'answered', answer: 'delayed\nanswer', },);
        }
        finally {
          controller.abort();
          await settled;
        }
      },
    },),
    ...['caller', 'session',].map(function cancellationCase(kind,) {
      return it({
        name: `late command after ${kind} cancellation exits without a missing-module crash`,
        fn: async () => {
          const registry = createRequestRegistry();
          const controller = new AbortController();
          const state: { command: readonly string[]; } = { command: [], };
          let caught: unknown;
          try {
            await requestExternalAnswer({
              cwd: process.cwd(),
              registry,
              signal: controller.signal,
              resolveTerminalEntryId: async () => 'fixture-terminal',
              editorCommand: ['must-not-start-an-editor',],
              launch: async ({ command, },) => {
                state.command = command;
                if (kind === 'caller')
                  controller.abort();
                else
                  registry.abortAll();
              },
            },);
          }
          catch (error: unknown) {
            caught = error;
          }
          expect(caught,).toBeInstanceOf(Error,);
          const requestPath = state.command.at(-1,);
          if (requestPath === undefined)
            throw new Error('Missing request path.',);
          let missing: unknown;
          try {
            await access(requestPath,);
          }
          catch (error: unknown) {
            missing = error;
          }
          expect(missing,).toHaveProperty('code', 'ENOENT',);
          expect(await runCommand(state.command,),).toContain('This question is no longer active',);
        },
      },);
    },),
  ],
},);

//endregion Detached startup regressions
