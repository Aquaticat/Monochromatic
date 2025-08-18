import type { Logged, } from './logged.basic';
import { getDefaultLogger, } from './string.log';

export function stringReplaceByJsonl(
  { str, jsonl, l = getDefaultLogger(), }: { str: string; jsonl: string; } & Partial<
    Logged
  >,
) {
}
