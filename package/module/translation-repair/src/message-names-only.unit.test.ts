/**
 * Guards the claim `messageNamesOnly` makes, by reading the source that makes
 * it.
 *
 * WHAT THE MARKER CLAIMS. `refusalText` repeats the message of any error whose
 * class declares `messageNamesOnly`, and drops the message of every other
 * class. So the marker says: every part of this message is a sentence we wrote,
 * a number this process computed, a name from our own vocabulary, or a value
 * the operator handed in. Never a corpus passage, a run file's contents, a
 * model's answer, or a provider's response body.
 *
 * THE RULE THAT DECIDES WHO MAY CARRY IT. A class may declare the marker when
 * the CLASS writes the sentence. A class whose constructor forwards a `message`
 * parameter to `super` may not, however careful its throw sites are, because
 * the claim would then be about thirty call sites rather than about one class,
 * and nothing here could check it. `StatedRefusalError` is the deliberate
 * exception, and carries its own note saying why.
 *
 * WHY A SOURCE SCAN RATHER THAN A BEHAVIOURAL TEST. Constructing each class and
 * reading its message would pin today's wording, which is not the property
 * worth guarding: rewording a sentence is fine, and interpolating a new value
 * into it is the thing that needs a second look. This reads exactly that, and
 * fails when a marked class's message gains a part the inventory does not name.
 *
 * WHAT IT CANNOT CATCH. A field the inventory already names, such as `detail`,
 * can be handed different text by a new throw site. The inventory records what
 * each field holds today, and a change of that kind is caught by reading, not
 * by this file.
 *
 * @module
 */

import { readdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

//region Marked message inventory

/**
 * Source directory this scan reads, which is the one holding this file.
 */
const SOURCE_DIR = import.meta.dirname;

/**
 * Key naming the byte offset a JSON read reports, or nothing when it has none.
 *
 * SPLIT ACROSS A CONCATENATION so no plain string holds a whole `${}`, which
 * `no-template-curly-in-string` reads as a template literal written by mistake.
 * The halves join to exactly the expression the scan finds in the source.
 */
const BYTE_OFFSET_OR_NOTHING = "(at === OFFSET_UNSTATED) ? '' : ` at byte $"
  + '{String(at,)}`';

/**
 * Every class permitted to declare the marker, with nothing else allowed to.
 *
 * ADDING A NAME HERE IS THE DECISION. The list exists so that marking a class
 * cannot happen quietly inside an unrelated change: this test fails until the
 * name is written down, which is the moment to ask what its message carries.
 */
const MARKED_CLASSES: readonly string[] = [
  'ArtifactParseError',
  'BlankSelectionError',
  'BothProvidersDryError',
  'CheckerIndependenceError',
  'CheckerQuorumError',
  'CorpusReadError',
  'CreditsShapeError',
  'EmptyConversationError',
  'EmptyPoolError',
  'EnvelopeOverlapError',
  'FrontMatterParseError',
  'GenerationDriftError',
  'GradedSheetExistsError',
  'HardCapOverrideError',
  'LedgerShapeError',
  'LegacyPipelineError',
  'MalformedCompletionError',
  'MalformedImageUriError',
  'MdxParseError',
  'MislabelledArtifactError',
  'MixedGenerationError',
  'ModelNotServedError',
  'NoProviderForModelError',
  'OffRosterModelError',
  'PipelineDigestError',
  'PlacementLayoutError',
  'ProducerRosterError',
  'PublishedPageDisagreesError',
  'QuotaShapeError',
  'RepairUnheardError',
  'RoundsNotRecordedError',
  'RunConfigError',
  'RunJsonUnreadableError',
  'RunsDirectoryBusyError',
  'SchemaGenerationError',
  'SeedApplicationError',
  'SlatePositionsError',
  'StatedRefusalError',
  'StreamDegenerateError',
  'StreamOverrunError',
  'StreamStalledError',
  'SyntheticModelNotServedError',
  'SyntheticRequestTooLargeError',
  'TranslateAbsenceError',
  'UnknownArtifactGenerationError',
  'UnmeasurableRepairError',
  'UnnameableToolError',
  'UnplaceableArtifactError',
  'UnpositionedContainerError',
  'UnpositionedNodeError',
  'UnpreparedSliceError',
  'UnsafeSeedError',
  'UnseatedStandingError',
  'WindowEvidenceError',
];

/**
 * Every expression a marked class interpolates, and what it holds.
 *
 * A COUNT, A NAME, OR SOMETHING THE OPERATOR TYPED. That is the whole
 * permission. An entry whose note cannot be written in those terms is an entry
 * whose class should lose the marker instead.
 */
const NAMED_PARTS: Record<string, string> = {
  [BYTE_OFFSET_OR_NOTHING]: 'byte offset, or nothing',
  'ALLOW_DRIFT_VALUE': 'value this package expects in the override variable',
  'ALLOW_DRIFT_VAR': 'environment variable name',
  'HARD_CAP_VAR': 'environment variable name',
  'JSON.stringify(value,)': 'value the operator set in that variable',
  'String(MINIMUM_CHECKER_COUNT,)': 'count',
  'String(PASSING_BODY_BYTES,)': 'count',
  'variable': 'environment variable name',
  'String(bodyBytes - PASSING_BODY_BYTES,)': 'count',
  'String(bodyBytes,)': 'count',
  'String(cap,)': 'count',
  'String(census.total,)': 'count',
  'String(charsSeen,)': 'count',
  'String(checkerModelIds.length,)': 'count',
  'String(entryIds.length,)': 'count',
  'String(expected,)': 'count',
  'String(found,)': 'count',
  'String(generationCount,)': 'count',
  'String(holder.pid,)': 'process id',
  'String(idleMs,)': 'duration',
  'String(index,)': 'index within a parsed tree',
  'String(sampled,)': 'count',
  'String(status,)': 'HTTP status code',
  'String(unrecorded,)': 'count',
  'String(version,)': 'schema version',
  'String(sliceIndex,)': 'slice index',
  'String(writes,)': 'schema version',
  'UNHEARD_CLAIMS[claim]': 'one of two fixed phrases, keyed by a literal',
  'placementSentence({ fault, },)': 'offsets and counts, composed from numbers alone',
  'String(position,)': 'position of a slice in its list',
  'WINDOW_LABEL': 'name of a window this package defines',
  'channel': 'stream channel name, content or reasoning',
  'checkerModelIds.join(\', \',)': 'model ids from the catalog',
  'detail': 'authored phrase naming which rule was broken, at every throw site',
  'dir': 'directory path',
  'distinctRatio.toFixed(RATIO_DIGITS,)': 'ratio this process computed',
  'duplicated.join(\', \',)': 'model ids from the catalog',
  'disagreementSentence({ disagreement, },)': 'slice indices and character counts, composed from numbers alone',
  'entryId': 'person entry id, which these tools report by design',
  'entryIds.length === 1 ? \'\' : \'s\'': 'plural suffix',
  'entryIds.length === 1 ? \'s\' : \'\'': 'plural suffix',
  'failure': 'name of the failure class a JSON read raised',
  'fault': 'authored phrase naming which roster rule was broken',
  'field': 'field name',
  'file': 'file path',
  'from': 'file path',
  'holder.startedAt': 'timestamp',
  'judgeModelIds.join(\', \',)': 'model ids from the catalog',
  'kind': 'mdast node type name',
  'label': 'model id the transport was calling',
  'leftId': 'envelope id',
  'mdxRefusalSite({ cause, },)': 'position, built to state a place and quote nothing',
  'modelId': 'model id from the catalog',
  'modelIds.join(\', \',)': 'model ids from the catalog',
  'name === \'\' ? \'<>\' : name': 'container tag name, or a mark for an unnamed one',
  'overlapping.join(\', \',)': 'model ids from the catalog',
  'path': 'file path',
  'phase': 'name of the stream phase this package defines',
  'producerModelIds.join(\', \',)': 'model ids from the catalog',
  'reason': 'authored phrase, or a member of a closed union, at every throw site',
  'rightId': 'envelope id',
  'role': 'roster role name this package defines',
  'runsDir': 'directory path',
  'seedId': 'seed id',
  'short({ id: digest, },)': 'abbreviated digest',
  'short({ id: recorded, },)': 'abbreviated digest',
  'short({ id: requiredCommit, },)': 'abbreviated commit',
  'yamlRefusalSite({ cause, },)': 'position, built to state a place and quote nothing',
};

/**
 * Classes that write their own sentence and still may not carry the marker.
 *
 * RECORDED RATHER THAN LEFT SILENT, because an absent marker looks identical to
 * an oversight, and the next reader would have to re-derive each of these.
 */
const WITHHELD: Record<string, string> = {
  ArtifactProvenanceError: 'expected and observed carry whatever field disagreed, which may be text',
  StreamCutShortError: 'the abort reason reaches the message through String of an unknown value',
  SyntheticHttpError: 'the message carries an excerpt of the provider response body, on purpose',
};

//endregion Marked message inventory

//region Source scan

/**
 * Characters an identifier may carry, tested by membership rather than by
 * pattern.
 */
const IDENTIFIER_CHARACTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';

/**
 * What `indexOf` and `findIndex` answer when they found nothing.
 *
 * NAMED so the comparison carries no bare unary minus, which reads as a mixed
 * operator beside an equality test.
 */
const NOT_FOUND = -1;

/**
 * Whitespace this scan collapses, so a reflowed expression compares equal.
 */
const WHITESPACE = [
  ' ',
  '\n',
  '\t',
  '\r',
];

/**
 * One class declaration as this scan read it.
 */
type ScannedClass = {
  /**
   * Declared class name.
   */
  readonly name: string;

  /**
   * Whether its body declares the marker.
   */
  readonly marked: boolean;

  /**
   * Whether it writes its own sentence rather than forwarding a parameter.
   */
  readonly writesOwnSentence: boolean;

  /**
   * Every expression interpolated into its `super()` argument, whitespace
   * collapsed so a reflowed line is not read as a different expression.
   */
  readonly parts: readonly string[];
};

/**
 * Collapses whitespace runs so a reformatted expression compares equal.
 *
 * @param text - expression as it appears in the source
 *
 * @returns Same expression on one line with single spaces
 *
 * @example
 * ```ts
 * const key = oneLine({ text: 'short({\n  id,\n},)', },);
 * ```
 */
function oneLine({ text, }: { readonly text: string; },): string {
  /**
   * Same text with every kind of whitespace turned into a plain space.
   */
  const spaced = WHITESPACE.reduce(function flatten(carried, character,): string {
    return carried
      .split(character,)
      .join(' ',);
  }, text,);

  return spaced
    .split(' ',)
    .filter(function isWord(part,): boolean {
      return part !== '';
    },)
    .join(' ',);
}

/**
 * Reads forward from an opening delimiter to its match.
 *
 * INDEX SCAN RATHER THAN A PATTERN, because the thing being found is nesting,
 * which no pattern expresses and which a scan expresses exactly.
 *
 * @param source - text to read
 *
 * @param from - index just past the opening delimiter
 *
 * @returns Text between the delimiters
 *
 * @example
 * ```ts
 * const inside = balanced({ source, from: at + 'super('.length, },);
 * ```
 */
function balanced(
  {
    source,
    from,
  }: {
    readonly source: string;
    readonly from: number;
  },
): string {
  for (let at = from, depth = 1; at < source.length; at += 1) {
    /**
     * Character this step is reading.
     */
    const character = source.charAt(at,);

    /**
     * Depth once this character is counted.
     */
    const next = (depth + (('(['.includes(character,) || (character === '{')) ? 1 : 0))
      - ((')]'.includes(character,) || (character === '}')) ? 1 : 0);

    if (next === 0)
      return source.slice(from, at,);

    depth = next;
  }

  return source.slice(from,);
}

/**
 * Collects every `${...}` body inside one expression.
 *
 * @param expression - `super()` argument as written
 *
 * @returns Each interpolated expression, whitespace collapsed
 *
 * @example
 * ```ts
 * const parts = interpolationsOf({ expression, },);
 * ```
 */
function interpolationsOf(
  { expression, }: { readonly expression: string; },
): readonly string[] {
  /**
   * Interpolations found so far, in source order.
   */
  const found: string[] = [];

  for (let cursor = 0; cursor < expression.length;) {
    /**
     * Where the next interpolation opens.
     */
    const at = expression.indexOf('${', cursor,);

    if (at === NOT_FOUND)
      return found;

    /**
     * Expression between that opening and its matching brace.
     */
    const inside = balanced({
      source: expression,
      from: at + '${'.length,
    },);

    found.push(oneLine({ text: inside, },),);
    cursor = at + '${'.length + inside.length + 1;
  }

  return found;
}

/**
 * Decides whether a `super()` argument is nothing but a forwarded parameter.
 *
 * SCANNED RATHER THAN MATCHED. The rule is "every character is one an
 * identifier may carry", which an index pass states directly and which a
 * pattern would restate less clearly.
 *
 * @param argument - trimmed `super()` argument
 *
 * @returns Whether it is one lowercase identifier, with an optional comma
 *
 * @example
 * ```ts
 * const forwarded = isBareIdentifier({ argument: 'message,', },);
 * ```
 */
function isBareIdentifier({ argument, }: { readonly argument: string; },): boolean {
  /**
   * Same argument without the trailing comma the house style writes.
   */
  const withoutComma = argument.endsWith(',',)
    ? argument.slice(0, -1,)
    : argument;

  /**
   * First character, which decides whether this could be a parameter name.
   */
  const opening = withoutComma.charAt(0,);

  if ((opening === '') || (opening !== opening.toLowerCase()))
    return false;

  for (let at = 0; at < withoutComma.length; at += 1) {
    if (!IDENTIFIER_CHARACTERS.includes(withoutComma.charAt(at,),))
      return false;
  }

  return true;
}

/**
 * Reads every error class one source file declares.
 *
 * @param source - file contents
 *
 * @returns One record per class declaration
 *
 * @example
 * ```ts
 * const declared = classesIn({ source: await readFile(path, 'utf8',), },);
 * ```
 */
function classesIn({ source, }: { readonly source: string; },): readonly ScannedClass[] {
  /**
   * File split into lines, which is how a class opening is recognised.
   */
  const lines = source.split('\n',);

  return lines.flatMap(function atLine(line, index,): readonly ScannedClass[] {
    /**
     * Opening this line carries, or nothing when it declares no class.
     */
    const opener = line.startsWith('export class ',)
      ? 'export class '
      : (line.startsWith('class ',) ? 'class ' : '');

    if ((opener === '') || (!line.includes(' extends ',)))
      return [];

    /**
     * Declared name, which runs to the space before `extends`.
     */
    const name = line
      .slice(opener.length,)
      .split(' ',)
      .at(0,) ?? '';

    // The body runs to the next line that is a lone closing brace, which is how
    // every class in this package ends.
    /**
     * Line index of that closing brace, or absent when the file ends first.
     */
    const closes = lines.findIndex(function isClose(candidate, at,): boolean {
      return (at > index) && (candidate === '}');
    },);

    /**
     * Class body as text, opening line included.
     */
    const body = lines
      .slice(index, (closes === NOT_FOUND) ? lines.length : closes,)
      .join('\n',);

    /**
     * Where this class calls `super`, or absent when it inherits one.
     */
    const superAt = body.indexOf('super(',);

    /**
     * Whole `super()` argument, or nothing when there is no call.
     */
    const argument = (superAt === NOT_FOUND)
      ? ''
      : balanced({
        source: body,
        from: superAt + 'super('.length,
      },);

    return [{
      name,
      marked: body.includes('readonly messageNamesOnly',),
      // A bare identifier means the sentence arrived from the throw site.
      writesOwnSentence: (argument.trim() !== '')
        && (!isBareIdentifier({ argument: argument.trim(), },)),
      parts: interpolationsOf({ expression: argument, },),
    },];
  },);
}

/**
 * Reads every non-test source file and returns the classes they declare.
 *
 * @returns Every scanned class across the package source
 *
 * @example
 * ```ts
 * const declared = await scanSource();
 * ```
 */
async function scanSource(): Promise<readonly ScannedClass[]> {
  /**
   * Every entry under the source directory, at any depth.
   */
  const entries = await readdir(SOURCE_DIR, {
    recursive: true,
    withFileTypes: true,
  },);

  /**
   * Files this scan reads, which excludes the suites.
   */
  const sources = entries.filter(function isSource(entry,): boolean {
    return entry.isFile()
      && entry.name.endsWith('.ts',)
      && (!entry.name.includes('.test.',));
  },);

  /**
   * Classes each of those files declares.
   */
  const scanned = await Promise.all(sources.map(async function one(entry,): Promise<readonly ScannedClass[]> {
    return classesIn({
      source: await readFile(join(entry.parentPath, entry.name,), 'utf8',),
    },);
  },),);

  return scanned.flat();
}

//endregion Source scan

await describe({
  name: 'messageNamesOnly',
  children: [
    it({
      name: 'KEEPS exactly the classes the inventory records',
      fn: async () => {
        const declared = await scanSource();

        expect(
          declared
            .filter(function isMarked(entry,): boolean {
              return entry.marked;
            },)
            .map(function named(entry,): string {
              return entry.name;
            },)
            .toSorted(),
        ).toEqual(MARKED_CLASSES.toSorted(),);
      },
    },),

    it({
      name: 'ACCEPTS only the message parts the inventory names',
      fn: async () => {
        const declared = await scanSource();

        const unnamed = declared
          .filter(function isMarked(entry,): boolean {
            return entry.marked;
          },)
          .flatMap(function parts(entry,): readonly string[] {
            return entry
              .parts
              .filter(function isUnnamed(part,): boolean {
                return !Object.hasOwn(NAMED_PARTS, part,);
              },)
              .map(function attributed(part,): string {
                return `${entry.name}: ${part}`;
              },);
          },);

        // Naming the class and the part rather than a count, because the whole
        // point of a failure here is that a reader has to decide about one
        // specific expression.
        expect(unnamed,).toEqual([],);
      },
    },),

    it({
      name: 'REFUSES to let a class that forwards a message carry the marker',
      fn: async () => {
        const declared = await scanSource();

        expect(
          declared
            .filter(function isForwarding(entry,): boolean {
              return entry.marked
                && (!entry.writesOwnSentence)
                // The documented exception, whose whole contract is the
                // sentence its caller wrote.
                && (entry.name !== 'StatedRefusalError');
            },)
            .map(function named(entry,): string {
              return entry.name;
            },),
        ).toEqual([],);
      },
    },),

    it({
      name: 'KEEPS a reason for every class that writes its sentence and stays unmarked',
      fn: async () => {
        const declared = await scanSource();

        expect(
          declared
            .filter(function isWithheld(entry,): boolean {
              return (!entry.marked) && entry.writesOwnSentence;
            },)
            .map(function named(entry,): string {
              return entry.name;
            },)
            .toSorted(),
        ).toEqual(Object.keys(WITHHELD,).toSorted(),);
      },
    },),
  ],
},);
