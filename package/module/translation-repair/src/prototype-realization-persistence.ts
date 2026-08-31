// PROTOTYPE ONLY: Candidate G immutable plan persistence.

import { readFile, } from 'node:fs/promises';

import { isJsonRecord, } from './json-guard.ts';
import { writePrototypeJson, } from './prototype-brief-editor-runtime.ts';

/** Whether filesystem error reports absent immutable plan. */
function isMissingPlan(error: unknown,): boolean {
  return isJsonRecord(error,) && (error.code === 'ENOENT');
}

/** Creates immutable JSON plan once or requires byte-equivalent restart value. */
export async function persistRealizationImmutableJson({ path, value, label, }: {
  readonly path: string;
  readonly value: unknown;
  readonly label: string;
}): Promise<void> {
  const expected = `${JSON.stringify(value, null, 2,)}\n`;
  try {
    const stored = await readFile(path, 'utf8',);
    if (stored !== expected)
      throw new Error(`realization ${label} restart binding differs`);
  }
  catch (error) {
    if (!isMissingPlan(error,))
      throw error;
    await writePrototypeJson({ path, value, });
  }
}
