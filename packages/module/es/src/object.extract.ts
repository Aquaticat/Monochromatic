import type { UnknownRecord, } from 'type-fest';
import type { Logged, } from './logged.basic';
import type { MaybeAsyncSchema, } from './schema.basic';
import { getDefaultLogger, } from './string.log.ts';

export function objectExtractSync(
  { obj, picked, l = getDefaultLogger(), }: { obj: UnknownRecord;
    picked: UnknownRecord | MaybeAsyncSchema; } & Partial<
    Logged
  >,
) {
}
