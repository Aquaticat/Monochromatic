/** Disposable CLI fixtures exercise the built native hook, including shell syntax boundaries. */
import { spawnSync, } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, } from 'node:fs';
import { homedir, } from 'node:os';
import { join, } from 'node:path';
import { fileURLToPath, } from 'node:url';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';

//region Disposable controls and native executable

/** Actual release artifact consumed by the configured hook. */
const binary = fileURLToPath(new URL('../target/release/codex-worker-limit', import.meta.url,),);
/** Existing private scratch owner keeps fixtures outside real application state. */
const scratch = join(homedir(), 'temp', 'agent',);
mkdirSync(scratch, { recursive: true, mode: 0o700, },);

/** Create independent kernel-shaped files, including shell-sensitive path characters. */
function fixture(): string {
  const parent = mkdtempSync(join(scratch, "codex-worker-'quoted'-",),);
  mkdirSync(join(parent, 'codex',),);
  for (const [name, value,] of Object.entries({
    'memory.max': '4294967296\n', 'memory.swap.max': '0\n', 'pids.max': '256\n', 'cpu.max': '200000 100000\n',
  },))
    writeFileSync(join(parent, name,), value,);
  writeFileSync(join(parent, 'codex/cgroup.procs',), '',);
  return parent;
}

/** Consume the native hook's response and validate its command field before executing it. */
function commandFromHook({ parent, command, }: { readonly parent: string; readonly command: string; },): string {
  const result = spawnSync(binary, ['--hook', parent,], {
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command, }, },),
    encoding: 'utf8',
  },);
  expect(result.status,).toBe(0,);
  expect(result.stderr,).toBe('',);
  const output: unknown = JSON.parse(result.stdout,);
  if (output === null || typeof output !== 'object' || !('hookSpecificOutput' in output)
    || output.hookSpecificOutput === null || typeof output.hookSpecificOutput !== 'object'
    || !('updatedInput' in output.hookSpecificOutput)
    || output.hookSpecificOutput.updatedInput === null || typeof output.hookSpecificOutput.updatedInput !== 'object'
    || !('command' in output.hookSpecificOutput.updatedInput)
    || typeof output.hookSpecificOutput.updatedInput.command !== 'string') {
    throw new TypeError('Native hook response omitted its command rewrite.',);
  }
  expect(output.hookSpecificOutput,).toHaveProperty('permissionDecision', 'allow',);
  return output.hookSpecificOutput.updatedInput.command;
}

//endregion Disposable controls and native executable

await describe({
  name: 'codex-worker-limit',
  concurrency: 1,
  children: [
    ...[
      '',
      "printf '%s\\n' 'quotes: \" \\ $HOME $(untouched) `untouched` ; ../'",
      "cat <<'END'\nquotes: '\" \\ $HOME $(untouched) `untouched` ; ../\nEND\n",
      "worker_value='preserved'; worker_fn() { printf '%s' \"$worker_value\"; }; worker_fn",
      "printf 'before-exit\\n'; exit 17",
    ].map(function shellBoundary(command,) {
      return it({
        name: `preserves shell source and status for ${JSON.stringify(command,)}`,
        fn: async () => {
          const parent = fixture();
          try {
            const rewritten = commandFromHook({ parent, command, },);
            expect(rewritten.endsWith(`\n${command}`,),).toBe(true,);
            const original = spawnSync('/bin/bash', ['--noprofile', '--norc', '-c', command,], { encoding: 'utf8', },);
            const actual = spawnSync('/bin/bash', ['--noprofile', '--norc', '-c', rewritten,], { encoding: 'utf8', },);
            expect(actual.status,).toBe(original.status,);
            expect(actual.stdout,).toBe(original.stdout,);
            expect(actual.stderr,).toBe(original.stderr,);
            expect(readFileSync(join(parent, 'codex/cgroup.procs',), 'utf8',),).toMatch(/^\d+$/v,);
          }
          finally {
            rmSync(parent, { recursive: true, },);
          }
        },
      },);
    },),
    it({
      name: 'attachment failure prevents the original payload after a successful positive control',
      fn: async () => {
        const parent = fixture();
        try {
          const rewritten = commandFromHook({ parent, command: "printf 'payload-executed'", },);
          const allowed = spawnSync('/bin/bash', ['-c', rewritten,], { encoding: 'utf8', },);
          expect(allowed.stdout,).toBe('payload-executed',);
          rmSync(join(parent, 'codex',), { recursive: true, },);
          const blocked = spawnSync('/bin/bash', ['-c', rewritten,], { encoding: 'utf8', },);
          expect(blocked.status,).toBe(70,);
          expect(blocked.stdout,).toBe('',);
          expect(blocked.stderr,).toContain('No such file or directory',);
        }
        finally {
          rmSync(parent, { recursive: true, },);
        }
      },
    },),
    ...[
      ['memory.max', 'max\n',], ['memory.max', '2147483648\n',],
      ['memory.swap.max', '1\n',], ['pids.max', 'max\n',],
      ['cpu.max', 'max 100000\n',], ['cpu.max', '0 100000\n',],
      ['cpu.max', '200000 0\n',], ['cpu.max', '\n',],
      ['cpu.max', '200000\n',], ['cpu.max', '200000 invalid\n',], ['cpu.max', '1 2 3\n',],
    ].map(function changedControl([name, value,],) {
      return it({
        name: `blocks unexpected ${name} value ${JSON.stringify(value,)}`,
        fn: async () => {
          const parent = fixture();
          try {
            if (name === undefined || value === undefined)
              throw new TypeError('Control fixture requires a name and value.',);
            writeFileSync(join(parent, name,), value,);
            const result = spawnSync(binary, ['--hook', parent,], {
              input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'true', }, },),
              encoding: 'utf8',
            },);
            expect(result.status,).toBe(2,);
            expect(result.stdout,).toBe('',);
            expect(result.stderr,).toContain('Codex worker limits:',);
          }
          finally {
            rmSync(parent, { recursive: true, },);
          }
        },
      },);
    },),
    ...['{', '{}', '{"hook_event_name":"PostToolUse","tool_name":"Bash"}',
      '{"hook_event_name":"PreToolUse","tool_name":"Bash"}',
      '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":5}}',
    ].map(function invalidEvent(input,) {
      return it({
        name: `blocks invalid event ${input}`,
        fn: async () => {
          const result = spawnSync(binary, ['--hook', scratch,], { input, encoding: 'utf8', },);
          expect(result.status,).toBe(2,);
          expect(result.stdout,).toBe('',);
        },
      },);
    },),
    it({
      name: 'initialization preserves existing controls and permits an explicit finite CPU increase',
      fn: async () => {
        const parent = fixture();
        try {
          rmSync(join(parent, 'codex',), { recursive: true, },);
          writeFileSync(join(parent, 'cpu.max',), '400000 100000\n',);
          const result = spawnSync(binary, ['--initialize', parent,], { encoding: 'utf8', },);
          expect(result.status,).toBe(0,);
          expect(result.stdout,).toBe('{}',);
          expect(existsSync(join(parent, 'codex',),),).toBe(true,);
          expect(readFileSync(join(parent, 'cpu.max',), 'utf8',),).toBe('400000 100000\n',);
        }
        finally {
          rmSync(parent, { recursive: true, },);
        }
      },
    },),
  ],
},);
