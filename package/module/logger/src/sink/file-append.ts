import { appendFile, } from 'node:fs/promises';
import { reportLoggerInternalError, } from '../error-format.ts';

//region Complete append operations preserve JSONL record boundaries

/**
 Wait for the preceding complete append before issuing another record's filesystem writes.

 @param previous - preceding append, including its handled failure

 @param filePath - verified destination for this sink

 @param line - complete serialized record captured at invocation

 @example
 ```ts
 await appendAfter({ previous: Promise.resolve(), filePath, line: '{"ready":true}\n' });
 ```
 */
export async function appendAfter({
  previous,
  filePath,
  line,
}: {
  readonly previous: Promise<void>;
  readonly filePath: string;
  readonly line: string;
},): Promise<void> {
  await previous;
  try {
    await appendFile(
      filePath,
      line,
    );
  }
  catch (error: unknown) {
    reportLoggerInternalError({
      context: 'file sink record append failed',
      error,
    },);
  }
}

//endregion Complete append operations preserve JSONL record boundaries
