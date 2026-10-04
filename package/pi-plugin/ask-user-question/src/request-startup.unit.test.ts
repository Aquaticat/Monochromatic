import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { runStartupFixture, } from './request-startup.fixture.ts';

await describe({
  name: 'detached helper startup',
  children: [
    ...['normal', 'helper-removed-after-launch', 'runtime-removed', 'helper-missing-before-launch',].map(function startupScenario(scenario,) {
      return it({
        name: scenario,
        skip: (scenario === 'runtime-removed') && (process.platform !== 'linux'),
        fn: async () => {
          expect(await runStartupFixture(scenario,),).toContain(`verified ${scenario}`,);
        },
      },);
    },),
  ],
},);
