import {
  logtapeConfiguration,
  logtapeConfigure,
  onLoadRedirectingTo,
} from '@monochromatic-dev/module-es';
import {
  describe,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe(onLoadRedirectingTo, () => {
  test('placeholder test', () => {
    // TODO: Add actual tests for dom.redirectingTo
  });
},);
