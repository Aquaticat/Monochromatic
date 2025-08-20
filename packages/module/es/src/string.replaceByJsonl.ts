import type { UnknownRecord, } from 'type-fest';
import type { Jsonl, } from './jsonl.basic';
import type { Logged, } from './logged.basic';
import { getDefaultLogger, } from './string.log';

type ReplacementRule = {
  readonly replaceAll?: true;
  /** If matches ^/.+/$, will be created as Regexp, otherwise treated as literal string */
  readonly patternString: string;
  /** literal string */
  readonly replacement: string;
  /** Only replace in which lines */
  readonly lines?: {
    readonly startLine: number;
    readonly endLine: number;
  };
};

// stringReplaceByReplacementRules({str: '', rules: []}) // ''

// stringReplaceByReplacementRules({str: 'a', rules: [{replaceAll: true, pattern: 'a', replacement: 'b'}]}) // 'b' logs warning "replaceAll specified but only one instance found, replaced one"

// stringReplaceByReplacementRules({str: 'a', rules: [{pattern: 'a', replacement: 'b'}]}) // 'b'
// stringReplaceByReplacementRules({str: 'aa', rules: [{pattern: 'a', replacement: 'b'}]}) // 'ba' logs warning "multiple instances found but replaceAll not specified, replaced one"
// stringReplaceByReplacementRules({str: 'ab', jsonl: '{pattern: 'a', replacement: 'b'}\n{pattern: 'bb', replacement: 'c'}'});
// stringReplaceByJsonl({str: 'a', jsonl: '{pattern: 'a', replacement: 'b', lines: {}}'})

export function stringReplaceByJsonl(
  { str, jsonl, l = getDefaultLogger(), }: { str: string; jsonl: Jsonl; } & Partial<
    Logged
  >,
): string {
  // uses jsonlToObjects
  // uses stringReplaceByReplacementRules
}

export function stringReplaceByReplacementRules(
  { str, rules, l = getDefaultLogger(), }: { str: string; rules: ReplacementRule; }
    & Partial<Logged>,
): string {
  // uses stringReplaceByReplacementRule
}

export function stringReplaceByReplacementRule(
  { str, rule, l = getDefaultLogger(), }: { str: string; rule: ReplacementRule; }
    & Partial<Logged>,
): string {
}

//region To be put in other files
// TODO: Put in other files myself

export function jsonlToObjects(
  { jsonl, l = getDefaultLogger(), }: { jsonl: Jsonl; rule: ReplacementRule; } & Partial<
    Logged
  >,
): UnknownRecord[] {
  l.debug(jsonlToObjects.name,);
  return jsonl
    .split('\n',)
    .map(function trim(json,) {
      return json.trim();
    },)
    .filter(Boolean,)
    .map(function parse(json,) {
      return JSON.parse(json,);
    },);
}

//endregion To be put in other files
