/**
 Verify action selection through the built package using independent distributions.

 @module
 */
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { admitsOperatingChoice, } from '../dist/final/node/index.mjs';

//region Recorded incident and exact user-selected uncertainty boundaries

/**
 Independently authored action distributions include supported and unresolved leaders.
 */
const cases = [
  { name: 'approves the recorded scoped commit', choice: 'approve', approve: 0.56, deny: 0.38, unknown: 0.06, accepted: true, },
  { name: 'admits a leading denial with low uncertainty', choice: 'deny', approve: 0.38, deny: 0.56, unknown: 0.06, accepted: true, },
  { name: 'admits a sub-majority leader with low uncertainty', choice: 'approve', approve: 0.46, deny: 0.45, unknown: 0.09, accepted: true, },
  { name: 'admits just below the uncertainty boundary', choice: 'approve', approve: 0.5, deny: 0.300001, unknown: 0.199999, accepted: true, },
  { name: 'asks at the uncertainty boundary below the action floor', choice: 'approve', approve: 0.599999, deny: 0.200001, unknown: 0.2, accepted: false, },
  { name: 'admits at both exact boundaries', choice: 'approve', approve: 0.6, deny: 0.2, unknown: 0.2, accepted: true, },
  { name: 'asks above the uncertainty boundary below the action floor', choice: 'deny', approve: 0.2, deny: 0.599999, unknown: 0.200001, accepted: false, },
  { name: 'admits denial at the action floor above the uncertainty boundary', choice: 'deny', approve: 0.1, deny: 0.6, unknown: 0.3, accepted: true, },
  { name: 'asks for a tied action with low uncertainty', choice: 'approve', approve: 0.45, deny: 0.45, unknown: 0.1, accepted: false, },
  { name: 'asks when unknown leads', choice: 'unknown', approve: 0.2, deny: 0.1, unknown: 0.7, accepted: false, },
  { name: 'rejects a selected action below its competitor', choice: 'deny', approve: 0.56, deny: 0.38, unknown: 0.06, accepted: false, },
] as const;

await describe({
  name: admitsOperatingChoice.name,
  children: cases.map(function actionCase({ name, choice, approve, deny, unknown, accepted, },) {
    return it({
      name,
      fn: async function followsUncertaintyRule() {
        expect(admitsOperatingChoice({
          value: { choice, probabilities: { approve, deny, unknown, }, },
          labels: ['approve', 'deny', 'unknown',],
        },),).toBe(accepted,);
      },
    },);
  },),
},);

//endregion User boundary behavior
