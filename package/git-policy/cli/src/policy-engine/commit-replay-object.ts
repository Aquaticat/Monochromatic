/**
 Raw commit objects as exact bytes: parsing, the unsigned replay rewrite, and signed-replay inputs.

 Replay keeps every byte the prepared commit carries except its `tree` and `parent` lines,
 so the message and headers are handled as bytes,
 never decoded text:
 a non-UTF-8 `encoding` commit round-trips unchanged.

 @module
 */
import { Buffer, } from 'node:buffer';

/**
 Byte ending each header line.
 */
const NEWLINE_BYTE = 0x0A;

/**
 Byte opening a header continuation line.
 */
const SPACE_BYTE = 0x20;

/**
 Headers a signed replay reproduces through `git commit-tree`; every other header is dropped there.
 */
const REBUILT_HEADERS: ReadonlySet<string> = new Set([
  'tree',
  'parent',
  'author',
  'committer',
  'encoding',
  'gpgsig',
  'gpgsig-sha256',
],);

/**
 Signature headers.
 */
const SIGNATURE_HEADERS: ReadonlySet<string> = new Set([
  'gpgsig',
  'gpgsig-sha256',
],);

/**
 One header with its continuation lines.
 */
export type RawCommitHeader = Readonly<{
  /**
   Header name before the first space.
   */
  name: string;
  /**
   Complete header bytes, continuation lines and final newline included.
   */
  bytes: Uint8Array;
}>;

/**
 Parsed raw commit.
 */
export type RawCommit = Readonly<{
  /**
   Headers in object order.
   */
  headers: readonly RawCommitHeader[];
  /**
   Message bytes after the blank line.
   */
  message: Uint8Array;
  /**
   Tree header value.
   */
  treeOid: string;
  /**
   `encoding` header value, absent for UTF-8.
   */
  encoding?: string;
  /**
   Whether a `gpgsig` or `gpgsig-sha256` header is present.
   */
  signed: boolean;
}>;

/**
 Text value of a single-line header, without the name and trailing newline.

 @param header - header

 @returns value text
 */
function headerValue(header: RawCommitHeader,): string {
  return Buffer.from(header.bytes,)
    .toString(
      'utf8',
      header.name
        .length
        + 1,
      header.bytes
        .length
        - 1,
    );
}

/**
 Splits header bytes into headers, joining continuation lines to the header they continue.

 @param headerBytes - header section, each line ending in a newline

 @returns headers in order
 */
function splitHeaders(headerBytes: Uint8Array,): readonly RawCommitHeader[] {
  /**
   Start offset of every line.
   */
  const lineStarts = [
    0,
    ...Array.from(
      headerBytes,
      function nextLineStart(
        byte,
        index,
      ): number {
        return (byte === NEWLINE_BYTE) && ((index + 1) < headerBytes.length) ? index + 1 : -1;
      },
    )
      .filter(function isLineStart(start,): boolean {
        return start !== (-1);
      },),
  ];
  /**
   Starts of lines that open a header rather than continue one.
   */
  const headerStarts = lineStarts.filter(function opensHeader(start,): boolean {
    return headerBytes[start] !== SPACE_BYTE;
  },);
  return headerStarts.map(function toHeader(
    start,
    index,
  ): RawCommitHeader {
    /**
     Header bytes up to the next header.
     */
    const bytes = headerBytes.subarray(
      start,
      headerStarts[index + 1] ?? headerBytes.length,
    );
    /**
     End of the header name.
     */
    const nameEnd = bytes.indexOf(SPACE_BYTE,);
    return {
      name: Buffer.from(bytes.subarray(
        0,
        nameEnd === (-1) ? bytes.length - 1 : nameEnd,
      ),)
        .toString('latin1',),
      bytes,
    };
  },);
}

/**
 Parses a raw commit object.

 @param bytes - `git cat-file commit` output

 @returns parsed commit

 @throws TypeError when the object has no `tree` header

 @example
 ```ts
 parseRawCommit(new TextEncoder().encode('tree abc\n\nmessage\n'));
 ```
 */
export function parseRawCommit(bytes: Uint8Array,): RawCommit {
  /**
   Header section end: the newline before the blank line.
   */
  const blank = Buffer.from(bytes,)
    .indexOf('\n\n',);
  /**
   Header section, each line newline-terminated.
   */
  const headerBytes = blank === (-1) ? bytes : bytes.subarray(
    0,
    blank + 1,
  );
  /**
   Parsed headers.
   */
  const headers = splitHeaders(headerBytes,);
  /**
   Tree header.
   */
  const tree = headers.find(function isTree(header,): boolean {
    return header.name === 'tree';
  },);
  if (tree === undefined)
    throw new TypeError('Commit object has no tree header.',);
  /**
   Encoding header.
   */
  const encoding = headers.find(function isEncoding(header,): boolean {
    return header.name === 'encoding';
  },);
  return {
    headers,
    message: blank === (-1) ? new Uint8Array() : bytes.subarray(blank + 2,),
    treeOid: headerValue(tree,),
    ...(encoding === undefined ? {} : { encoding: headerValue(encoding,), }),
    signed: headers.some(function isSignature(header,): boolean {
      return SIGNATURE_HEADERS.has(header.name,);
    },),
  };
}

/**
 Rewrites an unsigned commit onto a new tree and parent, keeping every other byte.

 @param commit - parsed prepared commit

 @param treeOid - replayed tree

 @param parentOid - new parent

 @returns raw commit bytes for `git hash-object -t commit -w --stdin`

 @example
 ```ts
 rewriteCommitObject({ commit, treeOid, parentOid });
 ```
 */
export function rewriteCommitObject({
  commit,
  treeOid,
  parentOid,
}: Readonly<{
  commit: RawCommit;
  treeOid: string;
  parentOid: string;
}>,): Uint8Array {
  return Buffer.concat([
    ...commit.headers
      .flatMap(function rewritten(header,): readonly Uint8Array[] {
        if (header.name === 'tree')
          return [Buffer.from(
            `tree ${treeOid}\nparent ${parentOid}\n`,
            'latin1',
          ),];
        return header.name === 'parent' ? [] : [header.bytes,];
      },),
    Buffer.from(
      '\n',
      'latin1',
    ),
    commit.message,
  ],);
}

/**
 Names of headers a signed replay drops, each once in object order.

 @param commit - parsed prepared commit

 @returns dropped header names

 @example
 ```ts
 droppedReplayHeaders(commit); // ['x-custom']
 ```
 */
export function droppedReplayHeaders(commit: RawCommit,): readonly string[] {
  return [
    ...new Set(commit.headers
      .map(function headerName(header,): string {
        return header.name;
      },)
      .filter(function isCustom(name,): boolean {
        return !REBUILT_HEADERS.has(name,);
      },),),
  ];
}

/**
 Git identity environment for one `author` or `committer` header, as `git commit-tree` reads it.

 @param commit - parsed prepared commit

 @param role - identity header

 @returns `GIT_<ROLE>_NAME`, `GIT_<ROLE>_EMAIL`, and `GIT_<ROLE>_DATE`

 @throws TypeError when the header is missing or malformed

 @example
 ```ts
 identityEnvironment({ commit, role: 'author' });
 // { GIT_AUTHOR_NAME: 'A', GIT_AUTHOR_EMAIL: 'a@example.com', GIT_AUTHOR_DATE: '@1700000000 +0000' }
 ```
 */
export function identityEnvironment({
  commit,
  role,
}: Readonly<{
  commit: RawCommit;
  role: 'author' | 'committer';
}>,): Readonly<Record<string, string>> {
  /**
   Identity header.
   */
  const header = commit.headers
    .find(function isRole(candidate,): boolean {
      return candidate.name === role;
    },);
  if (header === undefined)
    throw new TypeError(`Commit object has no ${role} header.`,);
  /**
   `Name <email> <seconds> <zone>`.
   */
  const value = headerValue(header,);
  /**
   Email delimiters.
   */
  const open = value.lastIndexOf('<',);
  /**
   Email end.
   */
  const close = value.indexOf(
    '>',
    open,
  );
  if ((open === (-1)) || (close === (-1)))
    throw new TypeError(`Commit ${role} header is malformed: ${JSON.stringify(value,)}`,);
  /**
   Environment variable prefix.
   */
  const prefix = `GIT_${role.toUpperCase()}`;
  return {
    [`${prefix}_NAME`]: value.slice(
      0,
      open,
    )
      .trimEnd(),
    [`${prefix}_EMAIL`]: value.slice(
      open + 1,
      close,
    ),
    [`${prefix}_DATE`]: `@${value.slice(close + 1,)
      .trim()}`,
  };
}
