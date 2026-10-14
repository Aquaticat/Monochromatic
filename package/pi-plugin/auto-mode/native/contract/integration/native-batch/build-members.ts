/**
 Move qualified direct instance member references to private fields using original parser locations.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { parse } from 'yuku-parser';
import { NativeBatchBuildError } from './build-entries.ts';
import {
  applyNativeSourceEdits,
  type NativeSourceEdit
} from './build-spans.ts';
import { walkNativeSyntax } from './build-syntax.ts';

//region Qualified direct instance references retain original surrounding source text

/**
 Native member source transformations keep diagnostics distinct from runtime ownership checks.
 */
const l = tagged({ tag: 'auto-mode-native-build-members' });

/**
 Validate a decoded destination name as exactly one uninitialized private field before source interpolation.

 @param name - decoded destination identifier selected by the source generator

 @returns private identifier spelling admitted by the consuming JavaScript grammar

 @throws NativeBatchBuildError when the destination is not exactly one private field name
 */
function privateMemberName(name: string): string {
  /**
   Destination grammar validation remains distinct from parsing the original module.
   */
  const rl = tagged({
    tag: privateMemberName.name,
    l
  });
  rl.debug('validating renamed native private identifier');
  /**
   The parser checks destination syntax without executing interpolated text.
   */
  const parsed = parse(
    `class NativePrivateName { #${name}; }`,
    {
      sourceType: 'module',
      semanticErrors: true
    }
  );
  /**
   Additional declarations or fields cannot be accepted as identifier text.
   */
  const [declaration] = parsed.program.body;
  if ((parsed.diagnostics
    .length
    > 0) || (parsed.program
      .body
      .length
      !== 1)
    || (declaration?.type !== 'ClassDeclaration')
    || (declaration.body
      .body
      .length
      !== 1))
    throw new NativeBatchBuildError(`Native private destination is not one identifier: ${name}`);
  /**
   The exact decoded name rejects initializers, methods, and source-escaped alternate spellings.
   */
  const [field] = declaration.body.body;
  if ((field?.type !== 'PropertyDefinition') || (field.key
    .type
    !== 'PrivateIdentifier')
    || (field.key
      .name
      !== name)
    || (field.value !== null))
    throw new NativeBatchBuildError(`Native private destination is not one identifier: ${name}`);
  return `#${name}`;
}

/**
 Rewrite selected direct this-member identifiers while preserving comments, strings, and unrelated accesses.

 @param source - original source whose matching field declarations are managed by the caller

 @param members - decoded member names already qualified for private instance ownership

 @param renames - optional decoded destination names when original public and private spellings differ

 @returns source containing private references at original parsed member locations

 @throws NativeBatchBuildError when original source does not parse or selects the reserved constructor name

 @example
 ```ts
 privatizeNativeMembers({ source: 'class A { #state; read() { return this.state; } }', members: ['state'] });
 ```
 */
export function privatizeNativeMembers({
  source,
  members,
  renames
}: {
  readonly source: string;
  readonly members: readonly string[];
  readonly renames?: Readonly<Record<string, string>>;
}): string {
  /**
   Each private-member transformation retains a distinct diagnostic scope.
   */
  const rl = tagged({
    tag: privatizeNativeMembers.name,
    l
  });
  rl.debug('locating original native instance member references');
  /**
   Original parser tokens supply source order without sorting structural nodes.
   */
  const parsed = parse(
    source,
    {
      sourceType: 'module',
      tokens: true
    }
  );
  if (parsed.diagnostics
    .length
    > 0) throw new NativeBatchBuildError('Cannot parse native instance-member source');
  /**
   Qualified decoded names select identifiers, never arbitrary replacement text.
   */
  const selected = new Set(members);
  if (selected.has('constructor')) throw new NativeBatchBuildError('Native private member selection cannot include constructor');
  /**
   Explicit destination names are validated once before any source edit is assembled.
   */
  const destinations = new Map<string, string>();
  if (renames !== undefined) {
    for (const [original, destination] of Object.entries(renames))
      destinations.set(
        original,
        privateMemberName(destination)
      );
  }
  /**
   Each original member identifier supplies its own unique source interval.
   */
  const spans = new Map<number, NativeSourceEdit>();
  for (const node of walkNativeSyntax(parsed.program)) {
    if ((node.type !== 'MemberExpression') || node.computed
      || (node.object
        .type
        !== 'ThisExpression')
      || (node.property
        .type
        !== 'Identifier')
      || (!selected.has(node.property
        .name))) continue;
    spans.set(
      node.property
        .start,
      {
      start: node.property
        .start,
      end: node.property
        .end,
      text: destinations.get(node.property
        .name) ?? `#${source.slice(
        node.property
          .start,
        node.property
          .end
      )}`
    }
    );
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
  return applyNativeSourceEdits({
    source,
    edits
  });
}

//endregion Qualified direct instance references retain original surrounding source text
