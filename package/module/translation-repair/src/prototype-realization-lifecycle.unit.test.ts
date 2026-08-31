import { describe, it, } from '@monochromatic-dev/module-test/ts';

import {
  runRealizationNodeLifecycleControls,
  runRealizationRuntimeControls,
} from '../dist/final/node/prototype-realization.mjs';

await describe({
  name: 'Candidate G realization lifecycle',
  children: [
    it({
      name: 'restarts fixed provider-bound graph without duplicate or dynamic payloads',
      fn: runRealizationRuntimeControls,
    },),
    it({
      name: 'preserves exact abort and indeterminate transmission for both waves',
      fn: runRealizationNodeLifecycleControls,
    },),
  ],
},);
