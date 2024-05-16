import type { PathLike } from 'node:fs';
import type { FileHandle } from 'node:fs/promises';

type Resolution = 'SUCCESS' | 'SKIP';

type Summary =
  | string
  | Buffer
  | State
  | PathLike
  | FileHandle
  | undefined
  | false
  | Summary[];

export type State =
  | [
    // What
    string,
    Resolution,
    Summary,
  ]
  | State[]
  | PromiseSettledResult<State>[];
