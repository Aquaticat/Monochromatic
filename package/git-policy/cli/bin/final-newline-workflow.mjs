#!/usr/bin/env node
/**
 Final-newline workflow check: clones the checkout, runs the native wrapper's `final-newline` policy over the clone,
 then proves the check can fail by staging a file without a final newline and expecting the policy to refuse it.

 Usage: `node bin/final-newline-workflow.mjs <cli-git-native executable>`; the checkout is the current directory.
 The clone is disposable, so the policy never observes or changes checkout state.
 The configuration written into the clone names only the core `final-newline` policy at `error` severity,
 because a policy at a lower severity prints its finding and still exits 0.
 */
// The bin scripts sit outside the package tsconfig's include list, so type-aware lint checks them in an inferred
// program that loads no ambient Node types; this reference loads them, so `process` and `node:` imports stay typed.
/// <reference types="node" />
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';

/**
 The workflow check failed or could not run, so the final-newline policy was not proven.
 */
export class FinalNewlineWorkflowError extends Error {
  name = 'FinalNewlineWorkflowError';
}

/**
 Run one command with inherited output and return its exit status.

 @param {{ command: string, args: readonly string[], cwd: string }} request Complete argument array; no shell runs it.
 @returns {Promise<number>} Exit status; a command ended by a signal or unable to start throws instead, because no
 status exists to compare.
 @throws {FinalNewlineWorkflowError} The command could not start or ended by a signal.
 */
async function runCommand({ command, args, cwd, }) {
  const child = spawn(command, [...args,], { cwd, stdio: 'inherit', },);
  const [status, signal,] = await once(child, 'exit',);
  if (typeof status !== 'number')
    throw new FinalNewlineWorkflowError(`${command} ${args.join(' ',)} ended by signal ${String(signal,)}`,);
  return status;
}

/**
 Run the whole check against one executable.

 @param {string} executable Absolute path of the native wrapper executable.
 @returns {Promise<void>} Settles when the clean clone passes and the staged control fails.
 @throws {FinalNewlineWorkflowError} The clean clone failed the policy or the control passed it.
 */
async function main(executable) {
  const workspace = process.cwd();
  const parent = await mkdtemp(join(tmpdir(), 'cli-git-final-newline-',),);
  try {
    const scanRoot = join(parent, 'repository',);
    const clone = await runCommand({
      command: '/usr/bin/git',
      args: ['clone', '--quiet', '--local', '--no-hardlinks', workspace, scanRoot,],
      cwd: parent,
    },);
    if (clone !== 0)
      throw new FinalNewlineWorkflowError(`git clone of ${workspace} exited with ${String(clone,)}`,);
    await writeFile(
      join(scanRoot, 'cli-git.config.jsonc',),
      '{ "policies": { "final-newline": "error" } }\n',
      'utf8',
    );
    const check = ['cli-git', 'check', '--policy', 'final-newline', '--all',];
    const clean = await runCommand({ command: executable, args: check, cwd: scanRoot, },);
    if (clean !== 0)
      throw new FinalNewlineWorkflowError(`the final-newline policy exited with ${String(clean,)} over the clean clone`,);
    await writeFile(join(scanRoot, 'final-newline-control.txt',), 'no final newline', 'utf8',);
    const staged = await runCommand({
      command: '/usr/bin/git',
      args: ['add', '--', 'final-newline-control.txt',],
      cwd: scanRoot,
    },);
    if (staged !== 0)
      throw new FinalNewlineWorkflowError(`git add of the control file exited with ${String(staged,)}`,);
    const control = await runCommand({ command: executable, args: check, cwd: scanRoot, },);
    if (control === 0)
      throw new FinalNewlineWorkflowError(
        'the final-newline policy accepted a staged file without a final newline, so the check cannot fail',
      );
    console.log('final-newline workflow check passed: the clean clone passed and the staged control was refused',);
  }
  finally {
    await rm(parent, { recursive: true, force: true, },);
  }
}

const executableArgument = process.argv[2];
if (executableArgument === undefined || executableArgument.length === 0)
  throw new FinalNewlineWorkflowError('pass the path of the cli-git-native executable as the only argument',);
await main(resolve(executableArgument,),);
