/**
 Guards against a map entry written over whatever the key already held,
 without the key being read first (ledger B203 to B210 and the census that
 followed them). A `Map` filled by `set` keeps the later value for a key
 written twice, and nothing says so: a repeated claim id, slice index or
 model id answered for the later element while the earlier one vanished. A
 write the function reads the key before (`get` or `has` on the same map with
 the same key text, to merge, count, refuse or skip a repeat) says what a
 repeat means; a write with no such read has to say, in this file, what makes
 its key unique.

 WHAT THE SCAN READS, in the package's source; tests and test fixtures are not
 read. A call of a method named `set` with two arguments, whose enclosing
 functions, any of them, never hold `<receiver>.get(<key` or
 `<receiver>.has(<key` with the receiver and key written as the call writes
 them, whitespace aside. A write found by it is named by its file, its
 innermost named function, the receiver and the key text, so a line moving
 does not move it. Out of the scan's reach: a read of the key through another
 name or another function, which passes as a read though it may not be one,
 and a key repeated by a loop over data that holds the read in a callee;
 review has to catch those.

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

import {
  childNodes,
  identifierName,
  isTreeNode,
  memberName,
  parseSource,
  readPackageSource,
  type SourceText,
  type TreeNode,
} from './source-scan.test-fixture.ts';

/**
 Node kinds that open a function.
 */
const FUNCTION_KINDS: ReadonlySet<string> = new Set(['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression',],);

/**
 Writes the package makes over a key it never reads, each with what makes the
 key unique at that write. The id is the file, the innermost named function,
 the receiver and the key text; one entry covers every write with that id.
 */
const ALLOWED_BLIND_SETS: ReadonlyMap<string, string> = new Map<string, string>([
  [
    'active-footnote-markers.ts#activeFootnoteMarkers: runReferences.set(run.opener,...)',
    'the key is the tree node that opens a run, and each run of unpositioned text has its own first member',
  ],
  [
    'contributor-name-authority.ts#referenceLinkLabels: labels.set(markup,...)',
    'the label is cut from inside the markup the key is, so two links written alike carry one value',
  ],
  [
    'corpus-run/artifact-eligible.ts#verdictsByTip: verdicts.set(tip,...)',
    'the tips come from a set of the census\'s commits, each asked once',
  ],
  [
    'corpus-run/artifact-generation.ts#censusByGeneration: tipByEntry.set(entryId,...)',
    'an entry id is the stem of an artifact file name, and a directory lists a name once',
  ],
  [
    'corpus-run/assembly-page-text.ts#pageTextBySlice: text.set(replacement.sliceIndex,...)',
    'a replacement supersedes the archive\'s text for its slice on purpose, and `spliceSlices` refuses two replacements naming one slice before any page pass reads the list',
  ],
  [
    'corpus-run/attempt-store.ts#countAttempt: attempts.set(id,...)',
    'the count is read through `attemptsOf` and written back plus one',
  ],
  [
    'corpus-run/command-line.ts#optionsOf: options.set(name,...)',
    'the names are the spec\'s own, and a measurement over every command found none declaring a flag in two groups (42 commands, 31 flags)',
  ],
  [
    'corpus-run/command-line.ts#readCommandLine: values.set(reading.name,...)',
    'a flag written twice is counted in `timesWritten` and refused by `countRefusals` unless it is declared repeatable',
  ],
  [
    'corpus-run/contributor-name-restore.ts#restoreContributorNames: rewritten.set(sliceIndex,...)',
    'one write per slice of a loop over the prepared slices, whose indexes `assertSliceIndexing` holds distinct',
  ],
  [
    'corpus-run/coverage-tally.ts#cut: pieces.set(bundle,...)',
    'the loop reads a map keyed by bundle, and `cut` returns at once when it has run',
  ],
  [
    'corpus-run/coverage-tally.ts#paint: sites.set(key,...)',
    'the key names the bundle, the range and the function, so a repeat is the same site with the same value',
  ],
  [
    'corpus-run/entry-pictures.ts#gather: gathered.set(assetName,...)',
    'the names come from a set of the document\'s pictures, each read once',
  ],
  [
    'corpus-run/insertion-container-blocks.ts#countSide: byPosition.set(position,...)',
    'the position is the loop\'s own place among the prepared slices',
  ],
  [
    'corpus-run/insertion-container-deficit.ts#admitContainerDeficit: admitted.set(position,...)',
    'a row inside two nested carried containers is admitted by each, spends each one\'s deficit because it fills both, and keeps the later container\'s finding, one finding per passage as the TSDoc says',
  ],
  [
    'corpus-run/insertion-container-deficit.ts#spendDeficit: admitted.set(row.position,...)',
    'one row per position among the rows still unresolved, each visited once',
  ],
  [
    'corpus-run/jsx-attribute-restore.ts#restoreJsxAttributes: rewritten.set(sliceIndex,...)',
    'one write per slice of a loop over the prepared slices, whose indexes `assertSliceIndexing` holds distinct',
  ],
  [
    'corpus-run/list-spread-restore.ts#restoreListSpread: rewritten.set(sliceIndex,...)',
    'one write per slice of a loop over the prepared slices, whose indexes `assertSliceIndexing` holds distinct',
  ],
  [
    'corpus-run/pass-seated-pictures.ts#readPictures: priorReadings.set(name,...)',
    'a later reading of a picture supersedes the retained one on purpose, since it was read with the earlier as evidence',
  ],
  [
    'corpus-run/prose-ranges.ts#inlineCodeSpans: spans.set(bodyOffset+nonNullishOrThrow(node.position?.star,...)',
    'two nodes of one tree never open at one offset',
  ],
  [
    'corpus-run/rendering-audit-settled-repeat.ts#rowsBySubject: byKey.set(key,...)',
    'a row naming a subject an earlier row named is refused before this write, by the read of `firstAt` under the same key, a second map this scan does not follow',
  ],
  [
    'corpus-run/slice-cache-namespace.ts#loadNamespacedSlices: resumed.set(key,...)',
    'the key is the file name without its prefix and suffix, which no two names of one directory share, and the file\'s own `cacheKey` must equal it',
  ],
  [
    'document-readings.ts#readDocumentPictures: readings.set(assetName,...)',
    'the names come from a set of the document\'s pictures, each visited once',
  ],
  [
    'footnote-graph.ts#collectBlockHits: runs.set(opened.opener,...)',
    'the key is the tree node that opens a run, and each run of unpositioned text has its own first member',
  ],
  [
    'footnote-unpositioned-runs.ts#zoneByRawOffset: byOffset.set(at,...)',
    'the offset advances through the scan, and each occurrence is paired once',
  ],
  [
    'introduced-defect-screen.ts#resolveProberChecks: checks.set(modelId,...)',
    'the model ids are the own keys of one record, which holds each once',
  ],
  [
    'overlapped-map.ts#drain: failures.set(row.position,...)',
    'a shared cursor hands each row to one lane, and a position names one row',
  ],
  [
    'pairing-pictures.ts#pairingPictureContext: reduced.set(assetName,...)',
    'the loop reads a map keyed by picture name',
  ],
  [
    'prepare-with-pairing.ts#prepareDocumentPairWithRoster: blockPairings.set(pairIndex,...)',
    'the index is the loop\'s own place among the aligned section pairs',
  ],
  [
    'rendering-audit-corroborate.ts#keepDistinct: groups.set(JSON.stringify(textsInCodePointOrder({texts:grou,...)',
    'one group per distinct membership on purpose, and two groups of one membership hold the same voices and defects',
  ],
  [
    'stage-quorum.ts#collectRounds: unreadableSeats.set(outcome.modelId,...)',
    'a later round\'s unreadable answer of a seat replaces the earlier on purpose, and a seat that then answers readably is deleted',
  ],
  [
    'stage-round.ts#askOnce: arrived.set(position,...)',
    'each position is asked once, and the abandoned outcome is written only where the answer did not arrive',
  ],
],);

/**
 Characters of a key's text an id keeps, so a key written as a long expression
 names its write without carrying the expression.
 */
const KEY_TEXT_LENGTH = 48;

/**
 Characters the scan reads as whitespace, which the source's formatter writes
 between tokens.
 */
const WHITESPACE: ReadonlySet<string> = new Set([' ', '\n', '\t', '\r',],);

/**
 Text of a node with its whitespace removed.

 @param file - file the node stands in

 @param node - node read

 @returns The node's text, joined

 @example
 ```ts
 const key = compactText({ file, node: call.arguments[0], },); // 'cat.id'
 ```
 */
function compactText({ file, node, }: { readonly file: SourceText; readonly node: TreeNode; },): string {
  /**
   Characters kept, in order.
   */
  const kept: string[] = [];
  for (const character of file.text.slice(
    node.start,
    node.end,
  )) {
    if (!WHITESPACE.has(character,))
      kept.push(character,);
  }
  return kept.join('',);
}

/**
 Writes a file makes over a key its function never reads.

 @param file - source file read

 @returns One id per such write, without repeats

 @example
 ```ts
 const ids = blindWrites({ file, },);
 ```
 */
function blindWrites({ file, }: { readonly file: SourceText; },): readonly string[] {
  /**
   Ids found so far.
   */
  const found = new Set<string>();
  /**
   Nodes still to visit, each with the functions that hold it, outermost
   first.
   */
  const pending: { readonly node: TreeNode; readonly holders: readonly TreeNode[]; }[] = [{
    node: parseSource({ file, },).program,
    holders: [],
  },];
  while (pending.length > 0) {
    /**
     Node visited now.
     */
    const current = pending.pop() as (typeof pending)[number];
    /**
     Functions holding the node's children.
     */
    const holders = FUNCTION_KINDS.has(current.node.type,)
      ? [...current.holders, current.node,]
      : current.holders;
    pending.push(...childNodes({ node: current.node, },).map(function withHolders(child,) {
      return {
        node: child,
        holders,
      };
    },),);
    /**
     The call's callee, when the node is a call.
     */
    const { callee, } = current.node;
    if ((current.node.type !== 'CallExpression') || (!isTreeNode(callee,)) || (callee.type !== 'MemberExpression'))
      continue;
    /**
     The call's arguments.
     */
    const args = current.node.arguments as readonly TreeNode[];
    if ((memberName({ node: callee, },) !== 'set') || (args.length !== 2) || (!isTreeNode(callee.object,)))
      continue;
    /**
     The map written and the key written, as text.
     */
    const receiver = compactText({
      file,
      node: callee.object,
    },);
    const key = compactText({
      file,
      node: nonNullishArgument({ args, },),
    },);
    /**
     Whether any function holding the write reads the key of the same map.
     */
    const read = holders.some(function readsKey(holder,): boolean {
      /**
       The holder's text, joined.
       */
      const text = compactText({
        file,
        node: holder,
      },);
      return text.includes(`${receiver}.get(${key}`,) || text.includes(`${receiver}.has(${key}`,);
    },);
    if (read)
      continue;
    /**
     Innermost holder that names itself.
     */
    const named = holders.findLast(function hasName(holder,): boolean {
      return identifierName({ node: holder.id, },) !== '';
    },);
    found.add(`${file.path}#${(named === undefined) ? '<module>' : identifierName({ node: named.id, },)}: ${receiver}.set(${key.slice(
      0,
      KEY_TEXT_LENGTH,
    )},...)`,);
  }
  return [...found,].toSorted();
}

/**
 First argument of a two-argument call, which the caller has counted.

 @param args - the call's arguments

 @returns The key argument

 @throws {@link Error} when the call has no argument, which the caller's count excludes

 @example
 ```ts
 const key = nonNullishArgument({ args: call.arguments, },);
 ```
 */
function nonNullishArgument({ args, }: { readonly args: readonly TreeNode[]; },): TreeNode {
  /**
   The first argument.
   */
  const [first,] = args;
  if (first === undefined)
    throw new Error('unreachable: a call counted to hold two arguments holds none',);
  return first;
}

/**
 Writes the package's source makes over a key it never reads.

 @param files - files read, tests among them to be skipped

 @returns Ids of the writes no allowance names, then allowances no write uses

 @example
 ```ts
 const loose = unnamedBlindWrites({ files, },);
 ```
 */
function unnamedBlindWrites({ files, }: { readonly files: readonly SourceText[]; },): readonly string[] {
  /**
   Every blind write in the source, by id.
   */
  const written = files
    .filter(function isSource(file,): boolean {
      return !file.isTest;
    },)
    .flatMap(function blindIn(file,): readonly string[] {
      return blindWrites({ file, },);
    },);
  return [
    ...written
      .filter(function unnamed(id,): boolean {
        return !ALLOWED_BLIND_SETS.has(id,);
      },)
      .map(function unreadWrite(id,): string {
        return `${id}: no allowance says what makes the key unique`;
      },),
    ...[...ALLOWED_BLIND_SETS.keys(),]
      .filter(function stale(id,): boolean {
        return !written.includes(id,);
      },)
      .map(function staleAllowance(id,): string {
        return `${id}: allowed, and no such write stands`;
      },),
  ].toSorted();
}

await describe({
  name: 'map writes over an unread key (ledger B203 to B210)',
  children: [
    it({
      name: 'FINDS a write over a key its function never reads, by file, function, map and key, and leaves a write '
        + 'after a get or a has of the same key, a write read by an outer function, a one-argument set and a '
        + 'bare function named set',
      fn: async () => {
        expect(blindWrites({
          file: {
            path: 'cat.ts',
            text: [
              'export function nap(beds: Map<string, number>, name: string): void { beds.set(name, 1); }',
              'export function purr(beds: Map<string, number>, name: string): void {',
              '  beds.set(name, (beds.get(name) ?? 0) + 1);',
              '}',
              'export function knead(beds: Map<string, number>, name: string): void {',
              '  if (beds.has(name)) return;',
              '  beds.set(name, 1);',
              '}',
              'export function groom(beds: Map<string, number>, names: string[]): void {',
              '  if (beds.has(names[0])) return;',
              '  names.forEach(function each(name: string): void { beds.set(names[0], 1); });',
              '}',
              'export function stretch(beds: Map<string, number>, names: string[]): void {',
              '  names.forEach(function each(name: string): void { beds.set(name, 2); });',
              '}',
              'export function yawn(rugs: Headers, name: string): void { rugs.set(name); }',
              'export function pounce(): void { sets(\'a\', 1); }',
            ].join('\n',),
            isTest: false,
          },
        },),).toEqual([
          'cat.ts#each: beds.set(name,...)',
          'cat.ts#nap: beds.set(name,...)',
        ],);
      },
    },),
    it({
      name: 'FINDS NO MAP WRITE OVER AN UNREAD KEY across the package that no allowance explains, and no allowance '
        + 'for a write that is gone',
      fn: async () => {
        /**
         Every package file, tests among them to be skipped.
         */
        const files = await readPackageSource();
        expect(files.some(function isSource(file,): boolean {
          return !file.isTest;
        },),).toBe(true,);
        expect(unnamedBlindWrites({ files, },),).toEqual([],);
      },
    },),
  ],
},);
