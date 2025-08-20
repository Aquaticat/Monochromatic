import type { Jsonl, } from './jsonl.basic';
import type { Logged, } from './logged.basic';
import { getDefaultLogger, } from './string.log';

type ReplacementRule = {
  readonly replaceAll?: true;
  /** If matches ^/.+/$, will be created as Regexp, otherwise treated as literal string */
  readonly pattern: string;
  /** literal string */
  readonly replacement: string;
};

// stringReplaceByJsonl({str: '', jsonl: ''}) // ''
// stringReplaceByJsonl({str: '', jsonl: '{}'}) // Error('invalid replacement rules')
// stringReplaceByJsonl({str: 'a', jsonl: '{replaceAll: false, pattern: 'a', replacement: 'b'}'}) // Error('replaceAll either true or not exist')
// stringReplaceByJsonl({str: 'a', jsonl: '{replaceAll: true, pattern: 'a', replacement: 'b'}'}) // 'b'
//

export function stringReplaceByJsonl(
  { str, jsonl, l = getDefaultLogger(), }: { str: string; jsonl: Jsonl; } & Partial<
    Logged
  >,
): string {
}
