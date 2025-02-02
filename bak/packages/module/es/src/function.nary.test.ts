import { unary } from './function.nary.ts';

import {
  logtapeConfiguration,
  logtapeConfigure,
  suite,
  test,
} from '@monochromatic-dev/module-es/ts';

await logtapeConfigure(logtapeConfiguration());
