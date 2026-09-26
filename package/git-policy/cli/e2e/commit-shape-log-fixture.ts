/**
 Parses `git log --raw --numstat -z` output into per-commit change records.

 Pure text processing:
 the host-side trace generator feeds it real Git output,
 and unit tests feed it constructed samples.

 @module
 */

//region Types

/**
 Raw diff status letters the parser keeps.
 Copies (`C`) and type changes (`T`) are recorded as their own statuses.
 */
export type RawChangeStatus = 'A' | 'C' | 'D' | 'M' | 'R' | 'T';

/**
 One path change of one commit, still carrying real paths and object IDs.
 */
export type ParsedChange = Readonly<{
  /**
   Diff status without the similarity score.
   */
  status: RawChangeStatus;
  /**
   Octal mode before the change, `000000` for additions.
   */
  srcMode: string;
  /**
   Octal mode after the change, `000000` for deletions.
   */
  dstMode: string;
  /**
   Blob ID before the change, all zeroes for additions.
   */
  srcOid: string;
  /**
   Blob ID after the change, all zeroes for deletions.
   */
  dstOid: string;
  /**
   Destination path, or deleted path for deletions.
   */
  path: string;
  /**
   Source path of a rename or copy.
   */
  fromPath?: string;
  /**
   Added line count, or `binary` when numstat reports `-`.
   */
  added: number | 'binary';
  /**
   Deleted line count, `0` for binary changes.
   */
  deleted: number;
}>;

/**
 One non-merge commit's changes in diff order.
 */
export type ParsedCommit = Readonly<{
  /**
   Changes against the first parent.
   */
  changes: readonly ParsedChange[];
}>;

/**
 Numstat record before it is paired with its raw record.
 */
type NumstatRecord = Readonly<{
  /**
   Destination path.
   */
  path: string;
  /**
   Added line count or binary marker.
   */
  added: number | 'binary';
  /**
   Deleted line count.
   */
  deleted: number;
}>;

/**
 Raw record before numstat pairing.
 */
type RawRecord = Omit<ParsedChange, 'added' | 'deleted'>;

//endregion Types

//region Errors

/**
 Git log text did not match the expected `--raw --numstat -z` layout.
 */
export class CommitShapeLogError extends Error {
  /**
   Creates a parse error naming the offending token.

   @param message - reason and token context

   @example
   ```ts
   throw new CommitShapeLogError('unexpected token');
   ```
   */
  constructor(message: string,) {
    super(message,);
    this.name = 'CommitShapeLogError';
  }
}

//endregion Errors

//region Parsing

/**
 Status per accepted raw status letter.
 */
const STATUS_BY_LETTER: Readonly<Record<string, RawChangeStatus>> = {
  A: 'A',
  C: 'C',
  D: 'D',
  M: 'M',
  R: 'R',
  T: 'T',
};

/**
 Field count of one raw record header (`:src dst srcOid dstOid status`).
 */
const RAW_FIELD_COUNT = 5;

/**
 Commit record separator emitted by `--format=%x1ecommit`.
 */
export const COMMIT_RECORD_SEPARATOR = '\u001E';

/**
 Parses one raw record header.

 @param token - header text starting with `:`

 @returns modes, object IDs, and status

 @throws {@link CommitShapeLogError} on malformed headers or unknown statuses

 @example
 ```ts
 parseRawHeader(':100644 100644 aaa bbb M');
 ```
 */
function parseRawHeader(token: string,): Omit<RawRecord, 'path' | 'fromPath'> {
  /**
   Space-separated header fields after the leading colon.
   */
  const fields = token.slice(1,)
    .split(' ',);
  if (fields.length !== RAW_FIELD_COUNT)
    throw new CommitShapeLogError(`raw header has ${String(fields.length,)} fields: ${token}`,);
  /**
   Modes, object IDs, and status field in Git's raw order.
   */
  const [srcMode = '', dstMode = '', srcOid = '', dstOid = '', statusField = '',] = fields;
  /**
   Status without similarity score.
   */
  const status = STATUS_BY_LETTER[statusField.charAt(0,)];
  if (status === undefined)
    throw new CommitShapeLogError(`unknown raw status ${statusField}`,);
  return {
    status,
    srcMode,
    dstMode,
    srcOid,
    dstOid,
  };
}

/**
 Parses one numstat count field.

 @param field - decimal count or `-`

 @returns count, or `binary` for `-`

 @throws {@link CommitShapeLogError} on non-numeric fields

 @example
 ```ts
 parseCount('12'); // => 12
 ```
 */
function parseCount(field: string,): number | 'binary' {
  if (field === '-')
    return 'binary';
  /**
   Parsed decimal count.
   */
  const count = Number(field,);
  if ((!Number.isSafeInteger(count,)) || (count < 0))
    throw new CommitShapeLogError(`numstat count is not a count: ${field}`,);
  return count;
}

/**
 Splits one commit record into raw and numstat records.

 @param tokens - NUL-separated tokens after the `commit` marker

 @returns raw and numstat records in emission order

 @throws {@link CommitShapeLogError} on truncated records

 @example
 ```ts
 splitRecords([':100644 100644 a b M', 'x.txt', '1\t0\tx.txt']);
 ```
 */
function splitRecords(tokens: readonly string[],): Readonly<{
  raws: readonly RawRecord[];
  numstats: readonly NumstatRecord[];
}> {
  /**
   Raw records collected in order.
   */
  const raws: RawRecord[] = [];
  /**
   Numstat records collected in order.
   */
  const numstats: NumstatRecord[] = [];
  // The cursor advances by one to three tokens per record, so it is a counter loop, not a map.
  for (let cursor = 0; cursor < tokens.length;) {
    /**
     Current token as emitted, possibly after Git's record newline.
     */
    const emitted = tokens[cursor] ?? '';
    /**
     Current token with Git's leading newline removed.
     */
    const token = emitted.startsWith('\n',) ? emitted.slice(1,) : emitted;
    cursor += 1;
    if (token === '')
      continue;
    if (token.startsWith(':',)) {
      /**
       Parsed header fields.
       */
      const header = parseRawHeader(token,);
      /**
       Whether the record carries a source path.
       */
      const twoPaths = (header.status === 'R') || (header.status === 'C');
      /**
       First path token.
       */
      const firstPath = tokens[cursor];
      /**
       Second path token for renames and copies.
       */
      const secondPath = twoPaths ? tokens[cursor + 1] : undefined;
      if ((firstPath === undefined) || (twoPaths && (secondPath === undefined)))
        throw new CommitShapeLogError(`raw record truncated after ${token}`,);
      cursor += twoPaths ? 2 : 1;
      raws.push(twoPaths
        ? {
          ...header,
          path: secondPath ?? '',
          fromPath: firstPath,
        }
        : {
          ...header,
          path: firstPath,
        },);
      continue;
    }
    /**
     Tab-separated numstat fields.
     */
    const [addedField = '', deletedField = '', pathField,] = token.split('\t',);
    if (pathField === undefined)
      throw new CommitShapeLogError(`numstat record malformed: ${token}`,);
    /**
     Deleted count, with binary reported as zero lines.
     */
    const deletedCount = parseCount(deletedField,);
    /**
     Destination path; renames put source and destination in the next tokens.
     */
    const numstatPath = pathField === '' ? tokens[cursor + 1] : pathField;
    if (numstatPath === undefined)
      throw new CommitShapeLogError(`numstat rename record truncated: ${token}`,);
    cursor += pathField === '' ? 2 : 0;
    numstats.push({
      path: numstatPath,
      added: parseCount(addedField,),
      deleted: deletedCount === 'binary' ? 0 : deletedCount,
    },);
  }
  return {
    raws,
    numstats,
  };
}

/**
 Parses complete `git log -z --format=%x1ecommit --raw --numstat --no-abbrev -M` output.

 @param text - exact Git output

 @returns commits in log order

 @throws {@link CommitShapeLogError} when raw and numstat records disagree

 @example
 ```ts
 parseCommitShapeLog('\u001Ecommit\0\n:000000 100644 0 a A\0x.txt\x001\t0\tx.txt\0');
 ```
 */
export function parseCommitShapeLog(text: string,): readonly ParsedCommit[] {
  return text
    .split(COMMIT_RECORD_SEPARATOR,)
    .filter(function nonEmptyRecord(record,) {
      return record !== '';
    },)
    .map(function parseCommitRecord(record,): ParsedCommit {
      /**
       NUL-separated tokens of this commit.
       */
      const [marker, ...tokens] = record.split('\0',);
      if (marker !== 'commit')
        throw new CommitShapeLogError(`commit record starts with ${String(marker,)}`,);
      /**
       Raw and numstat records of this commit.
       */
      const {
        raws,
        numstats,
      } = splitRecords(tokens,);
      if (raws.length !== numstats.length)
        throw new CommitShapeLogError(`raw has ${String(raws.length,)} records, numstat ${String(numstats.length,)}`,);
      return {
        changes: raws.map(function pairNumstat(
          raw,
          index,
        ): ParsedChange {
          /**
           Numstat record emitted in the same position.
           */
          const numstat = numstats[index];
          if (numstat?.path !== raw.path)
            throw new CommitShapeLogError(`numstat path ${String(numstat?.path,)} does not pair with ${raw.path}`,);
          return {
            ...raw,
            added: numstat.added,
            deleted: numstat.deleted,
          };
        },),
      };
    },);
}

//endregion Parsing
