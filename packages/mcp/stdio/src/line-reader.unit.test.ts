import {
  describe,
  expect,
  test,
} from 'bun:test';

import { readLines, } from './line-reader.ts';

//region helpers -- create ReadableStream from string content

/**
 * Creates a ReadableStream from a string, encoding it as a single UTF-8 chunk.
 *
 * @param content - Raw string to stream.
 * @returns ReadableStream yielding a single Uint8Array chunk.
 */
function streamFromString(content: string,): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller: ReadableStreamDefaultController<Uint8Array>,) {
      controller.enqueue(encoder.encode(content,),);
      controller.close();
    },
  },);
}

/**
 * Creates a ReadableStream from multiple string chunks, each encoded separately.
 * Simulates data arriving in pieces across chunk boundaries.
 *
 * @param chunks - Strings to enqueue as separate chunks.
 * @returns ReadableStream yielding one Uint8Array per chunk.
 */
function streamFromChunks(chunks: readonly string[],): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller: ReadableStreamDefaultController<Uint8Array>,) {
      for (const chunk of chunks)
        controller.enqueue(encoder.encode(chunk,),);
      controller.close();
    },
  },);
}

/**
 * Collects all lines from a readLines async generator into an array.
 *
 * @param stream - Input byte stream.
 * @returns Array of yielded lines.
 */
async function collectLines(
  stream: ReadableStream<Uint8Array>,
): Promise<readonly string[]> {
  const lines: string[] = [];
  for await (const line of readLines(stream,))
    lines.push(line,);
  return lines;
}

//endregion helpers

//region readLines -- async generator yielding newline-delimited lines

describe('readLines', () => {
  test('yields single line from newline-terminated input', async () => {
    const lines = await collectLines(streamFromString('hello\n',),);
    expect(lines,).toEqual(['hello',],);
  });

  test('yields multiple lines from single chunk', async () => {
    const lines = await collectLines(streamFromString('line1\nline2\nline3\n',),);
    expect(lines,).toEqual(['line1', 'line2', 'line3',],);
  });

  test('handles line split across chunk boundaries', async () => {
    const lines = await collectLines(streamFromChunks(['hel', 'lo\nwor', 'ld\n',],),);
    expect(lines,).toEqual(['hello', 'world',],);
  });

  test('yields empty array for empty stream', async () => {
    const lines = await collectLines(streamFromString('',),);
    expect(lines,).toEqual([],);
  });

  test('flushes trailing content without final newline', async () => {
    const lines = await collectLines(streamFromString('no-newline',),);
    expect(lines,).toEqual(['no-newline',],);
  });

  test('handles empty lines between content', async () => {
    const lines = await collectLines(streamFromString('a\n\nb\n',),);
    expect(lines,).toEqual(['a', '', 'b',],);
  });

  test('handles multiple consecutive newlines', async () => {
    const lines = await collectLines(streamFromString('\n\n\n',),);
    expect(lines,).toEqual(['', '', '',],);
  });

  test('handles single newline', async () => {
    const lines = await collectLines(streamFromString('\n',),);
    expect(lines,).toEqual(['',],);
  });

  test('handles chunk ending exactly at newline', async () => {
    const lines = await collectLines(streamFromChunks(['line1\n', 'line2\n',],),);
    expect(lines,).toEqual(['line1', 'line2',],);
  });

  test('handles JSON-RPC style messages', async () => {
    const message1 = '{"jsonrpc":"2.0","id":1,"method":"initialize"}';
    const message2 = '{"jsonrpc":"2.0","method":"notifications/initialized"}';
    const lines = await collectLines(streamFromString(`${message1}\n${message2}\n`,),);
    expect(lines,).toEqual([message1, message2,],);
  });
});

//endregion readLines
