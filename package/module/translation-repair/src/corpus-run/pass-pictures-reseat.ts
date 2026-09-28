import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { PictureReaderSeating, } from '../picture-reader-seating.ts';
import type { SeatReadingClient, } from './run-seats-read.ts';

//region Picture reader re-seating
// THE PICTURE READINGS' PER-PICTURE HOOK (ledger X12), beside the lane
// contest's (`pass-contest-reseat.ts`), so a test can drive it with the
// reading rig the other phases' hooks are tested with.

/**
 Hook the picture readings call before each picture.

 @example
 ```ts
 const hooks: PicturesHooks = picturesHooksFor({ client, signal, l, },);
 ```
 */
export type PicturesHooks = {
  readonly beforePicture: () => Promise<PictureReaderSeating>;
};

/**
 Seating that keeps the readers the picture readings started on.

 @returns No readers, so the given ones stand

 @example
 ```ts
 const seating = await keepReaders();
 ```
 */
function keepReaders(): Promise<PictureReaderSeating> {
  return Promise.resolve({},);
}

/**
 Builds the picture readings' per-picture hook.

 @param _ - run client, entry abort and entry logger the re-seating will read

 @returns Per-picture reader, handing each picture the readers it runs on

 @example
 ```ts
 const hooks = picturesHooksFor({ client, signal, l, },);
 ```
 */
export function picturesHooksFor(
  _: {
    readonly client: SeatReadingClient;
    readonly signal: AbortSignal;
    readonly l: Logger;
  },
): PicturesHooks {
  return { beforePicture: keepReaders, };
}

//endregion Picture reader re-seating
