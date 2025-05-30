import {
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import { logtapeGetLogger } from './logtape.shared.ts';

await logtapeConfigure(await logtapeConfiguration());

const l = logtapeGetLogger(['m', 'testLogger.index.ts']);

l.debug('testLogger.index.ts');
