import {
  matchingClose,
  NOT_FOUND,
  topLevelPieces,
  wholeWordAt,
  withoutComments,
} from './source-text-scan.ts';

//region TSDoc example scan
// LEDGER D9: examples that called the wrong function or left out a key the
// function requires. An `@example` is read as the call a reader should copy,
// and one that names another function or passes half the argument teaches the
// wrong call, so the package test reads every function declaration's example
// against the declaration it sits on.
//
// INDEX SCANS OVER FORMATTED SOURCE, not a parser: the package's TypeScript
// (7.0) ships no JavaScript syntax tree API, and the formatter writes every
// declaration the same few ways. What this cannot read it skips rather than
// guesses: a parameter typed by a named alias, an argument passed as a
// variable, and an example that elides its keys with `...` say nothing about
// keys, and arrow functions and methods are not read at all.

/**
 One example that does not show the call it documents.

 @example
 ```ts
 const finding: ExampleFinding = { name: 'purr', line: 12, problem: 'calls another function', };
 ```
 */
export type ExampleFinding = {
  /**
   Function the example documents.
   */
  readonly name: string;

  /**
   Line the declaration opens on, one-based.
   */
  readonly line: number;

  /**
   What is wrong: the call is missing, or a required key is.
   */
  readonly problem: string;
};

/**
 The code of a TSDoc block's example, between its fences.

 @param doc - the block, `/**` through its close

 @returns The example's code, or empty where the block has none

 @example
 ```ts
 const code = exampleCodeOf({ doc, },);
 ```
 */
function exampleCodeOf({ doc, }: { readonly doc: string; },): string {
  /**
   Where the example tag sits.
   */
  const tag = doc.indexOf('@example',);

  /**
   The opening fence after it.
   */
  const fence = (tag === NOT_FOUND) ? NOT_FOUND : doc.indexOf(
    '```',
    tag,
  );

  /**
   Where the fence line ends.
   */
  const codeStart = (fence === NOT_FOUND) ? NOT_FOUND : doc.indexOf(
    '\n',
    fence,
  );

  /**
   The closing fence.
   */
  const close = (codeStart === NOT_FOUND) ? NOT_FOUND : doc.indexOf(
    '```',
    codeStart,
  );
  return (close === NOT_FOUND) ? '' : doc.slice(
    codeStart,
    close,
  );
}

/**
 The function declared right after a TSDoc block: its name and parameter
 list.

 @param text - the file

 @param from - index just past the block

 @returns Name, parameter text and the declaration's index, or that no
 function declaration follows

 @example
 ```ts
 const declared = declarationAt({ text, from: end, },);
 ```
 */
function declarationAt(
  {
    text,
    from,
  }: {
    readonly text: string;
    readonly from: number
  },
): {
  readonly name: string;
  readonly params: string;
  readonly at: number
} | 'not-a-function' {
  /**
   Where the declaration starts.
   */
  const at = text.length
    - text.slice(from,)
    .trimStart()
    .length;

  /**
   The declaration with its modifiers taken off the front.
   */
  const head = [
    'export ',
    'async ',
  ].reduce(
    function withoutModifier(
      rest,
      modifier,
    ): string {
    return rest.startsWith(modifier,) ? rest.slice(modifier.length,) : rest;
  },
    text.slice(at,),
  );
  if (!head.startsWith('function',))
    return 'not-a-function';

  /**
   Text after the keyword.
   */
  const afterFunction = head.slice('function'.length,)
    .trimStart();

  /**
   Text after the keyword and any generator star.
   */
  const afterKeyword = afterFunction.startsWith('*',) ? afterFunction.slice(1,)
    .trimStart() : afterFunction;

  /**
   Where the name ends: at its type parameters or its parameter list.
   */
  const nameEnd = [
    afterKeyword.indexOf('<',),
    afterKeyword.indexOf('(',),
  ]
    .filter(function found(index,): boolean {
      return index !== NOT_FOUND;
    },)
    .reduce(
      function earliest(
        left,
        right,
      ): number {
      return Math.min(
        left,
        right,
      );
    },
      afterKeyword.length,
    );

  /**
   Where the parameter list opens, past any type parameters.
   */
  const open = afterKeyword.indexOf(
    '(',
    nameEnd,
  );

  /**
   Where it closes.
   */
  const close = (open === NOT_FOUND) ? NOT_FOUND : matchingClose({
    text: afterKeyword,
    open,
  },);
  if (close === NOT_FOUND)
    return 'not-a-function';
  return {
    name: afterKeyword.slice(
      0,
      nameEnd,
    )
      .trim(),
    params: afterKeyword.slice(
      open + 1,
      close,
    ),
    at,
  };
}

/**
 Keys the first parameter requires, when it is a destructured object whose
 type is written out.

 @param params - the parameter list's text

 @returns Required key names, or `unreadable` where nothing can be said

 @example
 ```ts
 const keys = requiredKeysOf({ params: '{ a, b = 1, }: { readonly a: T; readonly b?: U; }', },);
 ```
 */
function requiredKeysOf({ params, }: { readonly params: string; },): readonly string[] | 'unreadable' {
  /**
   The first parameter.
   */
  const first = topLevelPieces({
    text: params,
    separator: ',',
  },)[0] ?? '';
  if (!first.startsWith('{',))
    return 'unreadable';

  /**
   Where its binding pattern closes.
   */
  const bindingEnd = matchingClose({
    text: first,
    open: 0,
  },);

  /**
   The type after the binding's colon.
   */
  const typeText = withoutComments({ text: first.slice(bindingEnd + 1,), },);

  /**
   Where the written-out type opens.
   */
  const literalOpen = typeText.indexOf('{',);

  /**
   Where it closes.
   */
  const literalClose = (literalOpen === NOT_FOUND) ? NOT_FOUND : matchingClose({
    text: typeText,
    open: literalOpen,
  },);
  if ((bindingEnd === NOT_FOUND) || (literalClose === NOT_FOUND))
    return 'unreadable';

  /**
   Members of the type, each `readonly name?: Type`.
   */
  const members = topLevelPieces({
    text: typeText.slice(
      literalOpen + 1,
      literalClose,
    ),
    separator: ';',
  },)
    .map(function nameOf(member,): {
      readonly name: string;
      readonly optional: boolean
    } {
    /**
     The member without its modifier.
     */
    const bare = member.startsWith('readonly ',) ? member.slice('readonly '.length,) : member;

    /**
     Where its name ends.
     */
    const colon = bare.indexOf(':',);

    /**
     Its name, with any question mark.
     */
    const key = bare.slice(
      0,
      (colon === NOT_FOUND) ? bare.length : colon,
    )
      .trim();
    return {
      name: key.endsWith('?',) ? key.slice(
        0,
        -1,
      ) : key,
      optional: key.endsWith('?',),
    };
  },);

  /**
   Keys bound with a default, which the caller may leave out.
   */
  const defaulted = new Set(topLevelPieces({
    text: first.slice(
      1,
      bindingEnd,
    ),
    separator: ',',
  },)
    .filter(function hasDefault(binding,): boolean {
      return binding.includes('=',);
    },)
    .map(function keyOf(binding,): string {
      return (binding.split('=',)[0] ?? '').split(':',)[0]
        ?.trim()
        ?? '';
    },));
  return members
    .filter(function required(member,): boolean {
      return (!member.optional) && (!defaulted.has(member.name,));
    },)
    .map(function nameOf(member,): string {
      return member.name;
    },);
}

/**
 Reads every function declaration's example in a file against the declaration.

 @param text - one source file

 @returns One finding per example that calls another function or leaves out
 a key the function requires

 @example
 ```ts
 const findings = exampleFindingsOf({ text: await readFile(path, 'utf8',), },);
 ```
 */
export function exampleFindingsOf({ text, }: { readonly text: string; },): readonly ExampleFinding[] {
  /**
   Findings so far.
   */
  const findings: ExampleFinding[] = [];
  for (let open = text.indexOf('/**',); open !== NOT_FOUND; open = text.indexOf(
    '/**',
    open + 1,
  )) {
    /**
     Where the block closes.
     */
    const close = text.indexOf(
      '*/',
      open,
    );

    /**
     The block's example code.
     */
    const code = (close === NOT_FOUND) ? '' : exampleCodeOf({ doc: text.slice(
      open,
      close,
    ), },);

    /**
     The function it documents, if one follows.
     */
    const declared = (code === '') ? 'not-a-function' : declarationAt({
      text,
      from: close + 2,
    },);
    if (declared !== 'not-a-function') {
      /**
       Line the declaration opens on.
       */
      const line = text.slice(
        0,
        declared.at,
      )
        .split('\n',)
        .length;

      /**
       Where the example calls it.
       */
      const call = [
        wholeWordAt({
          text: code,
          word: declared.name,
          after: '(',
        },),
        wholeWordAt({
          text: code,
          word: declared.name,
          after: '<',
        },),
      ]
        .find(function found(index,): boolean {
          return index !== NOT_FOUND;
        },) ?? NOT_FOUND;

      /**
       Whether the example names the function at all: a predicate passed by
       name to a filter or a guard shows its use without calling it.
       */
      const named = wholeWordAt({
        text: code,
        word: declared.name,
        after: '',
      },) !== NOT_FOUND;
      if (!named)
        findings.push({
          name: declared.name,
          line,
          problem: 'calls another function',
        },);
      else if (call !== NOT_FOUND) {
        /**
         Where the call's argument list opens.
         */
        const argsOpen = code.indexOf(
          '(',
          call,
        );

        /**
         The argument text.
         */
        const args = code.slice(
          argsOpen + 1,
          matchingClose({
            text: code,
            open: argsOpen,
          },),
        )
          .trim();

        /**
         Keys the declaration requires.
         */
        const required = requiredKeysOf({ params: declared.params, },);
        if ((required !== 'unreadable') && args.startsWith('{',)
          && (!args.includes('...',))) {
          for (const key of required) {
            if (wholeWordAt({
              text: args,
              word: key,
              after: '',
            },) === NOT_FOUND)
              findings.push({
                name: declared.name,
                line,
                problem: `leaves out ${key}`,
              },);
          }
        }
      }
    }
  }
  return findings;
}

//endregion TSDoc example scan
