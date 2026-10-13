/**
 Selects which wrapper the end-to-end suite puts first on `PATH`:
 the packed TypeScript wrapper (the incumbent) or the native executable.
 The scenarios, the invariant checker, and the report do not change with the selection;
 only the directory whose `git` shadows the real Git differs.

 @module
 */

import { open, } from 'node:fs/promises';
import { join, } from 'node:path';

/**
 Wrapper kinds the suite can drive.
 */
export type WrapperKind = 'incumbent' | 'native';

/**
 Directory holding the `git` of each wrapper kind inside the end-to-end image.
 The incumbent is the packed npm package installed under `/opt/cli-git`;
 the native directory is created by the native end-to-end image task, which links the release executable
 as `git` there (the Cargo artifact itself is named `cli-git-native` so it never shadows Git by accident).
 */
export const WRAPPER_BINS = {
  incumbent: '/opt/cli-git/node_modules/.bin',
  native: '/opt/native/bin',
} as const satisfies Readonly<Record<WrapperKind, string>>;

/**
 Error raised when `E2E_WRAPPER` names no wrapper kind.
 */
export class WrapperSelectionError extends Error {
  /**
   Creates the selection failure.

   @param message - names the rejected value and the accepted ones

   @param options - carries the underlying failure as `cause`

   @example
   ```ts
   throw new WrapperSelectionError('E2E_WRAPPER "x" is not one of incumbent, native');
   ```
   */
  constructor(
    message: string,
    options?: ErrorOptions,
  ) {
    super(
      message,
      options,
    );
    this.name = 'WrapperSelectionError';
  }
}

/**
 Parses the `E2E_WRAPPER` value.

 @param text - environment value, empty or absent for the incumbent so existing runs keep their meaning

 @returns the selected kind

 @throws {@link WrapperSelectionError} when the text is neither empty, `incumbent`, nor `native`

 @example
 ```ts
 parseWrapperKind('native'); // => 'native'
 parseWrapperKind(''); // => 'incumbent'
 ```
 */
export function parseWrapperKind(text: string,): WrapperKind {
  if ((text === '') || (text === 'incumbent')) {
    return 'incumbent';
  }
  if (text === 'native') {
    return 'native';
  }
  throw new WrapperSelectionError(
    `E2E_WRAPPER ${JSON.stringify(text,)} is not one of: incumbent, native (empty selects incumbent)`,
  );
}

/**
 Wrapper kind of this process, read once from `E2E_WRAPPER`.
 */
export const WRAPPER_KIND: WrapperKind = parseWrapperKind(process.env
  .E2E_WRAPPER
  ?? '',);

/**
 First bytes of an ELF executable.
 */
const ELF_MAGIC: Buffer = Buffer.from(
  '\u007FELF',
  'latin1',
);

/**
 First bytes of a script with an interpreter line.
 */
const SCRIPT_MAGIC: Buffer = Buffer.from(
  '#!',
  'latin1',
);

/**
 Reads the leading bytes of a file.

 @param path - file to open

 @param length - number of bytes wanted

 @returns up to `length` bytes from the start of the file

 @throws {@link WrapperSelectionError} when the file cannot be opened or read

 @example
 ```ts
 await readLeadingBytes({ path: '/opt/native/bin/git', length: 4, }); // => <Buffer 7f 45 4c 46>
 ```
 */
async function readLeadingBytes({
  path,
  length,
}: Readonly<{
  path: string;
  length: number;
}>,): Promise<Buffer> {
  try {
    /**
     Open file, closed when the block ends.
     */
    await using handle = await open(
      path,
      'r',
    );
    /**
     Destination for the leading bytes.
     */
    const head = Buffer.alloc(length,);
    /**
     Number of bytes actually read.
     */
    const { bytesRead, } = await handle.read(
      head,
      0,
      length,
      0,
    );
    return head.subarray(
      0,
      bytesRead,
    );
  } catch (error: unknown) {
    throw new WrapperSelectionError(
      `E2E_WRAPPER selected a wrapper, but ${path} cannot be read: ${String(error,)}`,
      { cause: error, },
    );
  }
}

/**
 Confirms that the `git` the scenarios will run is the selected kind of program,
 so a run labelled native can never silently drive the TypeScript wrapper, or the reverse.
 The native `git` resolves to an ELF executable;
 the incumbent's is a Node script that starts with a `#!` line.

 @param kind - selected wrapper kind

 @param bin - directory expected to hold the wrapper's `git`

 @returns one report line naming the kind and the verified executable

 @throws {@link WrapperSelectionError} when `git` is missing there or is the other kind of program

 @example
 ```ts
 await verifyWrapperExecutable({ kind: 'native', bin: '/opt/native/bin', }); // => 'wrapper=native /opt/native/bin/git (ELF executable)'
 ```
 */
export async function verifyWrapperExecutable({
  kind,
  bin,
}: Readonly<{
  kind: WrapperKind;
  bin: string;
}>,): Promise<string> {
  /**
   Wrapper path the scenarios resolve first on `PATH`.
   */
  const path = join(
    bin,
    'git',
  );
  /**
   First bytes, enough to tell an ELF executable from a script.
   */
  const head = await readLeadingBytes({
    path,
    length: ELF_MAGIC.length,
  },);
  /**
   Whether the file starts with the ELF magic.
   */
  const isElf = head.equals(ELF_MAGIC,);
  /**
   Whether the file starts with a script line.
   */
  const isScript = head.subarray(
    0,
    SCRIPT_MAGIC.length,
  )
    .equals(SCRIPT_MAGIC,);
  if ((kind === 'native') && (!isElf)) {
    throw new WrapperSelectionError(`E2E_WRAPPER selects native, but ${path} is not an ELF executable`,);
  }
  if ((kind === 'incumbent') && (!isScript)) {
    throw new WrapperSelectionError(`E2E_WRAPPER selects incumbent, but ${path} is not a script`,);
  }
  return `wrapper=${kind} ${path} (${kind === 'native' ? 'ELF executable' : 'Node script'})`;
}
