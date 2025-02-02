import {
  execa,
  type ExecaMethod,
} from 'execa';

/**
 @remarks
 Do explicitly include packageInfo.runtime when calling.

 Bad example, won't work across runtimes:
 ```ts
 await exec`index.js`;
 ```

 Good example, will work across node and bun:
 ```ts
 import { packageInfo } from '@monochromatic-dev/module-node/ts';
 await exec`${packageInfo.runtime} index.js`;
 ```
 */
export const exec: ExecaMethod<{
  timeout: 500;
  all: true;
  verbose: 'full';
}> = execa({
  timeout: 5000,
  all: true,
  verbose: 'full',
});

export type { Result as ExecaResult } from 'execa';
