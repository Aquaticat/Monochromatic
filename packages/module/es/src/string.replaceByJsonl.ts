import type { Jsonl, } from './jsonl.basic';
import type { Logged, } from './logged.basic';
import { getDefaultLogger, } from './string.log';

type ReplacementRule = {
  readonly replaceAll?: true;
  readonly pattern: f;
};

// stringReplaceByJsonl({str: '', jsonl: ''}) // ''
// stringReplaceByJsonl({str: '', jsonl: '{}'}) // Error('invalid replacement rules')
export function stringReplaceByJsonl(
  { str, jsonl, l = getDefaultLogger(), }: { str: string; jsonl: Jsonl; } & Partial<
    Logged
  >,
): string {
}
