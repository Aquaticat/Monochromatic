/**
 Fingerprints of `executable` policy inputs and the file digest every file fingerprint uses.

 An executable resolves the way a spawn from the worktree root resolves its command:
 a path with a separator from the worktree root,
 otherwise the first executable file along `PATH`.

 @module
 */
import { createHash, } from 'node:crypto';
import { createReadStream, } from 'node:fs';
import {
  access,
  constants,
  lstat,
  realpath,
  stat,
} from 'node:fs/promises';
import {
  delimiter,
  isAbsolute,
  resolve,
  sep,
} from 'node:path';
import { pipeline, } from 'node:stream/promises';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 SHA-256 of a file's bytes, streamed.

 @param path - file

 @returns hex digest

 @example
 ```ts
 await fileDigest('/usr/bin/git');
 ```
 */
export async function fileDigest(path: string,): Promise<string> {
  /**
   Streaming hash.
   */
  const hash = createHash('sha256',);
  await pipeline(
    createReadStream(path,),
    hash,
  );
  return hash.digest('hex',);
}

/**
 Identity fields of a no-follow or followed stat.

 @param path - file

 @param follow - whether to follow a final symbolic link

 @returns device, inode, size, and modification time in nanoseconds

 @example
 ```ts
 await statIdentity({ path: '/usr/bin/git', follow: false });
 ```
 */
async function statIdentity({
  path,
  follow,
}: Readonly<{
  path: string;
  follow: boolean;
}>,): Promise<readonly string[]> {
  /**
   Exact stat.
   */
  const stats = follow
    ? await stat(
      path,
      { bigint: true, },
    )
    : await lstat(
      path,
      { bigint: true, },
    );
  return [
    String(stats.dev,),
    String(stats.ino,),
    String(stats.size,),
    String(stats.mtimeNs,),
  ];
}

/**
 Whether a path is an executable regular file, following links as `execvp` does.

 @param path - candidate

 @returns whether it can be executed

 @example
 ```ts
 await isExecutableFile('/usr/bin/git'); // true
 ```
 */
async function isExecutableFile(path: string,): Promise<boolean> {
  try {
    await access(
      path,
      constants.X_OK,
    );
    return (await stat(path,)).isFile();
  }
  catch (error: unknown) {
    l.debug(`${path} is not an executable file: ${caughtValueText(error,)}`,);
    return false;
  }
}

/**
 No executable file exists where a declared executable resolves.
 */
const EXECUTABLE_NOT_FOUND: unique symbol = Symbol('declared executable not found',);

/**
 Where an executable resolves from.
 */
export type ExecutableLocation = Readonly<{
  /**
   Worktree root, which relative paths and empty `PATH` entries resolve from.
   */
  repositoryRoot: string;
  /**
   Environment whose `PATH` names are looked up in.
   */
  environment: Readonly<NodeJS.ProcessEnv>;
}>;

/**
 Resolves an `executable` input the way a spawn from the worktree root resolves its command.

 @param location - where the executable resolves from

 @param path - declared path or name

 @returns resolved path, or {@link EXECUTABLE_NOT_FOUND} when no `PATH` entry holds an executable file of that name

 @example
 ```ts
 await resolveExecutable({ location, path: 'git' });
 ```
 */
async function resolveExecutable({
  location,
  path,
}: Readonly<{
  location: ExecutableLocation;
  path: string;
}>,): Promise<string | typeof EXECUTABLE_NOT_FOUND> {
  if (isAbsolute(path,) || path.includes('/',)
    || path.includes(sep,))
    return resolve(
      location.repositoryRoot,
      path,
    );
  /**
   `PATH` candidates in lookup order; an empty entry names the working directory.
   */
  const candidates = (location.environment
    .PATH
    ?? '').split(delimiter,)
    .map(function candidate(directory,): string {
      return resolve(
        location.repositoryRoot,
        directory,
        path,
      );
    },);
  /**
   Whether each candidate is executable, checked concurrently and read in lookup order.
   */
  const executable = await Promise.all(candidates.map(function check(candidate,): Promise<boolean> {
    return isExecutableFile(candidate,);
  },),);
  return candidates.find(function firstExecutable(
    _candidate,
    index,
  ): boolean {
    return executable[index] === true;
  },) ?? EXECUTABLE_NOT_FOUND;
}

/**
 Fingerprint of an `executable` input:
 the resolved path with its no-follow identity,
 the final target with its identity,
 and the target's digest.

 @param location - where the executable resolves from

 @param path - declared path or name

 @returns serialized fingerprint; a missing executable fingerprints as missing, so its appearance changes it

 @example
 ```ts
 await executableFingerprint({ location, path: 'git' });
 ```
 */
export async function executableFingerprint({
  location,
  path,
}: Readonly<{
  location: ExecutableLocation;
  path: string;
}>,): Promise<string> {
  /**
   Resolved path.
   */
  const resolved = await resolveExecutable({
    location,
    path,
  },);
  if ((typeof resolved) === 'symbol')
    return JSON.stringify(['missing',],);
  if (!(await isExecutableFile(resolved,)))
    return JSON.stringify([
      'missing',
      resolved,
    ],);
  /**
   Final target of every link.
   */
  const target = await realpath(resolved,);
  /**
   Identity and content, read concurrently.
   */
  const [link, targetIdentity, digest,] = await Promise.all([
    statIdentity({
      path: resolved,
      follow: false,
    },),
    statIdentity({
      path: target,
      follow: true,
    },),
    fileDigest(target,),
  ],);
  return JSON.stringify([
    resolved,
    link,
    target,
    targetIdentity,
    digest,
  ],);
}
