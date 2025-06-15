import { getVitestUnitWorkspace } from '@monochromatic-dev/config-vite';

import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UserConfigFnObject } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

const _default_1: UserConfigFnObject = getVitestUnitWorkspace(__dirname);
export default _default_1;
