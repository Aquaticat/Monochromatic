/**
 * Tests for tool-call helper functions.
 *
 * @module
 */

import type { ToolCallEvent, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  buildApprovalFingerprint,
  serializeToolInputForJudge,
} from './tool-helpers.ts';

/** Test working directory for approval fingerprint fixtures. */
const TEST_CWD = '/repo';

/** Alternate working directory for cwd-sensitivity checks. */
const ALTERNATE_CWD = '/other-repo';

/**
 * Build mock tool-call event.
 *
 * @param toolName - tool name to place on event
 *
 * @param input - tool input to place on event
 *
 * @returns mock tool-call event
 *
 * @example
 * ```typescript
 * const event = toolCallEvent({
 *   toolName: 'read',
 *   input: { path: '/repo/.env' },
 * });
 * ```
 */
function toolCallEvent(
  {
    toolName,
    input,
  }: {
    readonly toolName: string;
    readonly input: Readonly<Record<string, unknown>>;
  },
): ToolCallEvent {
  return {
    type: 'tool_call',
    toolName,
    toolCallId: 'test-tool-call',
    input,
  } as unknown as ToolCallEvent;
}

await describe({
  name: serializeToolInputForJudge.name,
  children: [
    it({
      name: 'preserves complete write content as JSON',
      fn: async function preservesCompleteWriteContentAsJson(): Promise<void> {
        /** Write call whose full content must remain visible to judge. */
        const event = toolCallEvent({
          toolName: 'write',
          input: {
            path: '/repo/config.ts',
            content: 'export const value = "quoted";\n',
          },
        },);

        expect(serializeToolInputForJudge(event.input,),).toBe(
          '{"content":"export const value = \\"quoted\\";\\n","path":"/repo/config.ts"}',
        );
      },
    },),
    it({
      name: 'preserves every edit hunk as JSON',
      fn: async function preservesEveryEditHunkAsJson(): Promise<void> {
        /** Edit call whose old and new text must remain visible to judge. */
        const event = toolCallEvent({
          toolName: 'edit',
          input: {
            path: '/repo/config.ts',
            edits: [
              {
                oldText: 'before\n',
                newText: 'after\n',
              },
              {
                oldText: 'export const mode = "old";',
                newText: 'export const mode = "new";',
              },
            ],
          },
        },);

        expect(serializeToolInputForJudge(event.input,),).toBe(
          '{"edits":[{"newText":"after\\n","oldText":"before\\n"},{"newText":"export const mode = \\"new\\";","oldText":"export const mode = \\"old\\";"}],"path":"/repo/config.ts"}',
        );
      },
    },),
  ],
},);

await describe({
  name: buildApprovalFingerprint.name,
  children: [
    it({
      name: 'returns same fingerprint for identical tool input and cwd',
      fn: async function returnsSameFingerprintForIdenticalInput(): Promise<void> {
        /** First read event with exact input under test. */
        const firstEvent = toolCallEvent({
          toolName: 'read',
          input: { path: '/repo/.env', },
        },);
        /** Second read event with exact input under test. */
        const secondEvent = toolCallEvent({
          toolName: 'read',
          input: { path: '/repo/.env', },
        },);

        expect(buildApprovalFingerprint({ event: firstEvent, cwd: TEST_CWD, },),)
          .toBe(buildApprovalFingerprint({ event: secondEvent, cwd: TEST_CWD, },),);
      },
    },),

    it({
      name: 'returns same fingerprint when object key order changes',
      fn: async function returnsSameFingerprintWhenObjectKeyOrderChanges(): Promise<void> {
        /** Write event with path inserted before content. */
        const firstEvent = toolCallEvent({
          toolName: 'write',
          input: {
            path: '/repo/.env',
            content: 'SAFE=value',
          },
        },);
        /** Write event with content inserted before path. */
        const secondEvent = toolCallEvent({
          toolName: 'write',
          input: {
            content: 'SAFE=value',
            path: '/repo/.env',
          },
        },);

        expect(buildApprovalFingerprint({ event: firstEvent, cwd: TEST_CWD, },),)
          .toBe(buildApprovalFingerprint({ event: secondEvent, cwd: TEST_CWD, },),);
      },
    },),

    it({
      name: 'returns same read fingerprint when line range changes',
      fn: async function returnsSameReadFingerprintWhenLineRangeChanges(): Promise<void> {
        /** Read event for an approved file range. */
        const approvedEvent = toolCallEvent({
          toolName: 'read',
          input: {
            path: '/repo/large.ts',
            offset: 1,
            limit: 100,
          },
        },);
        /** Read event for another range in the same file. */
        const laterRangeEvent = toolCallEvent({
          toolName: 'read',
          input: {
            path: '/repo/large.ts',
            offset: 301,
            limit: 100,
          },
        },);

        expect(buildApprovalFingerprint({ event: approvedEvent, cwd: TEST_CWD, },),)
          .toBe(
            buildApprovalFingerprint({ event: laterRangeEvent, cwd: TEST_CWD, },),
          );
      },
    },),

    it({
      name: 'changes read fingerprint when path changes',
      fn: async function changesReadFingerprintWhenPathChanges(): Promise<void> {
        /** Read event for the approved file. */
        const approvedEvent = toolCallEvent({
          toolName: 'read',
          input: { path: '/repo/large.ts', },
        },);
        /** Read event for a different file with the same range fields. */
        const otherPathEvent = toolCallEvent({
          toolName: 'read',
          input: {
            path: '/repo/other.ts',
            offset: 1,
            limit: 100,
          },
        },);

        expect(buildApprovalFingerprint({ event: approvedEvent, cwd: TEST_CWD, },),)
          .not
          .toBe(buildApprovalFingerprint({ event: otherPathEvent, cwd: TEST_CWD, },),);
      },
    },),

    it({
      name: 'changes fingerprint when write content changes',
      fn: async function changesFingerprintWhenWriteContentChanges(): Promise<void> {
        /** Write event whose content was approved. */
        const approvedEvent = toolCallEvent({
          toolName: 'write',
          input: {
            path: '/repo/.env',
            content: 'SAFE=value',
          },
        },);
        /** Write event with same path and different content. */
        const changedEvent = toolCallEvent({
          toolName: 'write',
          input: {
            path: '/repo/.env',
            content: 'SECRET=value',
          },
        },);

        expect(buildApprovalFingerprint({ event: approvedEvent, cwd: TEST_CWD, },),)
          .not
          .toBe(buildApprovalFingerprint({ event: changedEvent, cwd: TEST_CWD, },),);
      },
    },),

    it({
      name: 'changes fingerprint when cwd changes',
      fn: async function changesFingerprintWhenCwdChanges(): Promise<void> {
        /** Relative read event whose meaning depends on current working directory. */
        const event = toolCallEvent({
          toolName: 'read',
          input: { path: '.env', },
        },);

        expect(buildApprovalFingerprint({ event, cwd: TEST_CWD, },),)
          .not
          .toBe(buildApprovalFingerprint({ event, cwd: ALTERNATE_CWD, },),);
      },
    },),
  ],
},);
