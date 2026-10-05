/**
 Guards how the package asks whether a text is blank (ledgers B40 and B128).
 Whether text a model wrote shows a reader anything is asked of
 `rendersAsNothing` (`renders-as-nothing.ts`), never of `trim()`, `length` or
 a comparison with the empty string, each of which keeps every invisible
 character that is not whitespace. The rule rested on habit and review, and a
 census on 2026-10-05 found it asked the old way in more places. Each test of
 the old shape the package still makes is listed here with why its question
 is another one, so a new one fails this test until it says which.

 WHAT THE SCAN READS, in the package's source (tests and their fixtures are
 left out). A comparison (`===`, `!==`, `==`, `!=`) with the empty string,
 written as a string or as a template, either way round. The `length` of a
 `trim`, `trimStart` or `trimEnd` call, or of a name its function declares
 with one, compared with anything. The `length` of a name its function
 annotates as `string`, alone or in a union (a parameter, one destructured
 from an inline type among them, or a variable), compared with zero or asked
 whether it is less than one. And any of those texts, or its `length`, tested
 for truth: the test of an `if`, a `?:` or a loop, the operand of `!`, or
 the left operand of `&&` or `||`. Tests are keyed
 `path#site`, where the site is the nearest enclosing named function or
 class, and counted per key, so a second test inside a listed function fails
 as a new function's would.

 OUT OF ITS REACH, since the source carries no types to read: the `length` or
 the truth of a string no annotation names (a field read off a reply, a
 destructured binding with no type), which reads as an array's would; a
 comparison with a constant that holds the empty string; a blank needle
 handed to `includes`, `startsWith` or `indexOf`; a length floor on a text
 that was never trimmed; and the result of a helper that trims, compared by
 its `length` in another function. A helper that answers the comparison for
 its callers is read once, where it compares.

 THE FIXTURE CASE COMES FIRST, so the package-wide case is read against a
 scan shown able to find each form (ledger M21). Fixtures are cat-themed; the
 package case reads this package's own source.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { compareCodePoints, } from '../dist/final/node/index.mjs';
import {
  childNodes,
  identifierName,
  isTreeNode,
  memberName,
  parseSource,
  readPackageSource,
  type SourceText,
  type TreeNode,
  unwrapped,
} from './source-scan.test-fixture.ts';

//region Blank-text tests
// The scan: which nodes ask whether a text is blank by its bytes, and the walk
// that keys each by its file and enclosing named function or class.

/**
 Node kinds that open a function, which names the site of the tests inside
 and declares the names they read.
 */
const FUNCTION_KINDS: ReadonlySet<string> = new Set([
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
],);

/**
 Node kinds that open a class, which names the site of the tests inside.
 */
const CLASS_KINDS: ReadonlySet<string> = new Set([
  'ClassDeclaration',
  'ClassExpression',
],);

/**
 Operators that ask whether two values are the same.
 */
const EQUALITY_OPERATORS: ReadonlySet<string> = new Set([
  '!=',
  '!==',
  '==',
  '===',
],);

/**
 Operators that compare two values, equality among them.
 */
const COMPARISON_OPERATORS: ReadonlySet<string> = new Set([
  ...EQUALITY_OPERATORS,
  '<',
  '<=',
  '>',
  '>=',
],);

/**
 String members that return their text with whitespace cut from an end.
 */
const TRIM_MEMBERS: ReadonlySet<string> = new Set([
  'trim',
  'trimEnd',
  'trimStart',
],);

/**
 Node kinds whose `test` field is tested for truth.
 */
const TRUTH_TEST_KINDS: ReadonlySet<string> = new Set([
  'ConditionalExpression',
  'DoWhileStatement',
  'ForStatement',
  'IfStatement',
  'WhileStatement',
],);

/**
 Logical operators whose left operand is tested for truth.
 */
const TRUTH_OPERATORS: ReadonlySet<string> = new Set([
  '&&',
  '||',
],);

/**
 Comparisons that, with a length on the left and one on the right, ask
 whether the length is less than one or not.
 */
const LESS_THAN_ONE_OPERATORS: ReadonlySet<string> = new Set([
  '<',
  '>=',
],);

/**
 Each ordering comparison as it reads with its two sides swapped.
 */
const SWAPPED_OPERATORS: ReadonlyMap<string, string> = new Map([
  [
    '<',
    '>',
  ],
  [
    '<=',
    '>=',
  ],
  [
    '>',
    '<',
  ],
  [
    '>=',
    '<=',
  ],
],);

/**
 Length, in characters, of an empty template literal: its two backticks.
 */
const EMPTY_TEMPLATE_LENGTH = 2;

/**
 Names in reach of one node whose text the scan can tell is a string.
 */
type KnownTexts = {
  /**
   Names declared with a `trim`, `trimStart` or `trimEnd` call.
   */
  readonly trimmed: ReadonlySet<string>;

  /**
   Names annotated as `string`.
   */
  readonly strings: ReadonlySet<string>;
};

/**
 Whether a node is the empty string, written as a string or as a template.

 @param node - node read

 @returns Whether it is that literal, parentheses aside

 @example
 ```ts
 const empty = isEmptyText({ node: comparison.right, },);
 ```
 */
function isEmptyText({ node, }: { readonly node: unknown; },): boolean {
  /**
   The node inside any parentheses.
   */
  const { inner, } = unwrapped({ node, },);
  if (!isTreeNode(inner,))
    return false;
  if (inner.type === 'Literal')
    return inner.value === '';
  return (inner.type === 'TemplateLiteral') && ((inner.end - inner.start) === EMPTY_TEMPLATE_LENGTH);
}

/**
 Whether comparing a length with a number asks whether there is any length
 at all: any comparison with zero, or one that asks whether the length is
 less than one.

 @param operator - comparison as written with the length on its left

 @param count - what the length is compared with

 @returns Whether the comparison separates no characters from some

 @example
 ```ts
 const asksNone = countsNone({ operator: '<', count: comparison.right, },); // true for `length < 1`
 ```
 */
function countsNone(
  {
    operator,
    count,
  }: {
    readonly operator: string;
    readonly count: unknown;
  },
): boolean {
  /**
   The number inside any parentheses.
   */
  const { inner, } = unwrapped({ node: count, },);
  if ((!isTreeNode(inner,)) || (inner.type !== 'Literal'))
    return false;
  if (inner.value === 0)
    return true;
  return (inner.value === 1) && LESS_THAN_ONE_OPERATORS.has(operator,);
}

/**
 Whether a node calls `trim`, `trimStart` or `trimEnd` on something.

 @param node - node read

 @returns Whether it is such a call, parentheses aside

 @example
 ```ts
 const trims = isTrimCall({ node: declarator.init, },);
 ```
 */
function isTrimCall({ node, }: { readonly node: unknown; },): boolean {
  /**
   The node inside any parentheses.
   */
  const { inner, } = unwrapped({ node, },);
  if ((!isTreeNode(inner,)) || (inner.type !== 'CallExpression'))
    return false;
  /**
   What the call calls, inside any parentheses.
   */
  const { inner: callee, } = unwrapped({ node: inner.callee, },);
  return isTreeNode(callee,)
    && (callee.type === 'MemberExpression')
    && TRIM_MEMBERS.has(memberName({ node: callee, },),);
}

/**
 Whether a type annotation says `string`, alone or as one member of a union
 such as `string | undefined`.

 @param annotation - annotation a name or a type member carries, or none

 @returns Whether it annotates a string

 @example
 ```ts
 const text = annotatesString({ annotation: parameter.typeAnnotation, },);
 ```
 */
function annotatesString({ annotation, }: { readonly annotation: unknown; },): boolean {
  if ((!isTreeNode(annotation,)) || (annotation.type !== 'TSTypeAnnotation') || (!isTreeNode(annotation.typeAnnotation,)))
    return false;
  /**
   The annotated type.
   */
  const annotated = annotation.typeAnnotation;
  if (annotated.type === 'TSStringKeyword')
    return true;
  return (annotated.type === 'TSUnionType')
    && childNodes({ node: annotated, },).some(function isString(member,): boolean {
      return member.type === 'TSStringKeyword';
    },);
}

/**
 The nodes one field of a node lists.

 @param value - field read, a list or anything else

 @returns Its nodes in order, none when the field is no list

 @example
 ```ts
 const parameters = listedNodes({ value: fn.params, },);
 ```
 */
function listedNodes({ value, }: { readonly value: unknown; },): readonly TreeNode[] {
  /**
   The field as a list, empty when it is none.
   */
  const listed: readonly unknown[] = Array.isArray(value,) ? value : [];
  return listed.filter(function isNode(member,): member is TreeNode {
    return isTreeNode(member,);
  },);
}

/**
 Members an inline object type annotates as `string`, read through one
 wrapping type such as `Readonly<{ ... }>`.

 @param annotation - annotation a destructured parameter carries, or none

 @returns Names of its string members, none for any other annotation

 @example
 ```ts
 const members = stringMembers({ annotation: pattern.typeAnnotation, },);
 ```
 */
function stringMembers({ annotation, }: { readonly annotation: unknown; },): ReadonlySet<string> {
  if ((!isTreeNode(annotation,)) || (!isTreeNode(annotation.typeAnnotation,)))
    return new Set();
  /**
   The annotated type.
   */
  const annotated = annotation.typeAnnotation;
  /**
   Type arguments of a wrapping type, none for a type written bare.
   */
  const wrapped = isTreeNode(annotated.typeArguments,) ? listedNodes({ value: annotated.typeArguments.params, },) : [];
  /**
   The inline object type: the annotation itself, or a wrapper's one argument.
   */
  const literal = (wrapped.length === 1) ? wrapped[0] : annotated;
  if ((literal === undefined) || (literal.type !== 'TSTypeLiteral'))
    return new Set();
  return new Set(listedNodes({ value: literal.members, },)
    .filter(function isStringMember(member,): boolean {
      return (member.type === 'TSPropertySignature') && annotatesString({ annotation: member.typeAnnotation, },);
    },)
    .map(function nameOf(member,): string {
      return identifierName({ node: member.key, },);
    },),);
}

/**
 Names one parameter binds to a string its annotation names.

 @param parameter - parameter of a function, with or without a default

 @returns The names, none where the annotation names no string

 @example
 ```ts
 const names = stringNamesOf({ parameter, },);
 ```
 */
function stringNamesOf({ parameter, }: { readonly parameter: TreeNode; },): readonly string[] {
  /**
   The parameter without its default.
   */
  const pattern = ((parameter.type === 'AssignmentPattern') && isTreeNode(parameter.left,)) ? parameter.left : parameter;
  if (pattern.type === 'Identifier')
    return annotatesString({ annotation: pattern.typeAnnotation, },) ? [identifierName({ node: pattern, },),] : [];
  if (pattern.type !== 'ObjectPattern')
    return [];
  /**
   Members the pattern's inline type annotates as strings.
   */
  const members = stringMembers({ annotation: pattern.typeAnnotation, },);
  return listedNodes({ value: pattern.properties, },)
    .filter(function bindsString(property,): boolean {
      return members.has(identifierName({ node: property.key, },),);
    },)
    .map(function boundName(property,): string {
      /**
       What the member is bound to, without its default.
       */
      const bound = (isTreeNode(property.value,) && (property.value.type === 'AssignmentPattern'))
        ? property.value.left
        : property.value;
      return identifierName({ node: bound, },);
    },);
}

/**
 Names a function, or a file outside every function, declares that the scan
 can tell are text: its string parameters, and the variables it declares with
 a trim or annotates as `string`. Functions nested inside are read when the
 walk reaches them.

 @param root - function or program read

 @param outer - names already in reach of it

 @returns Names in reach of the nodes inside

 @example
 ```ts
 const known = knownTextsIn({ root: fn, outer, },);
 ```
 */
function knownTextsIn(
  {
    root,
    outer,
  }: {
    readonly root: TreeNode;
    readonly outer: KnownTexts;
  },
): KnownTexts {
  /**
   Names declared with a trim, the outer ones among them.
   */
  const trimmed = new Set(outer.trimmed,);
  /**
   Names annotated as strings, the outer ones among them.
   */
  const strings = new Set(outer.strings,);
  /**
   Parameters of a function, none for a program.
   */
  const parameters = listedNodes({ value: root.params, },);
  for (const parameter of parameters) {
    for (const name of stringNamesOf({ parameter, },))
      strings.add(name,);
  }
  /**
   Nodes still to visit, none of them inside a nested function.
   */
  const pending: TreeNode[] = [...childNodes({ node: root, },),];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (FUNCTION_KINDS.has(node.type,))
      continue;
    if ((node.type === 'VariableDeclarator') && isTreeNode(node.id,) && (node.id.type === 'Identifier')) {
      if (isTrimCall({ node: node.init, },))
        trimmed.add(identifierName({ node: node.id, },),);
      if (annotatesString({ annotation: node.id.typeAnnotation, },))
        strings.add(identifierName({ node: node.id, },),);
    }
    pending.push(...childNodes({ node, },),);
  }
  return {
    trimmed,
    strings,
  };
}

/**
 Which kind of text a node is, for the scan: a trim's result, a name
 annotated as a string, or neither.

 @param node - node read

 @param known - names in reach of the node

 @returns `trimmed`, `string`, or empty for anything else

 @example
 ```ts
 const kind = textKindOf({ node: test, known, },);
 ```
 */
function textKindOf(
  {
    node,
    known,
  }: {
    readonly node: unknown;
    readonly known: KnownTexts;
  },
): string {
  if (isTrimCall({ node, },))
    return 'trimmed';
  /**
   The node inside any parentheses.
   */
  const { inner, } = unwrapped({ node, },);
  /**
   The name the node is, empty for any other node.
   */
  const name = identifierName({ node: inner, },);
  if (name === '')
    return '';
  if (known.trimmed.has(name,))
    return 'trimmed';
  return known.strings.has(name,) ? 'string' : '';
}

/**
 Which kind of text a node reads the `length` of.

 @param node - node read

 @param known - names in reach of the node

 @returns `trimmed`, `string`, or empty where the node reads no such length

 @example
 ```ts
 const kind = lengthKindOf({ node: comparison.left, known, },);
 ```
 */
function lengthKindOf(
  {
    node,
    known,
  }: {
    readonly node: unknown;
    readonly known: KnownTexts;
  },
): string {
  /**
   The node inside any parentheses.
   */
  const { inner, } = unwrapped({ node, },);
  if ((!isTreeNode(inner,)) || (inner.type !== 'MemberExpression') || (memberName({ node: inner, },) !== 'length'))
    return '';
  return textKindOf({
    node: inner.object,
    known,
  },);
}

/**
 Whether a node is tested for truth as a text the scan knows, or as its
 `length`.

 @param node - operand or test read

 @param known - names in reach of the node

 @returns Whether its truth is a blankness test

 @example
 ```ts
 const tested = isTruthOfText({ node: statement.test, known, },);
 ```
 */
function isTruthOfText(
  {
    node,
    known,
  }: {
    readonly node: unknown;
    readonly known: KnownTexts;
  },
): boolean {
  return (textKindOf({
    node,
    known,
  },) !== '') || (lengthKindOf({
    node,
    known,
  },) !== '');
}

/**
 Whether a comparison asks whether a text is blank by its bytes.

 @param node - binary expression read

 @param known - names in reach of the node

 @returns Whether it compares with the empty string, compares a trim's
 length with anything, or asks whether an annotated string has any length

 @example
 ```ts
 const asks = comparesBlank({ node, known, },);
 ```
 */
function comparesBlank(
  {
    node,
    known,
  }: {
    readonly node: TreeNode;
    readonly known: KnownTexts;
  },
): boolean {
  /**
   The comparison's operator.
   */
  const operator = String(node.operator,);
  if (EQUALITY_OPERATORS.has(operator,) && (isEmptyText({ node: node.left, },) || isEmptyText({ node: node.right, },)))
    return true;
  if (!COMPARISON_OPERATORS.has(operator,))
    return false;
  /**
   Kind of text whose length the left side reads.
   */
  const left = lengthKindOf({
    node: node.left,
    known,
  },);
  /**
   Kind of text whose length the right side reads.
   */
  const right = lengthKindOf({
    node: node.right,
    known,
  },);
  if ((left === 'trimmed') || (right === 'trimmed'))
    return true;
  if (left === 'string') {
    return countsNone({
      operator,
      count: node.right,
    },);
  }
  return (right === 'string') && countsNone({
    operator: SWAPPED_OPERATORS.get(operator,) ?? operator,
    count: node.left,
  },);
}

/**
 Whether a node asks whether a text is blank by its bytes.

 @param node - node read

 @param known - names in reach of the node

 @returns Whether it is one of the tests the scan reads

 @example
 ```ts
 const asks = asksBlank({ node, known, },);
 ```
 */
function asksBlank(
  {
    node,
    known,
  }: {
    readonly node: TreeNode;
    readonly known: KnownTexts;
  },
): boolean {
  if (node.type === 'BinaryExpression') {
    return comparesBlank({
      node,
      known,
    },);
  }
  if (TRUTH_TEST_KINDS.has(node.type,)) {
    return isTruthOfText({
      node: node.test,
      known,
    },);
  }
  if ((node.type === 'UnaryExpression') && (node.operator === '!')) {
    return isTruthOfText({
      node: node.argument,
      known,
    },);
  }
  return (node.type === 'LogicalExpression')
    && TRUTH_OPERATORS.has(String(node.operator,),)
    && isTruthOfText({
      node: node.left,
      known,
    },);
}

/**
 Blankness tests in the package's source, counted per `path#site`.

 @param files - files read; tests and fixtures are skipped

 @returns Count per key, keys sorted

 @example
 ```ts
 const tests = blankTextTests({ files, },);
 ```
 */
function blankTextTests({ files, }: { readonly files: readonly SourceText[]; },): Readonly<Record<string, number>> {
  /**
   Count per key so far.
   */
  const counts = new Map<string, number>();
  for (const file of files) {
    if (file.isTest)
      continue;
    /**
     The file's program.
     */
    const { program, } = parseSource({ file, },);
    /**
     Nodes still to visit, each with its enclosing site and the names in its
     reach.
     */
    const pending: {
      readonly node: TreeNode;
      readonly site: string;
      readonly known: KnownTexts;
    }[] = [{
      node: program,
      site: '<module>',
      known: knownTextsIn({
        root: program,
        outer: {
          trimmed: new Set(),
          strings: new Set(),
        },
      },),
    },];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      /**
       Node visited now, its site and the names in its reach.
       */
      const {
        node,
        site,
        known,
      } = next;
      /**
       Whether the node opens a function.
       */
      const opensFunction = FUNCTION_KINDS.has(node.type,);
      /**
       Site for the node's children: a function or class the node names.
       */
      const here = ((opensFunction || CLASS_KINDS.has(node.type,)) && isTreeNode(node.id,))
        ? identifierName({ node: node.id, },)
        : site;
      /**
       Names in reach of the node's children.
       */
      const inside = opensFunction
        ? knownTextsIn({
          root: node,
          outer: known,
        },)
        : known;
      if (asksBlank({
        node,
        known,
      },)) {
        /**
         The test's key.
         */
        const key = `${file.path}#${site}`;
        counts.set(
          key,
          (counts.get(key,) ?? 0) + 1,
        );
      }
      pending.push(...childNodes({ node, },).map(function withSite(child,) {
        return {
          node: child,
          site: here,
          known: inside,
        };
      },),);
    }
  }
  return Object.fromEntries([...counts,].toSorted(function byKey(
    [left,],
    [right,],
  ): number {
    return compareCodePoints({
      left,
      right,
    },);
  },),);
}

//endregion Blank-text tests

//region Listed tests
// Every blankness test the package makes, with why its question is not
// whether text a model wrote shows a reader anything. A reason many tests
// share is named once; a test of text a model wrote carries its own.

/**
 Why a test of a setting stands.
 */
const SETTING = 'a setting, key, path or model id read from the environment, the command line or the run\'s '
  + 'configuration, which no model writes';

/**
 Why a test of something the package put together stands.
 */
const ASSEMBLED = 'a block, note, line or key part the package assembled (declared names, cited references, picture '
  + 'readings, neighbouring passages, a dispute note, a log line), which it writes empty exactly when it has none';

/**
 Why a test of a provider's own field stands.
 */
const PROTOCOL = 'a frame, payload line or field of a provider\'s protocol, whose empty form the protocol defines';

/**
 Why a test of one stream delta stands.
 */
const DELTA = 'one stream delta of a reply, where an empty delta adds nothing and any other, one of spaces among '
  + 'them, is part of the reply being put together';

/**
 Why a test inside a scanner stands.
 */
const SCANNER = 'one character, token or line of a text a scanner walks, where blank is what the grammar being read '
  + 'calls blank';

/**
 Why a guard against an empty needle stands.
 */
const EMPTY_NEEDLE = 'an empty needle or key, which a search would find at every offset, refused before the search';

/**
 Why a test of text nobody generated stands.
 */
const PARSED = 'text of the original, the archive, front matter, corpus metadata or a reviewed reference, which no '
  + 'model wrote';

/**
 Why a test of the package's own empty string stands.
 */
const SENTINEL = 'an empty string the package itself writes or returns to say none: a helper that found nothing, a '
  + 'state not yet set, a constant for no prefix';

/**
 Why a test of something read back stands.
 */
const RECORD = 'a field of a record, file name, ledger, log line or sheet the package wrote and reads back';

/**
 Why a test of a program's output stands.
 */
const TOOL = 'output of a program or a lookup service, not a model\'s wording';

/**
 Why a test of a slice's text as it stands is right.
 */
const ARCHIVE_ABSENT = 'the archive or page text of a slice as it stands, which the package passes empty where the '
  + 'slice holds none';

/**
 Why a test of the standing text stands.
 */
const STANDING = 'the standing text of a slice, empty where neither the archive nor a lane holds wording there, '
  + 'which is when no slate is bought; whether a standing text shows a reader anything is the floors\' question '
  + '(`readStandingVerdict` validates it as a candidate)';

/**
 Why a test of an archive block revision stands where the review stage has
 already read it.
 */
const DECIDED_REMOVAL = 'an archive block revision after `runArchiveBlockReviewStage` has read one that shows a '
  + 'reader nothing as the empty removal, so the empty string is the decided removal';

/**
 Why a test of an audit finding's focus stands.
 */
const AUDIT_FOCUS = 'the focus one side of an audit finding rests on, returned empty for a side that anchored none; '
  + 'the anchor (`rendering-audit-anchor.ts`) anchors no focus that shows a reader nothing';

/**
 Why a test of an editor width arm's text stands.
 */
const WIDTH_ARM = 'the text an editor width arm shipped, which the trial writes empty when the arm shipped none';

/**
 Each blankness test the package makes, as `path#site`, with how many there
 are and why `rendersAsNothing` is not the question there.
 */
const HELD_TESTS: Readonly<Record<string, {
  readonly tests: number;
  readonly why: string;
}>> = {
  'absolute-naturalness-review-stage.ts#summarizeSeat': {
    tests: 2,
    why: ASSEMBLED,
  },
  'adjudicate-prompt.ts#buildAdjudicationMessages': {
    tests: 3,
    why: ASSEMBLED,
  },
  'anthropic-completion.ts#extractAnthropicCompletion': {
    tests: 3,
    why: 'a payload line and a stop reason of the provider\'s protocol, and the prose beside a tool answer, '
      + 'compared only to log how much of it was set aside; whether the tool answered is asked of '
      + '`rendersAsNothing`',
  },
  'anthropic-completion.ts#foldMessageDelta': {
    tests: 1,
    why: PROTOCOL,
  },
  'anthropic-delta-scan.ts#readDelta': {
    tests: 1,
    why: DELTA,
  },
  'anthropic-delta-scan.ts#readLine': {
    tests: 1,
    why: PROTOCOL,
  },
  'anthropic-tool.ts#renderToolSystemPrompt': {
    tests: 1,
    why: ASSEMBLED,
  },
  'anthropic-whole-message.ts#framesOf': {
    tests: 1,
    why: PROTOCOL,
  },
  'anthropic-whole-message.ts#isProtocolWord': {
    tests: 1,
    why: PROTOCOL,
  },
  'archive-block-review-wire.ts#buildArchiveBlockReviewMessages': {
    tests: 1,
    why: ASSEMBLED,
  },
  'archive-block-review-wire.ts#isWritten': {
    tests: 1,
    why: ASSEMBLED,
  },
  'archive-replacement-candidates.ts#replacementCandidates': {
    tests: 1,
    why: DECIDED_REMOVAL,
  },
  'archive-revision-shape.ts#revisionShapeFindings': {
    tests: 1,
    why: DECIDED_REMOVAL,
  },
  'ascii-letters.ts#isAsciiDigits': {
    tests: 1,
    why: SCANNER,
  },
  'assembly-container-halves.ts#carriesText': {
    tests: 1,
    why: 'a replacement at a slice the archive never translated, where the empty string is how a half '
      + 'ships nothing; the translate lane decides no wording there that shows a reader nothing '
      + '(`assertAbsentSliceFilled`), and `spliceSlices` asks `rendersAsNothing` again',
  },
  'assembly-orphan-trim.ts#isDefinition': {
    tests: 1,
    why: SENTINEL,
  },
  'assembly-orphan-trim.ts#isGone': {
    tests: 1,
    why: SENTINEL,
  },
  'assembly-orphan-trim.ts#isProse': {
    tests: 1,
    why: SENTINEL,
  },
  'assembly-orphan-trim.ts#keep': {
    tests: 4,
    why: 'a footnote label a helper returns empty for a block that is no definition, and the gap and text '
      + 'the function itself is putting together',
  },
  'assembly-orphan-trim.ts#walkLine': {
    tests: 2,
    why: 'a blank line by the markup\'s own grammar, and a footnote label a helper returns empty for a line '
      + 'that is no definition',
  },
  'assembly-repetition.ts#whitespaceTokensOf': {
    tests: 1,
    why: SCANNER,
  },
  'bedrock-ledger.ts#bedrockCreditUsdFrom': {
    tests: 1,
    why: SETTING,
  },
  'bedrock-ledger.ts#bedrockLedgerPathFrom': {
    tests: 1,
    why: SETTING,
  },
  'bedrock-ledger.ts#toEntry': {
    tests: 1,
    why: RECORD,
  },
  'bedrock-stream-end.ts#isUsageChunk': {
    tests: 1,
    why: PROTOCOL,
  },
  'bilingual-pair-bound.ts#nonEmpty': {
    tests: 1,
    why: SCANNER,
  },
  'bilingual-pair-bound.ts#pairBoundFindings': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'candidate-ledger.ts#recordContest': {
    tests: 1,
    why: SETTING,
  },
  'candidate-select-wire.ts#isCanonicalIndexText': {
    tests: 1,
    why: 'the text of a ballot\'s quoted index, asked whether it spells a whole number; the empty text is '
      + 'none, and any invisible character fails the digit test that follows',
  },
  'chat-json-outcome.ts#readJsonOutcome': {
    tests: 2,
    why: SENTINEL,
  },
  'cited-reference-fetch.ts#failureOf': {
    tests: 1,
    why: TOOL,
  },
  'cited-reference-fetch.ts#fetchedOf': {
    tests: 3,
    why: TOOL,
  },
  'cited-reference-lookup.ts#citedReferenceBlock': {
    tests: 1,
    why: SETTING,
  },
  'cited-reference-lookup.ts#referenceLineOf': {
    tests: 2,
    why: TOOL,
  },
  'cited-reference-rule.ts#citedReferenceBlockText': {
    tests: 1,
    why: ASSEMBLED,
  },
  'cited-reference-rule.ts#citedReferenceCandidateLines': {
    tests: 1,
    why: ASSEMBLED,
  },
  'cited-reference-rule.ts#citedReferenceEvidence': {
    tests: 1,
    why: ASSEMBLED,
  },
  'cited-reference-scan.ts#hasContent': {
    tests: 1,
    why: SCANNER,
  },
  'code-points.ts#codePointCount': {
    tests: 1,
    why: 'a loop bound over the text being counted, no test of whether it is blank',
  },
  'community-glossary.ts#departuresOf': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'completion-shape.ts#readFinishReason': {
    tests: 1,
    why: PROTOCOL,
  },
  'consolidate-driver.ts#consolidateInContext': {
    tests: 3,
    why: ASSEMBLED,
  },
  'consolidate-gate-wire.ts#buildConsolidateGateMessages': {
    tests: 1,
    why: ASSEMBLED,
  },
  'consolidate-gate-wire.ts#hasPolicy': {
    tests: 1,
    why: ASSEMBLED,
  },
  'consolidate-key.ts#consolidateRunShape': {
    tests: 1,
    why: ASSEMBLED,
  },
  'consolidate-key.ts#consolidateSliceKey': {
    tests: 4,
    why: ASSEMBLED,
  },
  'consolidate-settle-context.ts#settlementContextOf': {
    tests: 3,
    why: ASSEMBLED,
  },
  'consolidate-settle.ts#settleConsolidation': {
    tests: 1,
    why: STANDING,
  },
  'consolidate-slice-buy.ts#buyConsolidationAttempt': {
    tests: 1,
    why: STANDING,
  },
  'consolidate-standing-verdict.ts#readStandingVerdict': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'consolidate-wire.ts#buildConsolidateMessages': {
    tests: 2,
    why: ASSEMBLED,
  },
  'consolidate-wire.ts#isDisplayed': {
    tests: 1,
    why: 'a lane\'s candidate on the producer sheet, which the package passes empty for a lane that wrote '
      + 'none',
  },
  'consolidate-wire.ts#isPresent': {
    tests: 1,
    why: ASSEMBLED,
  },
  'consolidate-wire.ts#renderBlock': {
    tests: 1,
    why: ASSEMBLED,
  },
  'consolidation-polish-gate-wire.ts#buildConsolidationPolishGateMessages': {
    tests: 1,
    why: ASSEMBLED,
  },
  'consolidation-polish-gate-wire.ts#hasRule': {
    tests: 1,
    why: ASSEMBLED,
  },
  'consolidation-polish-round.ts#present': {
    tests: 1,
    why: ASSEMBLED,
  },
  'container-integrity.ts#nameOf': {
    tests: 1,
    why: PARSED,
  },
  'contributor-name-authority.ts#carriesNames': {
    tests: 1,
    why: PARSED,
  },
  'contributor-name-authority.ts#contributorDeclarationLines': {
    tests: 2,
    why: PARSED,
  },
  'contributor-name-authority.ts#nonempty': {
    tests: 1,
    why: PARSED,
  },
  'corpus-name-index.ts#nonEmpty': {
    tests: 1,
    why: PARSED,
  },
  'corpus-run/archive-block-repair.ts#repairArchiveBlocks': {
    tests: 1,
    why: DECIDED_REMOVAL,
  },
  'corpus-run/archive-italic-spans.ts#titleLike': {
    tests: 1,
    why: PARSED,
  },
  'corpus-run/archive-italic-title-restore.ts#isTitleInProse': {
    tests: 1,
    why: SENTINEL,
  },
  'corpus-run/archive-stub.ts#stripStubMarkersWithOrigins': {
    tests: 3,
    why: SCANNER,
  },
  'corpus-run/artifact-generation.ts#censusByGeneration': {
    tests: 1,
    why: RECORD,
  },
  'corpus-run/artifact-placement.ts#readPlacement': {
    tests: 1,
    why: RECORD,
  },
  'corpus-run/artifact-pool.ts#resolvePool': {
    tests: 4,
    why: 'a required commit read from the environment, and the full id the function resolved it to, which '
      + 'it leaves empty when none was required',
  },
  'corpus-run/artifact-provenance.ts#assertArtifactProvenance': {
    tests: 2,
    why: RECORD,
  },
  'corpus-run/artifact-two-lane-read-naturalness-seat.ts#parseFinding': {
    tests: 1,
    why: 'a finding stored in an artifact, held to the empty-string rule the record was written under; the '
      + 'wire guard asks `rendersAsNothing` before a finding is ever stored',
  },
  'corpus-run/artifact-two-lane-read-naturalness-seat.ts#parseNaturalnessReviewSeat': {
    tests: 1,
    why: RECORD,
  },
  'corpus-run/artifact-two-lane-rebuild-rows.ts#carveDivergence': {
    tests: 1,
    why: SENTINEL,
  },
  'corpus-run/artifact-two-lane-rebuild.ts#rebuildPreparation': {
    tests: 1,
    why: SENTINEL,
  },
  'corpus-run/attribution-line.ts#readSignature': {
    tests: 1,
    why: 'whether any name span stands between a signature\'s dashes and its end mark; a span that shows a '
      + 'reader nothing is still where the signer belongs, the name restore writes the signer\'s rendering '
      + 'into it, and `nameAuthorities` asks `rendersAsNothing` before a page name becomes a rendering',
  },
  'corpus-run/attribution-read.ts#attributionEntryOf': {
    tests: 1,
    why: RECORD,
  },
  'corpus-run/audit-sensitivity.ts#meetsOracle': {
    tests: 1,
    why: AUDIT_FOCUS,
  },
  'corpus-run/audit-sensitivity.ts#reportVoice': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/audit-sensitivity.ts#shownText': {
    tests: 1,
    why: AUDIT_FOCUS,
  },
  'corpus-run/blockquote-paragraphs.ts#blockquoteParagraphs': {
    tests: 2,
    why: SCANNER,
  },
  'corpus-run/blockquote-quote-unify.ts#wraps': {
    tests: 1,
    why: SCANNER,
  },
  'corpus-run/budget-sample.ts#sampleBudgets': {
    tests: 8,
    why: SETTING,
  },
  'corpus-run/cache-account-audit.ts#listed': {
    tests: 1,
    why: TOOL,
  },
  'corpus-run/cache-account-audit.ts#written': {
    tests: 1,
    why: TOOL,
  },
  'corpus-run/cache-account-commits.ts#sourceCommitOf': {
    tests: 1,
    why: TOOL,
  },
  'corpus-run/canadian-date-parts.ts#monthStartsName': {
    tests: 1,
    why: SCANNER,
  },
  'corpus-run/canadian-date-parts.ts#readDay': {
    tests: 1,
    why: SCANNER,
  },
  'corpus-run/canadian-spelling-capital.ts#hasLetter': {
    tests: 1,
    why: SCANNER,
  },
  'corpus-run/canadian-spelling-context.ts#isTokenCharacter': {
    tests: 2,
    why: SCANNER,
  },
  'corpus-run/cap-census-read.ts#endsField': {
    tests: 1,
    why: RECORD,
  },
  'corpus-run/cap-override.ts#resolveHardCapMinutes': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/command-flags.ts#isNamed': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/command-line.ts#optionReading': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/corpus-pass.ts#runCorpusPass': {
    tests: 4,
    why: ASSEMBLED,
  },
  'corpus-run/corpus-pin-override.ts#readCorpusPinSetting': {
    tests: 6,
    why: SETTING,
  },
  'corpus-run/coverage-census-commit.ts#named': {
    tests: 1,
    why: TOOL,
  },
  'corpus-run/coverage-census-commit.ts#packageCommit': {
    tests: 1,
    why: TOOL,
  },
  'corpus-run/coverage-census-input.ts#readBaselineCensus': {
    tests: 1,
    why: RECORD,
  },
  'corpus-run/coverage-census-print.ts#outermostInPackage': {
    tests: 1,
    why: TOOL,
  },
  'corpus-run/coverage-control-decoy.ts#isLocatable': {
    tests: 1,
    why: 'a span the decoy cut keeps clear of, where an empty one has no place in the text; `tryCase` '
      + 'throws on a span that shows a reader nothing before any decoy is cut',
  },
  'corpus-run/coverage-control.ts#tryCase': {
    tests: 1,
    why: SENTINEL,
  },
  'corpus-run/directory-id-name.ts#fits': {
    tests: 1,
    why: PARSED,
  },
  'corpus-run/directory-id-name.ts#isId': {
    tests: 1,
    why: PARSED,
  },
  'corpus-run/directory-id-name.ts#isOtherRendering': {
    tests: 1,
    why: PARSED,
  },
  'corpus-run/directory-id-name.ts#nonEmpty': {
    tests: 1,
    why: PARSED,
  },
  'corpus-run/directory-id-name.ts#readsAs': {
    tests: 1,
    why: PARSED,
  },
  'corpus-run/displacement-probe.ts#main': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/dropped-destinations.ts#markdownDestinations': {
    tests: 1,
    why: 'a link\'s destination, an address and no wording, where an empty one leads nowhere a page could '
      + 'owe',
  },
  'corpus-run/editor-calibrate.ts#main': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/editor-width-control.ts#damageable': {
    tests: 1,
    why: SENTINEL,
  },
  'corpus-run/editor-width-model.ts#classifyWidths': {
    tests: 2,
    why: WIDTH_ARM,
  },
  'corpus-run/editor-width-slice.ts#runWidthSlice': {
    tests: 2,
    why: WIDTH_ARM,
  },
  'corpus-run/env-text-setting.ts#textSettingOf': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/handle-gloss-place.ts#carriesGloss': {
    tests: 1,
    why: 'an appearance\'s gloss after `appearancesIn` has read a parenthesis that shows a reader nothing '
      + 'as none, so the empty string is the decided absence',
  },
  'corpus-run/heading-title-lines.ts#titleOf': {
    tests: 1,
    why: 'the title a helper returns empty for a line that is no HTML heading; whether a heading\'s '
      + 'rendering shows a reader anything is asked of `rendersAsNothing` where a rendering is taken from '
      + 'it (`title-reference-unify.ts`)',
  },
  'corpus-run/insertion-carried-anchor.ts#abutting': {
    tests: 1,
    why: PARSED,
  },
  'corpus-run/markup-slice.ts#hasContent': {
    tests: 1,
    why: SCANNER,
  },
  'corpus-run/meter-report.ts#spanText': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/model-catalog-compare.ts#classify': {
    tests: 2,
    why: TOOL,
  },
  'corpus-run/model-catalog.ts#main': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/name-gloss-restore.ts#readGlossLine': {
    tests: 1,
    why: PARSED,
  },
  'corpus-run/ordinal-style.ts#filled': {
    tests: 1,
    why: SCANNER,
  },
  'corpus-run/ordinal-style.ts#renderOrdinal': {
    tests: 1,
    why: SENTINEL,
  },
  'corpus-run/pass-attest-references.ts#attestPassReferences': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/pass-entry-persist.ts#printSettledLines': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/pass-page-titles.ts#passPageTitles': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/pass-prepare.ts#isLine': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/pass-prepare.ts#prepareOver': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/pass-prepare.ts#preparePassEntry': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/pool-generation.ts#isKnown': {
    tests: 1,
    why: RECORD,
  },
  'corpus-run/process-identity.ts#startTicksOf': {
    tests: 1,
    why: TOOL,
  },
  'corpus-run/prose-ranges.ts#pastConstruct': {
    tests: 2,
    why: SCANNER,
  },
  'corpus-run/published-page-check.ts#filledAnAnchor': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'corpus-run/quote-style-unify.ts#unifyQuoteStyle': {
    tests: 1,
    why: SENTINEL,
  },
  'corpus-run/rendering-audit-settled-buy.ts#readPage': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/rendering-audit-settled-digest.ts#digestAuditedText': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/rendering-audit-settled-report.ts#main': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/required-providers.ts#assertRequiredProvidersReady': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/roster-card-ask.ts#readAsk': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/roster-card.ts#fetchListing': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/run-config.ts#resolveRunsDir': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/run-providers.ts#configureProviders': {
    tests: 9,
    why: SETTING,
  },
  'corpus-run/run-timing-parse.ts#countIn': {
    tests: 1,
    why: RECORD,
  },
  'corpus-run/run-timing-parse.ts#readCallTiming': {
    tests: 2,
    why: RECORD,
  },
  'corpus-run/runner-closure.ts#readRunnerClosure': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/runner-closure.ts#scanFor': {
    tests: 1,
    why: SCANNER,
  },
  'corpus-run/score-crosscheck.ts#isSet': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/sentinel-probe.ts#probeCorpusEntries': {
    tests: 1,
    why: ASSEMBLED,
  },
  'corpus-run/sheet-path.ts#isSeedSafe': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/slice-cache-namespace.ts#belongsToNamespace': {
    tests: 1,
    why: SENTINEL,
  },
  'corpus-run/slice-cache-namespace.ts#discardNamespace': {
    tests: 1,
    why: RECORD,
  },
  'corpus-run/slice-cache-namespace.ts#isNamed': {
    tests: 1,
    why: SENTINEL,
  },
  'corpus-run/slice-census-entry.ts#censusEntry': {
    tests: 1,
    why: SENTINEL,
  },
  'corpus-run/slice-cost-report.ts#main': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/slice-overlap.ts#readOverlapSetting': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/spend-ceiling.ts#resolveSpendCeilingUsd': {
    tests: 1,
    why: SETTING,
  },
  'corpus-run/spend-read.ts#readSpendLine': {
    tests: 1,
    why: RECORD,
  },
  'corpus-run/spend-read.ts#usdOf': {
    tests: 1,
    why: RECORD,
  },
  'corpus-run/title-reference-rewrite.ts#nonEmpty': {
    tests: 1,
    why: SCANNER,
  },
  'corpus-run/title-reference-rewrite.ts#rewriteLocated': {
    tests: 1,
    why: 'whether the small-letter words leading into a glossed run used the whole run up; what is left is '
      + 'replaced by the heading\'s rendering whatever it shows, so a remainder that shows a reader '
      + 'nothing is written over with the title',
  },
  'corpus-run/title-reference-scope.ts#framedPageLine': {
    tests: 2,
    why: SENTINEL,
  },
  'corpus-run/window-trial-ledger.ts#endAtLineBoundary': {
    tests: 2,
    why: RECORD,
  },
  'corpus-run/window-trial-ledger.ts#toPlaced': {
    tests: 1,
    why: RECORD,
  },
  'corpus-run/window-trial-slice.ts#runSliceArms': {
    tests: 1,
    why: PARSED,
  },
  'corpus-run/would-ship-text.ts#archiveStandsOr': {
    tests: 1,
    why: RECORD,
  },
  'corpus-run/would-ship-text.ts#lanesAgreedOn': {
    tests: 1,
    why: RECORD,
  },
  'corpus-source.ts#nonEmpty': {
    tests: 1,
    why: TOOL,
  },
  'coverage-wire.ts#buildCoverageMessages': {
    tests: 1,
    why: ASSEMBLED,
  },
  'critic-prompt.ts#buildCriticMessages': {
    tests: 2,
    why: ASSEMBLED,
  },
  'declared-identity-rule.ts#declaredNamesBlock': {
    tests: 1,
    why: ASSEMBLED,
  },
  'declared-names-evidence.ts#declaredNamesEvidence': {
    tests: 1,
    why: ASSEMBLED,
  },
  'delivery-coherence.ts#assertDeliveryCoherent': {
    tests: 2,
    why: RECORD,
  },
  'derive-seeds.ts#splitSentences': {
    tests: 1,
    why: SCANNER,
  },
  'disputed-wording.ts#disputedWordingFindings': {
    tests: 1,
    why: 'a candidate with its whitespace taken out, asked whether any character is left to search for a '
      + 'disputed wording; an invisible one is searched and holds none',
  },
  'document-preparation.ts#prepareDocumentPair': {
    tests: 1,
    why: ASSEMBLED,
  },
  'edit-prompt.ts#buildEditorMessages': {
    tests: 3,
    why: ASSEMBLED,
  },
  'edit-prompt.ts#isPresent': {
    tests: 1,
    why: ASSEMBLED,
  },
  'edit-prompt.ts#regionBlock': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'entry-notes.ts#isWhitespace': {
    tests: 1,
    why: SCANNER,
  },
  'fidelity-damage.ts#alterSharedNumber': {
    tests: 2,
    why: SENTINEL,
  },
  'fidelity-damage.ts#deleteOneSentence': {
    tests: 2,
    why: 'a sentence a helper returns empty when the slice offers none, and the archive text left once the '
      + 'control has cut that sentence',
  },
  'fidelity-damage.ts#insertBorrowedSentence': {
    tests: 2,
    why: SENTINEL,
  },
  'fidelity-damage.ts#isUsable': {
    tests: 1,
    why: SENTINEL,
  },
  'fidelity-reference-build.ts#buildReviewedFidelityReference': {
    tests: 2,
    why: PARSED,
  },
  'fidelity-reference-read.ts#readReference': {
    tests: 1,
    why: PARSED,
  },
  'fidelity-reference-request.ts#blankIdentity': {
    tests: 1,
    why: SETTING,
  },
  'fidelity-reference-text.ts#applyReviewedEdits': {
    tests: 2,
    why: PARSED,
  },
  'fidelity-window-positions.ts#fidelityWindowPositions': {
    tests: 1,
    why: PARSED,
  },
  'fidelity-window.ts#present': {
    tests: 2,
    why: PARSED,
  },
  'footnote-graph.ts#collectRegionHits': {
    tests: 1,
    why: SCANNER,
  },
  'footnote-graph.ts#scanFullwidthMarkers': {
    tests: 1,
    why: SCANNER,
  },
  'footnote-identifier.ts#carriesText': {
    tests: 1,
    why: SCANNER,
  },
  'footnote-mentions.ts#opensDefinition': {
    tests: 1,
    why: SCANNER,
  },
  'footnote-rewrite-map.ts#footnoteRewriteMap': {
    tests: 1,
    why: EMPTY_NEEDLE,
  },
  'footnote-url-spans.ts#endsUrl': {
    tests: 1,
    why: SCANNER,
  },
  'footnote-url-spans.ts#mayPrecedeLiteral': {
    tests: 1,
    why: SCANNER,
  },
  'front-matter-comment-authority.ts#contributorAttribution': {
    tests: 1,
    why: PARSED,
  },
  'front-matter-comment-authority.ts#locationComment': {
    tests: 1,
    why: PARSED,
  },
  'front-matter-translation.ts#validateFrontMatterTranslation': {
    tests: 1,
    why: 'what a front matter candidate writes outside its metadata block, where anything but whitespace, '
      + 'an invisible character included, is text shipped outside the block and is refused',
  },
  'glossary-match.ts#isSpaceLike': {
    tests: 1,
    why: SCANNER,
  },
  'glossary-match.ts#occurrenceStarts': {
    tests: 1,
    why: EMPTY_NEEDLE,
  },
  'grace-override.ts#adoptCalibrationGrace': {
    tests: 1,
    why: SETTING,
  },
  'grace-override.ts#readWindowDial': {
    tests: 1,
    why: SETTING,
  },
  'grade-sheet-read.ts#headedWords': {
    tests: 1,
    why: RECORD,
  },
  'handle-token.ts#carriesHandleToken': {
    tests: 1,
    why: EMPTY_NEEDLE,
  },
  'identity-context.ts#isDeclared': {
    tests: 1,
    why: PARSED,
  },
  'identity-han-items.ts#nonEmpty': {
    tests: 1,
    why: PARSED,
  },
  'image-reading-pair.ts#stated': {
    tests: 1,
    why: ASSEMBLED,
  },
  'image-reading-sense.ts#solidCharacters': {
    tests: 1,
    why: SCANNER,
  },
  'image-reading-stage.ts#readImageAsset': {
    tests: 1,
    why: 'a reply of no characters, which the log names an empty reply; one that shows a reader nothing '
      + 'and is not empty is refused as too short by `readingMakesSense`, and either way the picture '
      + 'stays unread',
  },
  'inline-container-tags.ts#scan': {
    tests: 1,
    why: SCANNER,
  },
  'insertion-separator.ts#composeInsertion': {
    tests: 4,
    why: 'the join of the fragments that say something, empty exactly when none did, and the archive text '
      + 'either side of the boundary; each fragment is asked of `rendersAsNothing` before the join',
  },
  'inspect-paragraph.ts#inspectParagraph': {
    tests: 1,
    why: ASSEMBLED,
  },
  'introduced-defect-probe.ts#runIntroducedDefectProbe': {
    tests: 1,
    why: ASSEMBLED,
  },
  'introduced-defect-screen.ts#isUsable': {
    tests: 1,
    why: 'KNOWN GAP, in a file this scan\'s change could not edit: a prior quote is dropped only when the '
      + 'screen\'s fold leaves it empty, so one of a single invisible character, read from a stored issue, '
      + 'is kept; the question is `rendersAsNothing`, and fixing it removes this entry',
  },
  'introduced-defect-screen.ts#restatesPriorIssue': {
    tests: 1,
    why: 'a claim\'s quote as the screen folded it, thrown on when empty since an empty quote sits inside '
      + 'every prior quote; the screen asks `rendersAsNothing` of each side before this reader runs',
  },
  'introduced-defect-wire.ts#buildIntroducedDefectMessages': {
    tests: 3,
    why: ASSEMBLED,
  },
  'judge-fidelity.ts#runFidelityTrial': {
    tests: 1,
    why: ASSEMBLED,
  },
  'lane-contest-key.ts#laneContestRunShape': {
    tests: 1,
    why: ASSEMBLED,
  },
  'lane-contest-stage.ts#contestLaneSlice': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'lane-contest-wire.ts#buildLaneContestMessages': {
    tests: 1,
    why: ASSEMBLED,
  },
  'lane-contest-wire.ts#hasPolicy': {
    tests: 1,
    why: ASSEMBLED,
  },
  'licensed-quotes.ts#isUsable': {
    tests: 1,
    why: 'the quoted text of a claim\'s anchored span, the document\'s own slice, empty at an insertion '
      + 'point; `locateQuote` anchors no quote that shows a reader nothing',
  },
  'line-structure-addendum.ts#isPresent': {
    tests: 1,
    why: ASSEMBLED,
  },
  'linked-title-declared-name.ts#differs': {
    tests: 1,
    why: PARSED,
  },
  'linked-title-declared-name.ts#nonEmpty': {
    tests: 1,
    why: PARSED,
  },
  'log-context.ts#isNamed': {
    tests: 2,
    why: ASSEMBLED,
  },
  'log-context.ts#laneSliceText': {
    tests: 1,
    why: ASSEMBLED,
  },
  'lookup-cache.ts#lookupCacheDir': {
    tests: 1,
    why: SETTING,
  },
  'lookup-cache.ts#packageCacheDir': {
    tests: 1,
    why: SETTING,
  },
  'markup-atom-scan.ts#isFootnoteLabel': {
    tests: 2,
    why: SCANNER,
  },
  'markup-atom-scan.ts#tagEnd': {
    tests: 1,
    why: SCANNER,
  },
  'mdx-tag-start.ts#opensMdxTag': {
    tests: 1,
    why: SCANNER,
  },
  'name-projection.ts#carriesName': {
    tests: 1,
    why: EMPTY_NEEDLE,
  },
  'nested-single-quotes.ts#opensAfter': {
    tests: 1,
    why: SCANNER,
  },
  'nested-single-quotes.ts#singleShape': {
    tests: 1,
    why: SCANNER,
  },
  'openrouter-endpoint.ts#nameOf': {
    tests: 1,
    why: PROTOCOL,
  },
  'openrouter-error-finish.ts#openRouterErrorFinishOf': {
    tests: 1,
    why: PROTOCOL,
  },
  'page-name-glossary.ts#toPair': {
    tests: 1,
    why: PARSED,
  },
  'page-title-lexicon-wire.ts#buildPageTitleLexiconMessages': {
    tests: 1,
    why: ASSEMBLED,
  },
  'pair-blocks-wire.ts#buildBlockPairingMessages': {
    tests: 2,
    why: ASSEMBLED,
  },
  'photo-reference.ts#assetNameOf': {
    tests: 1,
    why: PARSED,
  },
  'prepare-block-pairing.ts#prepareBlockPairing': {
    tests: 1,
    why: ASSEMBLED,
  },
  'preservation-check.ts#blank': {
    tests: 1,
    why: EMPTY_NEEDLE,
  },
  'producer-silence.ts#coverageGapLines': {
    tests: 3,
    why: ASSEMBLED,
  },
  'quote-depth-clamp.ts#clampLine': {
    tests: 1,
    why: SCANNER,
  },
  'quote-line.ts#carriesContent': {
    tests: 1,
    why: SCANNER,
  },
  'quote-line.ts#pastQuoteMarkers': {
    tests: 1,
    why: SCANNER,
  },
  'reading-corroboration.ts#collapsedWhitespace': {
    tests: 1,
    why: SCANNER,
  },
  'reading-refusal.ts#readsAsRefusal': {
    tests: 1,
    why: 'a length bound on a picture reading, past which it is no refusal sentence; no test of whether it '
      + 'is blank',
  },
  'reference-line-head.ts#numberedReferenceLines': {
    tests: 1,
    why: ASSEMBLED,
  },
  'reference-line-head.ts#pageText': {
    tests: 1,
    why: SENTINEL,
  },
  'refine-slice-key.ts#refineRunShape': {
    tests: 1,
    why: ASSEMBLED,
  },
  'refine-slice-key.ts#refineSliceKey': {
    tests: 2,
    why: ASSEMBLED,
  },
  'rendered-break-prompt.ts#renderedBreakPrompt': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'rendering-audit-prompt.ts#buildRenderingAuditMessages': {
    tests: 2,
    why: ASSEMBLED,
  },
  'repair-chunk.ts#repairChunk': {
    tests: 1,
    why: ASSEMBLED,
  },
  'repair-selection-evidence.ts#repairSelectionSourceEvidence': {
    tests: 2,
    why: ASSEMBLED,
  },
  'repair-sheet.ts#renderRegion': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'repair-slice-buy.ts#repairUnderSignal': {
    tests: 1,
    why: ASSEMBLED,
  },
  'repair-slice-key.ts#repairRunShape': {
    tests: 1,
    why: ASSEMBLED,
  },
  'repair-slice-key.ts#repairSliceKey': {
    tests: 3,
    why: ASSEMBLED,
  },
  'request-pace.ts#hyperRequestsPerHour': {
    tests: 1,
    why: SETTING,
  },
  'resolution-wire.ts#buildResolutionMessages': {
    tests: 2,
    why: ASSEMBLED,
  },
  'sheet-binding.ts#assertSheetMatchesManifest': {
    tests: 1,
    why: RECORD,
  },
  'sheet-binding.ts#requireSheetSeed': {
    tests: 1,
    why: RECORD,
  },
  'sheet-line-text.ts#flattenSpace': {
    tests: 1,
    why: SCANNER,
  },
  'slice-cost-read.ts#spelledAs': {
    tests: 1,
    why: RECORD,
  },
  'source-break-display.ts#sourceBreakDisplay': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'source-only-breaks.ts#sourceOnlyBreakFindings': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'stream-completion.ts#extractStreamedCompletion': {
    tests: 1,
    why: PROTOCOL,
  },
  'stream-completion.ts#foldChunk': {
    tests: 1,
    why: DELTA,
  },
  'stream-cut.ts#reportStreamProgress': {
    tests: 1,
    why: PROTOCOL,
  },
  'stream-degeneration.ts#watchForDegeneration': {
    tests: 1,
    why: DELTA,
  },
  'stream-delta-scan.ts#readLine': {
    tests: 4,
    why: 'a payload line and a served-by name of the provider\'s protocol, and one frame\'s content and '
      + 'reasoning deltas, where an empty delta adds nothing and any other is part of the reply',
  },
  'stream-delta-scan.ts#reasoningField': {
    tests: 1,
    why: DELTA,
  },
  'stream-recurrence-watch.ts#watchForRecurrence': {
    tests: 1,
    why: DELTA,
  },
  'translate-community-term.ts#findingsFor': {
    tests: 1,
    why: SENTINEL,
  },
  'translate-floor-ground.ts#readFrontMatterGround': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'translate-quote-balance.ts#isBlank': {
    tests: 1,
    why: SCANNER,
  },
  'translate-sheet-leak.ts#fencedLabel': {
    tests: 1,
    why: 'whether a line\'s two fence runs leave any character between them; whether what lies between is a '
      + 'label is asked of `rendersAsNothing`',
  },
  'translate-signer-handle.ts#findingsAt': {
    tests: 1,
    why: SENTINEL,
  },
  'translate-skeleton-page.ts#readPageSkeleton': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'translate-slate-evidence.ts#translateSlateEvidence': {
    tests: 5,
    why: ASSEMBLED,
  },
  'translate-slice-key.ts#translateRunShape': {
    tests: 1,
    why: ASSEMBLED,
  },
  'translate-slice-key.ts#translateSliceKey': {
    tests: 4,
    why: ASSEMBLED,
  },
  'translate-slice.ts#settleTranslateSlice': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'translate-untranslated.ts#withoutWhitespace': {
    tests: 1,
    why: SCANNER,
  },
  'translate-validate-blocks.ts#describeBlock': {
    tests: 1,
    why: SENTINEL,
  },
  'translate-wire.ts#buildTranslateMessages': {
    tests: 5,
    why: 'blocks the package assembled for the sheet, written empty when it has none, and the archive text '
      + 'of the slice, empty where the archive holds nothing',
  },
  'translate-wire.ts#isPresent': {
    tests: 1,
    why: ASSEMBLED,
  },
  'translated-slate-criteria.ts#translatedSlateCriteria': {
    tests: 1,
    why: ASSEMBLED,
  },
  'unwrap-container.ts#UnpositionedContainerError': {
    tests: 1,
    why: PARSED,
  },
  'word-bounds.ts#tokenStarts': {
    tests: 1,
    why: EMPTY_NEEDLE,
  },
  'word-bounds.ts#wordStarts': {
    tests: 1,
    why: EMPTY_NEEDLE,
  },
  'wording-coherence.ts#assertWordingCoherent': {
    tests: 1,
    why: ARCHIVE_ABSENT,
  },
  'work-title-lookup.ts#toLine': {
    tests: 1,
    why: TOOL,
  },
  'work-title-lookup.ts#workTitleLookupLines': {
    tests: 1,
    why: SETTING,
  },
  'writer-grace-override.ts#readWriterGrace': {
    tests: 1,
    why: SETTING,
  },
};

//endregion Listed tests

await describe({
  name: 'blank-text tests (ledgers B40 and B128)',
  children: [
    it({
      name: 'FINDS a comparison with the empty string written as a string or a template, either way round; the '
        + 'length of a trim call or of a name declared with one compared with anything; the length of a name '
        + 'annotated as a string, alone or in a union, compared with zero or asked whether it is less than one, either '
        + 'way round; and each tested for truth; LEAVES an array\'s length, an unannotated name\'s length, a trimmed '
        + 'length in arithmetic, two trims compared with each other, a string\'s length compared with another '
        + 'number, and a test file',
      fn: async () => {
        expect(blankTextTests({
          files: [
            {
              path: 'naps.ts',
              isTest: false,
              text: [
                'export function isQuiet(purr: string,): boolean {',
                '  return purr === \'\';',
                '}',
                'export function isLoud(meow: string,): boolean {',
                '  return `` !== meow;',
                '}',
                'export function naps(note: string,): boolean {',
                '  const trimmed = note.trim();',
                '  return (trimmed.length > 3) || (note.trimEnd().length === 0);',
                '}',
                'export function stirs({ note, tail, }: Readonly<{ readonly note: string; readonly tail: number; }>,): boolean {',
                '  if (note.trimStart())',
                '    return tail > 0;',
                '  return (!note) || (note.length > 0) || (0 === note.length);',
                '}',
                'export function wakes(notes: readonly string[],): string {',
                '  const first: string = notes[0] ?? \'asleep\';',
                '  return first ? first : (first.length === 0 ? \'quiet\' : \'awake\');',
                '}',
                'export class Basket {',
                '  holds(toy: string,): boolean {',
                '    return toy.trim() !== \'\';',
                '  }',
                '}',
                'export const stray = \'\' === [\'mouse\',].join(\'\',);',
                'export function counts(tails: readonly string[], { name, }: { readonly name: string[]; }, toy: string,): boolean {',
                '  const loose = toy.slice(1,);',
                '  return (tails.length === 0) || (name.length === 0) || (loose.length === 0) || (toy.length > 3);',
                '}',
                'export function pads(note: string,): number {',
                '  const trimmed = note.trim();',
                '  return note.length - trimmed.length;',
                '}',
                'export function same(left: string, right: string,): boolean {',
                '  return left.trim() === right.trim();',
                '}',
                'export function sleeps(purr: string, yawn: string | undefined,): boolean {',
                '  return (purr.length < 1) || (1 <= purr.length) || (purr.length > 1) || (!yawn);',
                '}',
              ].join('\n',),
            },
            {
              path: 'naps.unit.test.ts',
              isTest: true,
              text: 'export const quiet = (purr: string,): boolean => purr === \'\';',
            },
          ],
        },),).toEqual({
          'naps.ts#<module>': 1,
          'naps.ts#Basket': 1,
          'naps.ts#isLoud': 1,
          'naps.ts#isQuiet': 1,
          'naps.ts#naps': 2,
          'naps.ts#sleeps': 3,
          'naps.ts#stirs': 4,
          'naps.ts#wakes': 2,
        },);
      },
    },),
    it({
      name: 'FINDS NO BLANKNESS TEST across the package but those named with why each asks another question',
      fn: async () => {
        /**
         Count per key the named tests allow.
         */
        const allowed = Object.fromEntries(Object.entries(HELD_TESTS,)
          .map(function toCount([
            key,
            held,
          ],) {
            return [
              key,
              held.tests,
            ];
          },),);
        expect(blankTextTests({ files: await readPackageSource(), },),).toEqual(allowed,);
      },
    },),
  ],
},);
