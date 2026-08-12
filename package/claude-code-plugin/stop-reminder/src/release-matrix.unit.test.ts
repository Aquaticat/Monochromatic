import { execFileSync, } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir, } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

/**
 * Built plugin entry this suite drives.
 *
 * Exercising the bundle rather than the handler is the point: every defect this
 * suite exists to catch was a wiring or parsing fault that the handler's own
 * unit tests passed straight through, because those tests supply the shapes the
 * parser expects instead of the shapes Claude Code actually writes.
 */
const BUNDLE = resolve(
  import.meta.dirname,
  '../bundle/node/index.mjs',
);

/**
 * Scratch directory holding one transcript per case.
 */
const SCRATCH = mkdtempSync(join(tmpdir(), 'stop-reminder-release-',),);

/**
 * Transcript line for a turn the user typed, which closes the counting window.
 */
const HUMAN = JSON.stringify({ type: 'user', origin: { kind: 'human', }, message: { content: 'go', }, },);

/**
 * Transcript line for one forced-continuation block.
 */
const BLOCK = JSON.stringify({
  type: 'user',
  message: { content: 'Stop hook feedback:\nYou are stopping while tracked work may remain.', },
},);

/**
 * Transcript line for an assistant turn that issued a tool call.
 */
const TOOL = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', },], }, },);

/**
 * Transcript line for an assistant turn that only produced prose.
 */
const TEXT = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'blocked', },], }, },);

/**
 * Builds a `TaskCreate` result line announcing a task id.
 *
 * @param id - identifier Claude Code assigned
 *
 * @returns transcript line for the creation
 *
 * @example
 * ```ts
 * created('1');
 * ```
 */
function created(id: string,): string {
  return JSON.stringify({ type: 'user', toolUseResult: { task: { id, subject: 's', }, }, },);
}

/**
 * Builds a `TaskUpdate` call line.
 *
 * @param id - identifier being updated
 *
 * @param status - status applied
 *
 * @returns transcript line for the update
 *
 * @example
 * ```ts
 * updated('1', 'completed');
 * ```
 */
function updated(id: string, status: string,): string {
  return JSON.stringify({
    type: 'assistant',
    message: { content: [{ type: 'tool_use', name: 'TaskUpdate', input: { taskId: id, status, }, },], },
  },);
}

/**
 * Runs the built hook against a crafted transcript and reports whether it blocked.
 *
 * @param name - case name, used for the transcript file
 *
 * @param lines - transcript lines, oldest first
 *
 * @param backgroundTasks - `background_tasks` for the synthetic `Stop` payload
 *
 * @returns whether the hook refused the stop
 *
 * @example
 * ```ts
 * blocksFor({ name: 'clean', lines: [HUMAN], backgroundTasks: [] });
 * ```
 */
function blocksFor(
  {
    name,
    lines,
    backgroundTasks,
  }: {
    readonly name: string;
    readonly lines: readonly string[];
    readonly backgroundTasks: readonly Record<string, string>[];
  },
): boolean {
  /**
   * Transcript path handed to the hook through the synthetic payload.
   */
  const transcript = join(SCRATCH, `${name.replaceAll(' ', '-',)}.jsonl`,);

  writeFileSync(transcript, `${lines.join('\n',)}\n`,);

  /**
   * Hook stdout, containing a block decision or the empty pass-through.
   */
  const raw = execFileSync('node', [BUNDLE,], {
    input: JSON.stringify({
      session_id: 's',
      transcript_path: transcript,
      cwd: SCRATCH,
      permission_mode: 'default',
      hook_event_name: 'Stop',
      // Set so the response-quality detectors stay out of the way and each case
      // measures the release conditions alone.
      stop_hook_active: true,
      last_assistant_message: 'Work continues.',
      background_tasks: backgroundTasks,
    },),
    encoding: 'utf8',
  },);

  return raw.includes('"block"',);
}

await describe({
  name: 'stop-reminder release conditions, against the built bundle',
  children: [
    it({
      name: 'blocks a stop when nothing is waiting and the last push did work',
      fn: async () => {
        expect(blocksFor({ name: 'clean', lines: [HUMAN, TOOL,], backgroundTasks: [], },),).toBe(true,);
      },
    },),
    it({
      name: 'keeps blocking while forced continuations keep producing work',
      fn: async () => {
        expect(blocksFor({ name: 'worked', lines: [HUMAN, BLOCK, TOOL,], backgroundTasks: [], },),).toBe(true,);
      },
    },),
    it({
      name: 'releases once a forced continuation produced no tool call',
      fn: async () => {
        expect(blocksFor({ name: 'idle', lines: [HUMAN, BLOCK, TEXT,], backgroundTasks: [], },),).toBe(false,);
      },
    },),
    it({
      name: 'releases while a background task is running',
      fn: async () => {
        expect(blocksFor({
          name: 'bg-running',
          lines: [HUMAN, TOOL,],
          backgroundTasks: [{ id: 'b1', type: 'shell', status: 'running', },],
        },),).toBe(false,);
      },
    },),
    it({
      name: 'resumes blocking once every background task has finished',
      fn: async () => {
        expect(blocksFor({
          name: 'bg-done',
          lines: [HUMAN, TOOL,],
          backgroundTasks: [{ id: 'b1', type: 'shell', status: 'completed', },],
        },),).toBe(true,);
      },
    },),
    it({
      name: 'releases when every tracked task is finished',
      fn: async () => {
        expect(blocksFor({
          name: 'tasks-done',
          lines: [HUMAN, created('1',), updated('1', 'completed',), TOOL,],
          backgroundTasks: [],
        },),).toBe(false,);
      },
    },),
    it({
      name: 'blocks while a tracked task is still in progress',
      fn: async () => {
        expect(blocksFor({
          name: 'tasks-open',
          lines: [HUMAN, created('1',), updated('1', 'in_progress',), TOOL,],
          backgroundTasks: [],
        },),).toBe(true,);
      },
    },),
  ],
},);
