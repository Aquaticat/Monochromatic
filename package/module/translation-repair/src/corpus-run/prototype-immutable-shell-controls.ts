// PROTOTYPE ONLY: Candidate D local control entry point.

import { runSlotLocalControls, } from '../prototype-slot-controls.ts';
import { runSlotRuntimeControls, } from '../prototype-slot-runtime-controls.ts';

runSlotLocalControls();
await runSlotRuntimeControls();
console.log('PROTOTYPE immutable shell local controls accepted');
