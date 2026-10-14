/**
 Move qualified direct instance member references to private fields using original parser locations.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { parse } from 'yuku-parser';
import { NativeBatchBuildError } from './build-entries.ts';
import { applyNativeSourceEdits, type NativeSourceEdit } from './build-spans.ts';
import { walkNativeSyntax } from './build-syntax.ts';

//region Qualified direct instance references retain original surrounding source text

/**
 Native member source transformations keep diagnostics distinct from runtime ownership checks.
 */
const l = tagged({ tag: 'auto-mode-native-build-members' });

/**
 Rewrite selected direct this-member identifiers while preserving comments, strings, and unrelated accesses.

 @param source - original source whose matching field declarations are managed by the caller

 @param members - decoded member names already qualified for private instance ownership

 @returns source containing private references at original parsed member locations

 @throws NativeBatchBuildError when original source does not parse or selects the reserved constructor name

 @example
 ```ts
 privatizeNativeMembers({ source: 'class A { #state; read() { return this.state; } }', members: ['state'] });
 ```
 */
export function privatizeNativeMembers({ source, members }: {
  readonly source: string;
  readonly members: readonly string[];
}): string {
  /**
   Each private-member transformation retains a distinct diagnostic scope.
   */
  const rl = tagged({ tag: privatizeNativeMembers.name, l });
  rl.debug('locating original native instance member references');
  /**
   Original parser tokens supply source order without sorting structural nodes.
   */
  const parsed = parse(source, { sourceType: 'module', tokens: true });
  if (parsed.diagnostics.length > 0) throw new NativeBatchBuildError('Cannot parse native instance-member source');
  /**
   Qualified decoded names select identifiers, never arbitrary replacement text.
   */
  const selected = new Set(members);
  if (selected.has('constructor')) throw new NativeBatchBuildError('Native private member selection cannot include constructor');
  /**
   Each original member identifier supplies its own unique source interval.
   */
  const spans = new Map<number, NativeSourceEdit>();
  for (const node of walkNativeSyntax(parsed.program)) {
    if (node.type !== 'MemberExpression' || node.computed || node.object.type !== 'ThisExpression'
      || node.property.type !== 'Identifier' || !selected.has(node.property.name)) continue;
    spans.set(node.property.start, {
      start: node.property.start,
      end: node.property.end,
      text: `#${source.slice(node.property.start, node.property.end)}`
    });
  }
  /**
   Token capture was requested from the same parser occurrence as the selected nodes.
   */
  const tokens = nonNullishOrThrow(parsed.tokens);
  /**
   Source order retains every original comment and member-access delimiter.
   */
  const edits: NativeSourceEdit[] = [];
  for (let index = 0; index < tokens.length; index++) {
    /**
     Non-member tokens do not contribute an edit.
     */
    const edit = spans.get(tokens.start(index));
    if (edit !== undefined) edits.push(edit);
  }
  return applyNativeSourceEdits({ source, edits });
}

//endregion Qualified direct instance references retain original surrounding source text
