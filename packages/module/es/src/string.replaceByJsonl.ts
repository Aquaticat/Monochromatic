import type { UnknownRecord, } from 'type-fest';
import type { MaybeAsyncIterable, } from './iterable.basic';
import type { Jsonl, } from './jsonl.basic';
import type { Logged, } from './logged.basic';
import { getDefaultLogger, } from './string.log';

type ReplacementRule = {
  readonly replaceAll?: true;
  /** If matches ^\/.+\/$ , will be created as Regexp with g,m,v flags, otherwise treated as literal string */
  readonly patternString: string;
  /** literal string */
  readonly replacement: string;
  /** Only replace in which lines */
  readonly lines?: {
    readonly start: number;
    readonly end: number;
  };
};

// stringReplaceByReplacementRules({str: '', rules: []}) // ''

// stringReplaceByReplacementRules({str: 'a', rules: [{replaceAll: true, patternString: 'a', replacement: 'b'}]}) // 'b' logs warning "replaceAll specified but only one instance found, replaced one"

// stringReplaceByReplacementRules({str: 'a', rules: [{patternString: 'a', replacement: 'b'}]}) // 'b'

// stringReplaceByReplacementRules({str: 'aa', rules: [{patternString: 'a', replacement: 'b'}]}) // 'ba' logs warning "multiple instances found but replaceAll not specified, replaced one"

// stringReplaceByReplacementRules({str: 'ab', rules: [{patternString: 'a', replacement: 'b'},{patternString: 'bb', replacement: 'c'}]}); // 'c' logs warning `rule ${JSON.stringify(rule)} targeted some or all of the same lines as a previous rule, executed in order`

// stringReplaceByReplacementRules({str: 'a', rules: [{patternString: 'a', replacement: 'b', lines: {start: 0, end: 0}]}) // 'b' logs warning `str ${str} lines range is equal to given lines range ${JSON.stringify(lines)}`

// stringReplaceByReplacementRules({str: 'a\nab\na'}, rules: [{patternString: 'a', replacement: 'c', lines: {start: 0, end: 1}}]) // 'c\ncb\na'

export function stringReplaceByJsonl(
  { str, jsonl, l = getDefaultLogger(), }: { str: string; jsonl: Jsonl; } & Partial<
    Logged
  >,
): string {
  // uses jsonlToObjects
  // uses stringReplaceByReplacementRulesSync
}

export function stringReplaceByReplacementRulesSync(
  { str, rules, l = getDefaultLogger(), }:
    & { str: string; rules: Iterable<ReplacementRule>; }
    & Partial<Logged>,
): string {
  // uses stringReplaceByReplacementRule
}

export async function stringReplaceByReplacementRules(
  { str, rules, l = getDefaultLogger(), }: { str: string;
    rules: MaybeAsyncIterable<ReplacementRule>; } & Partial<Logged>,
): Promise<string> {
}

export function stringReplaceByReplacementRule(
  { str, rule, l = getDefaultLogger(), context, }:
    & { str: string; rule: ReplacementRule;
      context?: { linesTargetedByPreviousRules: number[]; }; }
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
