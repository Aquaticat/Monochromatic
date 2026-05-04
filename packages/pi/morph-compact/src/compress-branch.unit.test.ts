/**
 * Tests for {@link compressBranch}.
 *
 * Uses sequential execution because all tests stub
 * {@link MorphCompactClient.prototype.compact} and would conflict
 * if run concurrently.
 *
 * @module
 */

import type {
  CompactionEntry,
  SessionEntry,
  SessionMessageEntry,
} from '@mariozechner/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import { MorphCompactClient, } from './morph-client.ts';
import { compressBranch, } from './compress-branch.ts';

//region Test helpers

/** Build a minimal message entry for tests. */
function makeMessageEntry(
  role: string,
  content: unknown,
  id = 'msg-1',
): SessionEntry {
  return {
    type: 'message',
    id,
    parentId: 'root',
    timestamp: new Date().toISOString(),
    message: {
      role,
      content,
      timestamp: new Date().toISOString(),
    },
  } as unknown as SessionMessageEntry;
}

/** Build a minimal compaction entry for tests. */
function makeCompactionEntry(
  summary: string,
  id = 'compact-1',
): SessionEntry {
  return {
    type: 'compaction',
    id,
    parentId: 'root',
    timestamp: new Date().toISOString(),
    summary,
    firstKeptEntryId: 'kept-1',
    tokensBefore: 50_000,
  } as CompactionEntry;
}

/** Minimal params without messages — nothing to compress. */
function emptyParams(): {
  branchEntries: SessionEntry[];
  apiKey: string;
} {
  return {
    branchEntries: [],
    apiKey: 'test-key',
  };
}

/** Simulated Morph Compact API response. */
const MOCK_COMPACT_OUTPUT = 'compressed output text';

/** Build a mock CompactResult for sinon stubs. */
function mockCompactResult(
  output: string,
): {
  id: string;
  output: string;
  messages: {
    role: string;
    content: string;
    compacted_line_ranges: {
      start: number;
      end: number;
    }[];
    kept_line_ranges: {
      start: number;
      end: number;
    }[];
  }[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    compression_ratio: number;
    processing_time_ms: number;
  };
  model: string;
} {
  return {
    id: 'mock-id',
    output,
    messages: [
      {
        role: 'user',
        content: output,
        compacted_line_ranges: [],
        kept_line_ranges: [],
      },
    ],
    usage: {
      input_tokens: 1_000,
      output_tokens: 300,
      compression_ratio: 0.3,
      processing_time_ms: 500,
    },
    model: 'mock-model',
  };
}

//endregion

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: compressBranch.name,
      // Sequential execution required — tests stub MorphCompactClient.prototype.compact
      // and would fail under concurrent execution because sinon refuses to
      // wrap an already-wrapped method.
      concurrency: 1,
      children: [
        // Thunks required for concurrency: 1 so execution
        // is deferred until the previous test settles
        () =>
          it({
            name: 'throws when there are no messages and no previous compaction',
            fn: async () => {
              await expect(
                compressBranch(emptyParams(),),
              )
                .rejects
                .toThrow('Nothing to compress',);
            },
          },),
        () =>
          it({
            name:
              'returns previous summary directly when no new messages exist after compaction',
            fn: async () => {
              const previousSummary = 'Previous compacted context here';
              const entries: SessionEntry[] = [
                makeCompactionEntry(previousSummary,),
              ];
              const result = await compressBranch({
                ...emptyParams(),
                branchEntries: entries,
              },);
              expect(result,).toBe(previousSummary,);
            },
          },),
        () =>
          it({
            name: 'calls Morph API and returns wrapped output for new messages',
            fn: async ({ sinon, },) => {
              const compactStub = sinon
                .stub(
                  MorphCompactClient.prototype,
                  'compact',
                )
                .resolves(
                  mockCompactResult(MOCK_COMPACT_OUTPUT,),
                );

              const entries: SessionEntry[] = [
                makeMessageEntry(
                  'user',
                  'What is the capital of France?',
                  'msg-1',
                ),
                makeMessageEntry(
                  'assistant',
                  'Paris is the capital of France.',
                  'msg-2',
                ),
              ];
              const result = await compressBranch({
                ...emptyParams(),
                branchEntries: entries,
              },);
              expect(result,).toContain(
                '<morph-compacted-history>',
              );
              expect(result,).toContain(
                '</morph-compacted-history>',
              );
              expect(result,).toContain(
                MOCK_COMPACT_OUTPUT,
              );
              expect(compactStub,).toHaveBeenCalled();
            },
          },),
        () =>
          it({
            name: 'includes previous summary and new messages in API call',
            fn: async ({ sinon, },) => {
              const compactStub = sinon
                .stub(
                  MorphCompactClient.prototype,
                  'compact',
                )
                .resolves(
                  mockCompactResult(MOCK_COMPACT_OUTPUT,),
                );

              const previousSummary = 'Old context about Spain';
              const entries: SessionEntry[] = [
                makeCompactionEntry(previousSummary,),
                makeMessageEntry(
                  'user',
                  'Now tell me about Italy',
                  'msg-1',
                ),
              ];
              const result = await compressBranch({
                ...emptyParams(),
                branchEntries: entries,
              },);
              // Should have called Morph API (not just returned
              // previous summary) and returned wrapped output
              expect(result,).toContain(
                '<morph-compacted-history>',
              );
              expect(result,).toContain(
                MOCK_COMPACT_OUTPUT,
              );
              expect(compactStub,).toHaveBeenCalled();
            },
          },),
        () =>
          it({
            name: 'passes custom instructions to query extraction',
            fn: async ({ sinon, },) => {
              const compactStub = sinon
                .stub(
                  MorphCompactClient.prototype,
                  'compact',
                )
                .resolves(
                  mockCompactResult(MOCK_COMPACT_OUTPUT,),
                );

              const entries: SessionEntry[] = [
                makeMessageEntry(
                  'user',
                  'General question',
                  'msg-1',
                ),
              ];
              const result = await compressBranch({
                ...emptyParams(),
                branchEntries: entries,
                customInstructions: 'focus on authentication',
              },);
              expect(result,).toContain(
                '<morph-compacted-history>',
              );
              // Custom instructions should appear as the query
              // arg in the compact call
              expect(compactStub,).toHaveBeenCalled();
              const callArgs = compactStub
                .firstCall
                .args[0] as Record<string, unknown>;
              expect(callArgs.query,).toBe(
                'focus on authentication',
              );
            },
          },),
        () =>
          it({
            name: 'throws when Morph API returns empty output',
            fn: async ({ sinon, },) => {
              sinon
                .stub(
                  MorphCompactClient.prototype,
                  'compact',
                )
                .resolves(
                  mockCompactResult('',),
                );

              const entries: SessionEntry[] = [
                makeMessageEntry(
                  'user',
                  'Some question',
                  'msg-1',
                ),
              ];
              await expect(
                compressBranch({
                  ...emptyParams(),
                  branchEntries: entries,
                },),
              )
                .rejects
                .toThrow('empty output',);
            },
          },),
        () =>
          it({
            name: 'collects only messages after the last compaction entry',
            fn: async ({ sinon, },) => {
              const compactStub = sinon
                .stub(
                  MorphCompactClient.prototype,
                  'compact',
                )
                .resolves(
                  mockCompactResult(MOCK_COMPACT_OUTPUT,),
                );

              const previousSummary = 'Earlier conversation about Germany';
              const entries: SessionEntry[] = [
                makeMessageEntry(
                  'user',
                  'Old message before compaction',
                  'msg-old',
                ),
                makeCompactionEntry(
                  previousSummary,
                  'compact-1',
                ),
                makeMessageEntry(
                  'user',
                  'New message after compaction',
                  'msg-new',
                ),
              ];
              const result = await compressBranch({
                ...emptyParams(),
                branchEntries: entries,
              },);
              expect(result,).toContain(
                '<morph-compacted-history>',
              );
              // Verify compact was called (messages after
              // compaction triggered API call)
              expect(compactStub,).toHaveBeenCalled();
            },
          },),
        () =>
          it({
            name: 'uses the last compaction when multiple exist',
            fn: async ({ sinon, },) => {
              const compactStub = sinon
                .stub(
                  MorphCompactClient.prototype,
                  'compact',
                )
                .resolves(
                  mockCompactResult(MOCK_COMPACT_OUTPUT,),
                );

              const entries: SessionEntry[] = [
                makeCompactionEntry(
                  'First compaction',
                  'compact-1',
                ),
                makeMessageEntry(
                  'user',
                  'Message between compactions',
                  'msg-1',
                ),
                makeCompactionEntry(
                  'Second compaction',
                  'compact-2',
                ),
                makeMessageEntry(
                  'user',
                  'Message after second compaction',
                  'msg-2',
                ),
              ];
              const result = await compressBranch({
                ...emptyParams(),
                branchEntries: entries,
              },);
              expect(result,).toContain(
                '<morph-compacted-history>',
              );
              // Verify compact was called with the input
              // containing "Second compaction" as
              // previousSummary
              expect(compactStub,).toHaveBeenCalled();
              const callArgs = compactStub
                .firstCall
                .args[0] as Record<string, unknown>;
              expect(
                callArgs.input as string,
              )
                .toContain('Second compaction',);
            },
          },),
      ],
    },),
  ],
},);
