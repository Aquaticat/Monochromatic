import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { isLiveRuleSetReady, } from '../dist/final/node/opensnitch-live.mjs';

await describe({
  name: 'OpenSnitch live-chain readiness',
  children: [
    it({
      name: 'accepts required port before application queue',
      fn: async () => {
        expect(isLiveRuleSetReady({
          output: 'udp dport 51820 accept\nqueue flags bypass to 0',
          requiredPorts: [51_820,],
          forbiddenPorts: [],
        },),).toBe(true,);
      },
    },),

    it({
      name: 'rejects required port after application queue',
      fn: async () => {
        expect(isLiveRuleSetReady({
          output: 'queue flags bypass to 0\nudp dport 51820 accept',
          requiredPorts: [51_820,],
          forbiddenPorts: [],
        },),).toBe(false,);
      },
    },),

    it({
      name: 'rejects stale forbidden port anywhere in chain',
      fn: async () => {
        expect(isLiveRuleSetReady({
          output: 'udp dport 2049 accept\nqueue flags bypass to 0',
          requiredPorts: [],
          forbiddenPorts: [2_049,],
        },),).toBe(false,);
      },
    },),

    it({
      name: 'rejects chain without application queue',
      fn: async () => {
        expect(isLiveRuleSetReady({
          output: 'udp dport 51820 accept',
          requiredPorts: [51_820,],
          forbiddenPorts: [],
        },),).toBe(false,);
      },
    },),
  ],
},);
