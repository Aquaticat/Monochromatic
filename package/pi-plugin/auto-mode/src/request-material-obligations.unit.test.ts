/**
 Built-artifact request-use accounting must not erase independent premises.

 @module
 */
import {
  consumeRequestMaterial,
  flushPolicyDiagnostics,
  retainRequestMaterialObligations,
} from '@monochromatic-dev/pi-plugin-auto-mode';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { createRequestMaterialFixture, } from './request-material-test-fixture.ts';

await describe({
  name: retainRequestMaterialObligations.name,
  children: [
    ...(['none', 'potential-instruction', 'unknown'] as const).map(function representedRelation(choice) {
      return it({ name: `represented ${choice} preserves every independent premise`, fn: async function representedUse() {
        /** Unit evidence models the native compiler's already authenticated result. */
        const f = createRequestMaterialFixture(choice);
        /** Original estimate is still admitted through its original model policy. */
        const interpretation = consumeRequestMaterial(f.options);
        /** Field coverage supplies no source authority or operation permission. */
        const governingUse = { request: f.request, state: 'represented-by-original-inputs' as const, permission: false as const };
        /** This premise must survive even when request use is represented. */
        const authority = { premise: 'instruction-authority-and-scope', kind: 'unregistered-source' };
        /** The consumer can discharge only the represented request-use obligation. */
        const result = retainRequestMaterialObligations({ issues: [authority], interpretation, governingUse });
        expect(result[0]).toBe(authority);
        expect(result).toHaveLength(choice === 'unknown' ? 2 : 1);
        if (choice === 'unknown') expect(result[1]?.kind).toBe('request-material-interpretation');
        expect(interpretation.permission).toBe(false);
        expect(governingUse.permission).toBe(false);
        expect(Object.isFrozen(governingUse)).toBe(false);
      } });
    }),
    it({ name: 'rejects represented use from another interpreted request', fn: async function foreignUse() {
      /** An equal-looking result cannot replace the original request occurrence. */
      const f = createRequestMaterialFixture('potential-instruction');
      /** The original interpretation retains the real fixture request. */
      const interpretation = consumeRequestMaterial(f.options);
      expect(function consumeForeignUse() {
        retainRequestMaterialObligations({ issues: [], interpretation,
          governingUse: { request: {}, state: 'represented-by-original-inputs', permission: false } });
      }).toThrow('Governing-use evidence belongs to another original interpreted request');
    } }),
    ...(['none', 'potential-instruction', 'unknown',] as const).map(function useCase(choice,) {
      return it({
        name: `${choice} retains the domain premise and independent existing issues`,
        fn: async function checkDomain() {
          const f = createRequestMaterialFixture(choice,);
          const interpretation = consumeRequestMaterial(f.options,);
          const domain = { premise: 'complete-governing-source-coverage-and-delegation', kind: 'request-source-domain', marker: {}, };
          const metadata = { premise: 'qualified-rule-interpretation', kind: 'tool-metadata-observation-gap', };
          const unrelated = { premise: 'complete-operation-coverage', };
          const issues = [domain, metadata, unrelated,];
          const result = retainRequestMaterialObligations({ issues, interpretation, },);
          expect(issues,).toEqual([domain, metadata, unrelated,],);
          expect(result[0],).toHaveProperty('kind', 'request-source-domain',);
          expect(result[0],).toHaveProperty('marker', domain.marker,);
          expect(result[0],).toHaveProperty('requestMaterialInterpretation', interpretation,);
          expect(Object.isFrozen(result[0],),).toBe(true,);
          expect(result[1],).toBe(metadata,);
          expect(result[2],).toBe(unrelated,);
          expect(Object.isFrozen(domain,),).toBe(false,);
          expect(Object.isFrozen(f.request,),).toBe(false,);
        },
      },);
    },),
    ...(['none', 'potential-instruction', 'unknown',] as const).map(function independentCase(choice,) {
      return it({
        name: `${choice} uses do not depend on a universal domain hold`,
        fn: async function checkIndependentUse() {
          const f = createRequestMaterialFixture(choice,);
          const interpretation = consumeRequestMaterial(f.options,);
          const result = retainRequestMaterialObligations({ issues: [], interpretation, },);
          expect(result.length,).toBe(choice === 'none' ? 0 : 1,);
          if (choice !== 'none') {
            expect(result[0],).toHaveProperty('kind', choice === 'potential-instruction' ? 'request-material-instruction-use' : 'request-material-interpretation',);
            expect(result[0],).toHaveProperty('request', f.request,);
            expect(result[0],).toHaveProperty('evidence', f.record,);
            expect(Object.isFrozen(result[0],),).toBe(true,);
          }
          expect(interpretation.permission,).toBe(false,);
        },
      },);
    },),
    it({
      name: 'abstention adds its own unresolved interpretation obligation',
      fn: async function checkAbstained() {
        const f = createRequestMaterialFixture();
        const interpretation = consumeRequestMaterial({ ...f.options, policy: { ...f.options.policy, accepts: () => false, }, },);
        const result = retainRequestMaterialObligations({ issues: [], interpretation, },);
        expect(result.length,).toBe(1,);
        expect(result[0],).toHaveProperty('kind', 'request-material-interpretation',);
        expect(result[0],).toHaveProperty('evidence', f.record,);
      },
    },),
  ],
},);
await flushPolicyDiagnostics();
