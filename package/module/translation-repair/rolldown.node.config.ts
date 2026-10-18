import { join, } from 'node:path';

import {
  copiedAssetsPlugin,
  nodeConfig,
} from '@monochromatic-dev/config-rolldown/.node.ts';

import { nodeEntries, } from './src/build-entries.ts';
import { CONFIG_FILE_NAME, } from './src/semantic-wrap-binary-constants.ts';

// The entry list, and why every runner is an entry, live in
// `src/build-entries.ts`, which the coverage build and the coverage census
// read too.

/**
 Normal Node build retains the repository's existing external-dependency policy.

 @example
 ```ts
 // Consumed by the ordinary package build task.
 ```
 */
const config: ReturnType<typeof nodeConfig> = nodeConfig({
  input: Object.fromEntries(nodeEntries,),
  extraPlugins: [copiedAssetsPlugin({
    files: [{
      source: join(
        import.meta.dirname,
        'src',
        CONFIG_FILE_NAME,
      ),
      fileName: CONFIG_FILE_NAME,
    },],
  },),],
},);

export default config;
