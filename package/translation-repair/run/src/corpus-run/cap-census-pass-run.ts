import {
  open,
  readFile,
} from 'node:fs/promises';

import {
  type CapLogReading,
  readCapLog,
} from './cap-census-read.ts';

//region Cap census pass run
// WHICH LOGS THE CAP CENSUS COUNTS (ledger P7, P10): a log counts only when a
// line in its first few kilobytes opens `START tip=`, since suite, build and
// prototype logs carry fixture `SPEND` lines. Each log is opened only far
// enough to read its head, and a pass-run log's text is dropped once its
// samples are read, so memory holds samples, not logs.

/**
 Bytes at the head of a log searched for the pass-run marker.
 */
const HEAD_BYTES = 4_096;

/**
 Line a pass run opens its log with.
 */
const PASS_RUN_MARKER = 'START tip=';

/**
 Reads one log's samples when it is a pass-run log.

 @param path - log file

 @returns Its samples and the lines it left out for their stamp, or that it
 is no pass-run log

 @example
 ```ts
 const read = await capCensusPassRunReading({ path, },);
 ```
 */
export async function capCensusPassRunReading(
  { path, }: { readonly path: string; },
): Promise<CapLogReading | 'not-a-pass-run'> {
  /**
   Head of the log, read without reading the rest.
   */
  const head = await (async function readHead(): Promise<string> {
    /**
     The open log, closed when the head is read.
     */
    await using handle = await open(path,);

    /**
     Buffer the head is read into.
     */
    const buffer = Buffer.alloc(HEAD_BYTES,);

    /**
     Bytes the read filled.
     */
    const { bytesRead, } = await handle.read(
      buffer,
      0,
      HEAD_BYTES,
      0,
    );
    return buffer.toString(
      'utf8',
      0,
      bytesRead,
    );
  })();
  if (!head.split('\n',)
    .some(function opensRun(line,): boolean {
    return line.startsWith(PASS_RUN_MARKER,);
  },))
    return 'not-a-pass-run';
  return readCapLog({
    lines: (await readFile(
      path,
      'utf8',
    )).split('\n',),
  },);
}

//endregion Cap census pass run
