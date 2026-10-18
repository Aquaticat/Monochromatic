/** Exclusively own and round-trip one JSONL file before exposing it to the append queue. @module */
import { randomUUID, } from 'node:crypto';
import { appendFile, mkdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

//region File ownership starts only after a complete probe succeeds.
/** A filesystem round trip did not retain the sink's probe record. */
class FileProbeMismatchError extends Error {
  /** @param filePath - affected file whose read did not match the probe */
  constructor(filePath: string,) {
    super(`File sink probe did not round-trip in ${JSON.stringify(filePath,)}`,);
    this.name = 'FileProbeMismatchError';
  }
}

/**
 Create and verify an independently owned file before any records are admitted.

 @param directory - selected destination, kept literal for explicit callers
 @returns Path owned exclusively by this sink.
 @throws FileProbeMismatchError when the written probe does not round-trip.
 */
export async function openLogFile(directory: string,): Promise<string> {
  await mkdir(directory, { recursive: true, mode: 0o700, },);
  const timestamp = new Date().toISOString().replaceAll(':', '-',);
  const filePath = join(directory, `${timestamp}.${randomUUID()}.log.jsonl`,);
  const testData = `{"test":true,"timestamp":${Date.now()}}\n`;
  await appendFile(filePath, testData, { flag: 'ax', mode: 0o600, },);
  const content = await readFile(filePath, 'utf8',);
  if (content !== testData)
    throw new FileProbeMismatchError(filePath,);
  return filePath;
}
//endregion
