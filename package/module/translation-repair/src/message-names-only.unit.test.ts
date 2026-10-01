/**
 Guards the claim `messageNamesOnly` makes, by reading the source that makes
 it.
 
 WHAT THE MARKER CLAIMS. `refusalText` repeats the message of any error whose
 class declares `messageNamesOnly`, and drops the message of every other
 class. So the marker says: every part of this message is a sentence we wrote,
 a number this process computed, a name from our own vocabulary, or a value
 the operator handed in. Never a corpus passage, a run file's contents, a
 model's answer, or a provider's response body.
 
 THE RULE THAT DECIDES WHO MAY CARRY IT. A class may declare the marker when
 the CLASS writes the sentence. A class whose constructor forwards a `message`
 parameter to `super` may not, however careful its throw sites are, because
 the claim would then be about thirty call sites rather than about one class,
 and nothing here could check it. `StatedRefusalError` is the deliberate
 exception, and carries its own note saying why.
 
 WHY A SOURCE SCAN RATHER THAN A BEHAVIOURAL TEST. Constructing each class and
 reading its message would pin today's wording, which is not the property
 worth guarding: rewording a sentence is fine, and interpolating a new value
 into it is the thing that needs a second look. This reads exactly that, and
 fails when a marked class's message gains a part the inventory does not name.
 
 WHAT IT CANNOT CATCH. A field the inventory already names, such as `detail`,
 can be handed different text by a new throw site. The inventory records what
 each field holds today, and a change of that kind is caught by reading, not
 by this file.
 
 @module
 */

import { readdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  childNodes,
  identifierName,
  isTreeNode,
  parseSource,
  readPackageSource,
  type SourceText,
  type TreeNode,
} from './source-scan.test-fixture.ts';

//region Marked message inventory

/**
 Source directory this scan reads, which is the one holding this file.
 */
const SOURCE_DIR = import.meta.dirname;

/**
 Key naming the byte offset a JSON read reports, or nothing when it has none.
 
 SPLIT ACROSS A CONCATENATION so no plain string holds a whole `${}`, which
 `no-template-curly-in-string` reads as a template literal written by mistake.
 The halves join to exactly the expression the scan finds in the source.
 */
const BYTE_OFFSET_OR_NOTHING = "(at === OFFSET_UNSTATED) ? '' : ` at byte $"
  + '{String(at,)}`';
/**
 Every class permitted to declare the marker, with nothing else allowed to.
 
 ADDING A NAME HERE IS THE DECISION. The list exists so that marking a class
 cannot happen quietly inside an unrelated change: this test fails until the
 name is written down, which is the moment to ask what its message carries.
 */
const MARKED_CLASSES: readonly string[] = [
  'ArchiveOriginalCompletenessError',
  'ArtifactComparisonError',
  'ArtifactParseError',
  'AssemblyContractError',
  'BedrockCreditOverrideError',
  'BedrockLedgerShapeError',
  'BlockOutsideArchiveError',
  'BedrockModelNotServedError',
  'BlankSelectionError',
  'CacheAccountLogError',
  'CacheAccountReadError',
  'CallTimeoutError',
  'CensusBaselineError',
  'CheckerIndependenceError',
  'CheckerQuorumError',
  'CollapsedHeadingError',
  'ConsolidationLedgerGapError',
  'ContributorCompletenessError',
  'CorpusReadError',
  'CoverageFileError',
  'CoverageTallyError',
  'CreditsShapeError',
  'DecisionReplyShapeError',
  'DecisionsCardMissingError',
  'DeclinedEntriesUnreadableError',
  'DeliveryCoherenceError',
  'DeliveryInvariantError',
  'DrawReconcileError',
  'DroppedDestinationError',
  'EmptyConversationError',
  'EmptyPoolError',
  'EnvelopeOverlapError',
  'EveryProviderDryError',
  'FidelityReferenceError',
  'FloorGroundDisagreementError',
  'FootnoteOverflowError',
  'FootnoteRewriteError',
  'FrontMatterCompletenessError',
  'FrontMatterParseError',
  'GenerationDriftError',
  'GradedSheetExistsError',
  'HardCapOverrideError',
  'InStreamProviderError',
  'IssueEvidenceConflictError',
  'LaneComparisonError',
  'LaneSliceCoverageError',
  'LedgerShapeError',
  'LegacyPipelineError',
  'MalformedCompletionError',
  'MalformedImageUriError',
  'MdxParseError',
  'MislabelledArtifactError',
  'MixedGenerationError',
  'ModelNotServedError',
  'NaturalnessCompletenessError',
  'NaturalnessQuorumError',
  'NaturalnessRepairInterruptedError',
  'NoProviderForModelError',
  'NothingInFlightError',
  'OffRosterModelError',
  'OpenRouterCreditsShapeError',
  'OpenRouterModelNotServedError',
  'OverlapRefusedError',
  'OverlappingEditsError',
  'PairingEvidenceError',
  'PipelineDigestError',
  'PlacementLayoutError',
  'ProducerRosterError',
  'PromptPayloadStoreError',
  'PublishedPageDisagreesError',
  'QuotaShapeError',
  'ReferenceLineHeadError',
  'RepairUnheardError',
  'RequiredProviderError',
  'RoundsNotRecordedError',
  'RunConfigError',
  'RunJsonUnreadableError',
  'RunsDirectoryBusyError',
  'SchemaGenerationError',
  'SeedApplicationError',
  'SlatePositionsError',
  'SliceBlockCountRefusalError',
  'SliceCoverageError',
  'SliceDeliveryError',
  'SliceIndexingError',
  'SliceNotOnPageError',
  'SliceRecordContradictionError',
  'SourceMapFileError',
  'SpendCeilingOverrideError',
  'StatedRefusalError',
  'StreamBoundError',
  'StreamDegenerateError',
  'StreamOverrunError',
  'StreamStalledError',
  'SyntheticModelNotServedError',
  'SyntheticRequestTooLargeError',
  'TranslateAbsenceError',
  'TranslationRepairInterruptedError',
  'UnknownArtifactGenerationError',
  'UnmeasurableRepairError',
  'UnnameableToolError',
  'UnplaceableArtifactError',
  'UnparseablePageError',
  'UnpositionedContainerError',
  'UnpositionedNodeError',
  'UnpreparedSliceError',
  'UnsafeSeedError',
  'UnseatedStandingError',
  'VisualEvidenceInterruptedError',
  'WindowEvidenceError',
  'WithheldSlateAbsenceError',
  'WordingCoherenceError',
  'WritingBenchUnreachableError',
];

/**
 Every expression a marked class interpolates, and what it holds.
 
 A COUNT, A NAME, OR SOMETHING THE OPERATOR TYPED. That is the whole
 permission. An entry whose note cannot be written in those terms is an entry
 whose class should lose the marker instead.
 */
const NAMED_PARTS: Record<string, string> = {
  [BYTE_OFFSET_OR_NOTHING]: 'byte offset, or nothing',
  'ALLOW_DRIFT_VALUE': 'value this package expects in the override variable',
  'ALLOW_DRIFT_VAR': 'environment variable name',
  'HARD_CAP_VAR': 'environment variable name',
  'SPEND_CEILING_VAR': 'environment variable name',
  'JSON.stringify(value,)': 'value the operator set in that variable',
  'String(MINIMUM_CHECKER_COUNT,)': 'count',
  'String(overlap,)': 'count',
  'String(spanIndex,)': 'count',
  'String(startOffset,)': 'character offset into the archive page',
  'String(endOffset,)': 'character offset into the archive page',
  'String(earlier.start,)': 'offset into the text two edits were built for',
  'String(earlier.end,)': 'offset into the text two edits were built for',
  'String(later.start,)': 'offset into the text two edits were built for',
  'String(later.end,)': 'offset into the text two edits were built for',
  'String(PASSING_BODY_BYTES,)': 'count',
  'variable': 'environment variable name',
  'String(line,)': 'one-based line number in a file',
  'BEDROCK_CREDIT_USD_VAR': 'environment variable name',
  'String(bodyBytes - PASSING_BODY_BYTES,)': 'count',
  'String(bodyBytes,)': 'count',
  'String(cap,)': 'count',
  'String(census.total,)': 'count',
  'String(charsSeen,)': 'count',
  'String(droppedCount,)': 'count',
  'whereCarried({ traces, },)': 'fixed clause naming slice indices whose original carries a dropped destination',
  'String(sourceDistinct,)': 'count',
  'String(pageDistinct,)': 'count',
  'refusal': 'strict parser refusal site, positions and rule names only (MdxParseError)',
  'String(quorumOver,)': 'numeric review quorum basis',
  'String(seatCount,)': 'count of requested independent review seats',
  'String(checkerModelIds.length,)': 'count',
  'String(entryIds.length,)': 'count',
  'String(expected,)': 'count',
  'String(found,)': 'count',
  'String(generationCount,)': 'count',
  'String(holder.pid,)': 'process id',
  'String(idleMs,)': 'duration',
  'String(index,)': 'index within a parsed tree',
  'String(failure.index,)': 'numeric position within recorded pairing seat identities',
  'String(sampled,)': 'count',
  'String(status,)': 'HTTP status code',
  'String(unrecorded,)': 'count',
  'String(blocks.length,)': 'count',
  'String(version,)': 'schema version',
  'String(sliceIndex,)': 'slice index',
  'String(round,)': 'page assembly round number, from one',
  'String(unavailableCount,)': 'count of source-referenced assets without usable visual evidence',
  'String(sliceIndices.length,)': 'count',
  'sliceIndices.join(\', \',)': 'slice indexes',
  'String(writes,)': 'schema version',
  'String(count,)': 'count of footnote markers, or of lines in a reference block',
  'convention': 'footnote marker convention name, one of two literals',
  'String(MAX_SLICE_IDENTIFIERS,)': 'bound this package sets',
  'String(timeoutMs,)': 'deadline in milliseconds',
  'String(boundMs,)': 'stream bound in milliseconds a model card declares',
  'UNHEARD_CLAIMS[claim]': 'one of two fixed phrases, keyed by a literal',
  'placementSentence({ fault, },)': 'offsets and counts, composed from numbers alone',
  'reconcileSentence({ fault, },)': 'kind, typeof name and counts, composed here',
  'lane': 'lane name, one of two literals',
  'String(changed,)': 'boolean flag',
  'String(code,)': 'numeric failure class the gateway reported, or the word unnamed',
  "changed ? 'archive wording' : 'wording of a change'": 'one of two phrases written here',
  'String(fault.position,)': 'position of a slice in its list',
  'indexingSentence({ fault, },)': 'indices, composed from numbers alone',
  'String(fault.sliceIndex,)': 'slice index',
  'terminal': 'consolidation terminal name, a member of a closed union',
  'coverageSentence({ fault, },)': 'side name, counts and positional block ids, composed here',
  'coherenceSentence({ fault, },)': 'fault kind and at most an outcome kind, composed here',
  'String(position,)': 'position of a slice in its list, or of a line in a reference block',
  'REFERENCE_LINE_MARK': 'fixed mark this package writes at the head of every reference line',
  'line': 'line of this package\'s own source, or git log output over its own commits (hash, time, subject); '
    + 'never corpus text',
  'WINDOW_LABEL': 'name of a window this package defines',
  'channel': 'stream channel name, content or reasoning',
  'checkerModelIds.join(\', \',)': 'model ids from the catalog',
  'detail': 'authored phrase naming which rule was broken, at every throw site; the one value read off a body '
    + 'is an Anthropic error event\'s type, lower-case letters and underscores of at most 64 characters, '
    + 'or the word unnamed (ledger B87); SliceBlockCountRefusalError forwards the slice grammar\'s refusal as '
    + 'readSliceSkeleton reports it, positions and rule names only (MdxParseError, ledger B100)',
  'CONTRACT_NAMES[wireFormat]': 'contract name, one of two fixed phrases keyed by the closed wire-format union (ledger B90)',
  'measured': 'meter states and hold durations, composed by the caller from two booleans and two numbers',
  'dir': 'directory path',
  'endpoint': 'upstream display name as the gateway spelled it, the same field the SPEND line prints, or the word unnamed',
  'errorType': 'gateway failure kind read off its metadata, or the word unnamed',
  'distinctRatio.toFixed(RATIO_DIGITS,)': 'ratio this process computed',
  'duplicated.join(\', \',)': 'model ids from the catalog',
  'disagreementSentence({ disagreement, },)': 'slice indices and character counts, composed from numbers alone',
  'entryId': 'person entry id, which these tools report by design',
  'unreviewedLocations({ blocks, },)': 'pair indexes and parser block ids, composed from names alone',
  'wordForCount({ count: entryIds.length, one: \'artifact here records\', many: \'artifacts here record\', },)':
    'noun and verb agreeing with a count, both forms authored here',
  'wordForCount({ count: entryIds.length, one: \'artifact in this directory records\', many: \'artifacts in this directory record\', },)':
    'noun and verb agreeing with a count, both forms authored here',
  'wordForCount({ count: bodyBytes, one: \'byte\', many: \'bytes\', },)':
    'noun agreeing with a count, both forms authored here',
  'wordForCount({ count: charsSeen, one: \'character\', many: \'characters\', },)':
    'noun agreeing with a count, both forms authored here',
  'failure': 'name of the failure class a JSON read raised',
  'filesystemCode': 'filesystem code a directory listing raised (ENOTDIR, EACCES), or the class name where there is none',
  'fault': 'authored phrase naming which roster rule was broken',
  'field': 'field name',
  'file': 'file path',
  'from': 'file path',
  'holder.startedAt': 'timestamp',
  'HELD_BECAUSE[judgedBy]': 'fixed authored phrase saying how a runs-lock holder was judged alive',
  'judgeModelIds.join(\', \',)': 'model ids from the catalog',
  'kind': 'mdast node type name or closed tally/reading/archive-evidence failure-kind literal',
  'relPath': 'operator-supplied repository-relative archive path, never document text',
  'referenceId': 'caller-supplied reviewed fixture identifier, never reference prose',
  'ROOT_MESSAGES[kind]': 'authored root-planning diagnostic selected by a closed failure kind',
  'COMPARISON_MESSAGES[kind]': 'authored persisted-input comparison diagnostic selected by a closed failure kind',
  'JSON.stringify(directory)': 'operator-authorized comparison evidence directory locator; the constructor does not accept failure prose or artifact contents',
  'INPUT_RUN_MESSAGES[operation]': 'authored preparation input-runner diagnostic selected by a closed operation kind',
  'JSON.stringify(locator)': 'preparation runner input path, supporting root/reference locator or fixed output path; current throw sites never pass file contents',
  [`locator === undefined ? '' : \` Input: \${JSON.stringify(locator)}.\``]: 'optional encoded input locator from the audited preparation runner throw sites, never input contents',
  'JSON.stringify(affectedInput,)': 'root artifact locator, corpus-relative path, entry/parent identifier or fixed registry label; audited throw sites never pass compared content',
  'claimId': 'computed claim identifier, not its quoted text or diagnostic summary',
  'label': 'model id the transport was calling',
  'leftId': 'envelope id',
  'mdxRefusalSite({ cause, },)': 'position, built to state a place and quote nothing',
  'modelId': 'model id from the catalog',
  'operation': 'member of a closed operation union',
  'signal': 'SIGINT or SIGTERM in the audited preparation interruption error constructor',
  'promptDigest': 'SHA-256 prompt identity',
  'modelIds.join(\', \',)': 'model ids from the catalog',
  'missing': 'document side, original or translation',
  'name === \'\' ? \'<>\' : name': 'container tag name, or a mark for an unnamed one',
  'overlapping.join(\', \',)': 'model ids from the catalog',
  'path': 'file path',
  'phase': 'name of the stream phase this package defines',
  'producerModelIds.join(\', \',)': 'model ids from the catalog',
  'provider': 'member of a closed provider union',
  'reason': 'authored phrase, or a member of a closed union, at every throw site; or a marked class\'s sentence '
    + 'forwarded from a catch narrowed to it, at a site FORWARDING_SITES lists; or, for a prompt payload record, '
    + 'an authored phrase naming a JSON path in the record or ending in the filesystem code or class name '
    + '`failureName` gives (ledger B69), never a stored value',
  'WORDING_FAULT_SENTENCES[fault]': 'one of five fixed phrases, keyed by a closed fault kind',
  'rightId': 'envelope id',
  'role': 'roster role name this package defines',
  'says': 'authored phrase saying what in a coverage census input did not read, at every throw site; it names at '
    + 'most a script URL under the package\'s own build directory, a bundle name and offsets (the coverage census, '
    + 'ledger T8)',
  'runsDir': 'directory path',
  'seedId': 'seed id',
  'short({ id: digest, },)': 'abbreviated digest',
  'short({ id: nonNullishOrThrow(requiredCommit,), },)': 'abbreviated commit',
  'short({ id: recorded, },)': 'abbreviated digest',
  'unavailableCount': 'count of source-referenced assets without usable visual evidence',
  'clauses.join(\'; \',)': 'bench names, seat counts and the floor, built by the seat reading and quoting nothing',
  'yamlRefusalSite({ cause, },)': 'position, built to state a place and quote nothing',
};

/**
 Classes that write their own sentence and still may not carry the marker.
 
 RECORDED RATHER THAN LEFT SILENT, because an absent marker looks identical to
 an oversight, and the next reader would have to re-derive each of these.
 */
const WITHHELD: Record<string, string> = {
  ArtifactProvenanceError: 'expected and observed carry whatever field disagreed, which may be text',
  PreparationIdentityError: 'quotes the string it refused, which a caller may have read from any file; the '
    + 'artifact reader refuses a stored identity by shape in its own words instead (ledger B34)',
  RenderingAuditInvariantError: 'forwards each site\'s own sentence, which names indexes and vocabulary '
    + 'words and never text; unreachable by construction, so the boundary never has to print it',
  StreamCutShortError: 'the abort reason reaches the message through String of an unknown value',
  SyntheticHttpError: 'the message carries an excerpt of the provider response body, on purpose',
  TimingLineError: 'quotes the whole timing line it could not read, so an operator can find it; the line was '
    + 'chosen by the round or completion marker the run\'s own logger writes, but nothing proves a line '
    + 'carrying that marker holds only labels, counts and durations (T8, nineteenth batch)',
};

//endregion Marked message inventory

//region Source scan

/**
 Characters an identifier may carry, tested by membership rather than by
 pattern.
 */
const IDENTIFIER_CHARACTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';

/**
 What `indexOf` and `findIndex` answer when they found nothing.
 
 NAMED so the comparison carries no bare unary minus, which reads as a mixed
 operator beside an equality test.
 */
const NOT_FOUND = -1;

/**
 Whitespace this scan collapses, so a reflowed expression compares equal.
 */
const WHITESPACE = [
  ' ',
  '\n',
  '\t',
  '\r',
];

/**
 One class declaration as this scan read it.
 */
type ScannedClass = {
  /**
   Declared class name.
   */
  readonly name: string;

  /**
   Whether its body declares the marker.
   */
  readonly marked: boolean;

  /**
   Whether it writes its own sentence rather than forwarding a parameter.
   */
  readonly writesOwnSentence: boolean;

  /**
   Every expression interpolated into its `super()` argument, whitespace
   collapsed so a reflowed line is not read as a different expression.
   */
  readonly parts: readonly string[];
};

/**
 Collapses whitespace runs so a reformatted expression compares equal.
 
 @param text - expression as it appears in the source
 
 @returns Same expression on one line with single spaces
 
 @example
 ```ts
 const key = oneLine({ text: 'short({\n  id,\n},)', },);
 ```
 */
function oneLine({ text, }: { readonly text: string; },): string {
  /**
   Same text with every kind of whitespace turned into a plain space.
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
 Reads forward from an opening delimiter to its match.
 
 INDEX SCAN RATHER THAN A PATTERN, because the thing being found is nesting,
 which no pattern expresses and which a scan expresses exactly.
 
 @param source - text to read
 
 @param from - index just past the opening delimiter
 
 @returns Text between the delimiters
 
 @example
 ```ts
 const inside = balanced({ source, from: at + 'super('.length, },);
 ```
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
     Character this step is reading.
     */
    const character = source.charAt(at,);

    /**
     Depth once this character is counted.
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
 Collects every `${...}` body inside one expression.
 
 @param expression - `super()` argument as written
 
 @returns Each interpolated expression, whitespace collapsed
 
 @example
 ```ts
 const parts = interpolationsOf({ expression, },);
 ```
 */
function interpolationsOf(
  { expression, }: { readonly expression: string; },
): readonly string[] {
  /**
   Interpolations found so far, in source order.
   */
  const found: string[] = [];

  for (let cursor = 0; cursor < expression.length;) {
    /**
     Where the next interpolation opens.
     */
    const at = expression.indexOf('${', cursor,);

    if (at === NOT_FOUND)
      return found;

    /**
     Expression between that opening and its matching brace.
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
 Decides whether a `super()` argument is nothing but a forwarded parameter.
 
 SCANNED RATHER THAN MATCHED. The rule is "every character is one an
 identifier may carry", which an index pass states directly and which a
 pattern would restate less clearly.
 
 @param argument - trimmed `super()` argument
 
 @returns Whether it is one lowercase identifier, with an optional comma
 
 @example
 ```ts
 const forwarded = isBareIdentifier({ argument: 'message,', },);
 ```
 */
function isBareIdentifier({ argument, }: { readonly argument: string; },): boolean {
  /**
   Same argument without the trailing comma the house style writes.
   */
  const withoutComma = argument.endsWith(',',)
    ? argument.slice(0, -1,)
    : argument;

  /**
   First character, which decides whether this could be a parameter name.
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
 Reads every error class one source file declares.
 
 @param source - file contents
 
 @returns One record per class declaration
 
 @example
 ```ts
 const declared = classesIn({ source: await readFile(path, 'utf8',), },);
 ```
 */
function classesIn({ source, }: { readonly source: string; },): readonly ScannedClass[] {
  /**
   File split into lines, which is how a class opening is recognised.
   */
  const lines = source.split('\n',);

  return lines.flatMap(function atLine(line, index,): readonly ScannedClass[] {
    /**
     Opening this line carries, or nothing when it declares no class.
     */
    const opener = line.startsWith('export class ',)
      ? 'export class '
      : (line.startsWith('class ',) ? 'class ' : '');

    if ((opener === '') || (!line.includes(' extends ',)))
      return [];

    /**
     Declared name, which runs to the space before `extends`.
     */
    const name = line
      .slice(opener.length,)
      .split(' ',)
      .at(0,) ?? '';

    // The body runs to the next line that is a lone closing brace, which is how
    // every class in this package ends.
    /**
     Line index of that closing brace, or absent when the file ends first.
     */
    const closes = lines.findIndex(function isClose(candidate, at,): boolean {
      return (at > index) && (candidate === '}');
    },);

    /**
     Class body as text, opening line included.
     */
    const body = lines
      .slice(index, (closes === NOT_FOUND) ? lines.length : closes,)
      .join('\n',);

    /**
     Where this class calls `super`, or absent when it inherits one.
     */
    const superAt = body.indexOf('super(',);

    /**
     Whole `super()` argument, or nothing when there is no call.
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
 Reads every non-test source file and returns the classes they declare.
 
 @returns Every scanned class across the package source
 
 @example
 ```ts
 const declared = await scanSource();
 ```
 */
async function scanSource(): Promise<readonly ScannedClass[]> {
  /**
   Every entry under the source directory, at any depth.
   */
  const entries = await readdir(SOURCE_DIR, {
    recursive: true,
    withFileTypes: true,
  },);

  /**
   Files this scan reads, which excludes the suites.
   */
  const sources = entries.filter(function isSource(entry,): boolean {
    return entry.isFile()
      && entry.name.endsWith('.ts',)
      && (!entry.name.includes('.test.',));
  },);

  /**
   Classes each of those files declares.
   */
  const scanned = await Promise.all(sources.map(async function one(entry,): Promise<readonly ScannedClass[]> {
    return classesIn({
      source: await readFile(join(entry.parentPath, entry.name,), 'utf8',),
    },);
  },),);

  return scanned.flat();
}

//endregion Source scan

//region Forwarded messages
// A MARKED CLASS CAN STILL CARRY TEXT IT DID NOT WRITE, through a throw site
// that hands it a caught error's message (ledger B34): `ArtifactParseError`
// printed a pipeline digest and a preparation identity that way, quoted by the
// errors it caught. This scan finds every construction of a marked class whose
// arguments name a catch clause's binding or call `caughtValueText`, and reads
// which classes that catch narrows its binding to with `instanceof`. Only a
// catch narrowed to marked classes may forward, since their sentences are
// checked by this file; each such site is listed. The narrowing is read by
// its presence in the clause, not proven to guard the throw, so a review of
// each listed site still decides it.

/**
 A marked class's construction that carries text a caught error wrote.
 */
type Forwarding = {
  /**
   File, relative to `src`.
   */
  readonly file: string;

  /**
   Marked class constructed.
   */
  readonly className: string;

  /**
   Classes the enclosing catch narrows its binding to, sorted; none where it
   narrows nothing or the text arrives outside a catch.
   */
  readonly narrowedTo: readonly string[];
};

/**
 How a listed site uses the caught error's text.

 FORWARDS: the text becomes part of the marked message, so the catch must
 narrow to marked classes, whose sentences this file checks.
 READ-FOR-A-NUMBER: the text is read for a number the class's own inventory
 names, and none of it reaches the message. The one site that forwarded a
 library's message quoting what the operator typed, the coverage census's
 own `parseArgs` catch, went when every runner's line moved to
 `readCommandLine`, which writes its own refusals (ledger B75).
 */
type ForwardingKind = 'forwards' | 'read-for-a-number';

/**
 Every construction of a marked class whose arguments turn a caught error
 into text, with how that text is used and what it names.
 */
const FORWARDING_SITES: readonly (Forwarding & {
  /**
   How the caught error's text is used.
   */
  readonly kind: ForwardingKind;

  /**
   What that text names, read at the throw sites it comes from.
   */
  readonly names: string;
})[] = [
  {
    file: 'artifact-change-sets.ts',
    className: 'ArtifactParseError',
    narrowedTo: ['AssemblyContractError',],
    kind: 'forwards',
    names: 'slice indexes and index-set sizes',
  },
  {
    file: 'corpus-run/artifact-two-lane-read-comparison.ts',
    className: 'ArtifactParseError',
    narrowedTo: ['ArtifactComparisonError',],
    kind: 'forwards',
    names: 'lane names, counts, positions, slice indexes, archive-wording kinds and comparison-row field names',
  },
  {
    file: 'corpus-run/artifact-two-lane-read-row-relations.ts',
    className: 'ArtifactParseError',
    narrowedTo: ['DeliveryCoherenceError', 'WordingCoherenceError',],
    kind: 'forwards',
    names: 'a slice index and fault and outcome kinds',
  },
  {
    file: 'run-json-read.ts',
    className: 'RunJsonUnreadableError',
    narrowedTo: [],
    kind: 'read-for-a-number',
    names: 'the byte offset JSON.parse reports, read by offsetIn as a number',
  },
];

/**
 Node kinds a scan for names under an expression does not enter.
 */
const NESTED_FUNCTION_KINDS: ReadonlySet<string> = new Set(['ArrowFunctionExpression', 'FunctionDeclaration', 'FunctionExpression',],);

/**
 Members through which a value becomes its text.
 */
const TEXT_MEMBERS: ReadonlySet<string> = new Set(['message', 'stack',],);

/**
 Every identifier some nodes turn into text, functions nested in them left out:
 one interpolated into a template, handed to `String` or `caughtValueText`, or
 read through its `message` or `stack`. A value handed on whole, as a
 `cause` a class reads a position or a name from, is not text here: the
 class's own sentence is what the inventory checks. `caughtValueText` counts
 by name too, wherever it is called.

 @param roots - nodes to read

 @returns Names found, each once

 @example
 ```ts
 const named = textNamesUnder({ roots: construction.arguments, },);
 ```
 */
function textNamesUnder({ roots, }: { readonly roots: readonly TreeNode[]; },): ReadonlySet<string> {
  /**
   Names found so far.
   */
  const found = new Set<string>();
  /**
   Nodes still to read.
   */
  const pending = [...roots,];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (NESTED_FUNCTION_KINDS.has(node.type,))
      continue;
    /**
     Name this node calls, when it is a call.
     */
    const called = (node.type === 'CallExpression') ? identifierName({ node: node.callee, },) : '';
    /**
     Arguments of that call.
     */
    const callArguments = (Array.isArray(node.arguments,) ? node.arguments : []).filter(function isNode(
      argument: unknown,
    ): argument is TreeNode {
      return isTreeNode(argument,);
    },);
    if (called === 'caughtValueText')
      found.add(called,);
    if ((called === 'caughtValueText') || (called === 'String')) {
      for (const argument of callArguments)
        found.add(identifierName({ node: argument, },),);
    }
    if ((node.type === 'MemberExpression') && TEXT_MEMBERS.has(identifierName({ node: node.property, },),))
      found.add(identifierName({ node: node.object, },),);
    if ((node.type === 'TemplateLiteral') && Array.isArray(node.expressions,)) {
      for (const expression of node.expressions)
        found.add(identifierName({ node: expression, },),);
    }
    pending.push(...childNodes({ node, },),);
  }
  found.delete('',);
  return found;
}

/**
 Classes a catch clause narrows its binding to with `instanceof`.

 @param body - the clause's block

 @param binding - name the clause binds its error to

 @returns Class names, sorted and each once

 @example
 ```ts
 const narrowedTo = narrowingsOf({ body, binding: 'error', },);
 ```
 */
function narrowingsOf(
  {
    body,
    binding,
  }: {
    readonly body: TreeNode;
    readonly binding: string;
  },
): readonly string[] {
  /**
   Classes found so far.
   */
  const found = new Set<string>();
  /**
   Nodes still to read.
   */
  const pending = [body,];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if ((node.type === 'BinaryExpression') && (node.operator === 'instanceof')
      && (identifierName({ node: node.left, },) === binding)) {
      /**
       Class tested against.
       */
      const tested = identifierName({ node: node.right, },);
      if (tested !== '')
        found.add(tested,);
    }
    pending.push(...childNodes({ node, },),);
  }
  return [...found,].toSorted();
}

/**
 One catch clause enclosing a node, as the forwarding scan carries it.
 */
type CatchScope = {
  /**
   Name the clause binds its error to.
   */
  readonly binding: string;

  /**
   The clause's block.
   */
  readonly body: TreeNode;
};

/**
 Every construction of a marked class in one file that forwards a caught
 error's text: its arguments name an enclosing catch clause's binding, or call
 `caughtValueText`.

 @param file - file to read

 @param marked - classes that declare the marker

 @returns Each such construction, in no particular order

 @example
 ```ts
 const found = forwardingIn({ file, marked: new Set(MARKED_CLASSES,), },);
 ```
 */
function forwardingIn(
  {
    file,
    marked,
  }: {
    readonly file: SourceText;
    readonly marked: ReadonlySet<string>;
  },
): readonly Forwarding[] {
  /**
   The file's syntax tree.
   */
  const { program, } = parseSource({ file, },);
  /**
   Constructions found so far.
   */
  const found: Forwarding[] = [];
  /**
   Nodes still to read, each with the catch clauses enclosing it.
   */
  const pending: { readonly node: TreeNode; readonly catches: readonly CatchScope[]; }[] = [{
    node: program,
    catches: [],
  },];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    /**
     Node read now, and the clauses around it.
     */
    const {
      node,
      catches,
    } = next;
    /**
     Class constructed here, or nothing.
     */
    const className = (node.type === 'NewExpression') ? identifierName({ node: node.callee, },) : '';
    if (marked.has(className,)) {
      /**
       Names the construction's arguments carry.
       */
      const named = textNamesUnder({
        roots: Array.isArray(node.arguments,) ? node.arguments.filter(isTreeNode,) : [],
      },);
      /**
       Innermost enclosing clause whose binding the arguments name.
       */
      const scope = catches.findLast(function namesBinding(candidate,): boolean {
        return named.has(candidate.binding,);
      },);
      if ((scope !== undefined) || named.has('caughtValueText',)) {
        found.push({
          file: file.path,
          className,
          narrowedTo: (scope === undefined) ? [] : narrowingsOf(scope,),
        },);
      }
    }
    /**
     Clauses enclosing this node's children.
     */
    const inner = ((node.type === 'CatchClause') && isTreeNode(node.body,))
      ? [
        ...catches,
        {
          binding: identifierName({ node: node.param, },),
          body: node.body,
        },
      ]
      : catches;
    pending.push(...childNodes({ node, },)
      .map(function withScopes(child,) {
        return {
          node: child,
          catches: inner,
        };
      },),);
  }
  return found;
}

/**
 Sorts forwarding records into one comparable order.

 @param records - records to sort

 @returns Each as one line, sorted

 @example
 ```ts
 const lines = forwardingLines({ records: found, },);
 ```
 */
function forwardingLines({ records, }: { readonly records: readonly Forwarding[]; },): readonly string[] {
  return records
    .map(function line({
      file,
      className,
      narrowedTo,
    },): string {
      return `${file}: ${className} narrowed to [${narrowedTo.join(', ',)}]`;
    },)
    .toSorted();
}

//endregion Forwarded messages

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

    it({
      name: 'FINDS a marked class handed a caught error\'s text, with the classes its catch narrows to: '
        + 'unnarrowed, narrowed to a marked class, narrowed to another, through String of the binding, and '
        + 'through caughtValueText outside any catch; and leaves a catch that only logs, one handing the error '
        + 'on whole or reading its name, and an unmarked class',
      fn: async () => {
        /**
         One cat-themed file holding each shape, a function apiece. Each
         interpolation's `$` and `{` are split across a concatenation, so no
         plain string holds a whole placeholder, which lint reads as a
         template literal written by mistake.
         */
        const catFile: SourceText = {
          path: 'cat-refusals.ts',
          isTest: false,
          text: [
            'function nap() { try { purr(); } catch (error) { throw new MarkedError({ reason: `a nap: $'
              + '{caughtValueText(error,)}`, },); } }',
            'function knead() { try { purr(); } catch (error) { if (!(error instanceof PurrError)) throw error; '
              + 'throw new MarkedError({ reason: `a knead: $'
              + '{error.message}`, },); } }',
            'function stretch() { try { purr(); } catch (error) { if (!(error instanceof HissError)) throw error; '
              + 'throw new MarkedError({ reason: String(error,), },); } }',
            'function yawn(error: unknown) { return new MarkedError({ reason: caughtValueText(error,), },); }',
            'function doze() { try { purr(); } catch (error) { log(error,); throw new MarkedError({ reason: \'a doze\', },); } }',
            'function pounce() { try { purr(); } catch (error) { throw new MarkedError({ cause: error, kind: error.name, },); } }',
            'function groom() { try { purr(); } catch (error) { throw new PlainError({ reason: caughtValueText(error,), },); } }',
          ].join('\n',),
        };
        expect(forwardingLines({
          records: forwardingIn({
            file: catFile,
            marked: new Set(['MarkedError', 'PurrError',],),
          },),
        },),).toEqual([
          'cat-refusals.ts: MarkedError narrowed to [HissError]',
          'cat-refusals.ts: MarkedError narrowed to [PurrError]',
          'cat-refusals.ts: MarkedError narrowed to []',
          'cat-refusals.ts: MarkedError narrowed to []',
        ],);
      },
    },),

    it({
      name: 'FORWARDS A CAUGHT ERROR\'S TEXT into a marked class only at the listed sites, each narrowed to '
        + 'marked classes, and every listed site still forwards (ledger B34)',
      fn: async () => {
        /**
         Every non-test source file.
         */
        const files = (await readPackageSource()).filter(function isSource(file,): boolean {
          return !file.path.includes('.test.',);
        },);
        /**
         Every forwarding construction across them.
         */
        const found = files.flatMap(function inFile(file,): readonly Forwarding[] {
          return forwardingIn({
            file,
            marked: new Set(MARKED_CLASSES,),
          },);
        },);
        expect(forwardingLines({ records: found, },),).toEqual(forwardingLines({ records: FORWARDING_SITES, },),);
        expect(FORWARDING_SITES.flatMap(function unmarkedNarrowing(site,): readonly string[] {
          if (site.kind !== 'forwards')
            return [];
          return (site.narrowedTo.length === 0)
            ? [`${site.file}: forwards from an unnarrowed catch`,]
            : site.narrowedTo
              .filter(function isUnmarked(className,): boolean {
                return !MARKED_CLASSES.includes(className,);
              },)
              .map(function located(className,): string {
                return `${site.file}: narrowed to unmarked ${className}`;
              },);
        },),).toEqual([],);
      },
    },),
  ],
},);
