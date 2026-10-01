/**
 Built payload composition behavior, including callback and serialization boundaries. @module
 */
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  forcePriorityPayload,
  PriorityRequestError,
} from '../dist/final/node/index.mjs';
import { createStreamFixtureModel, } from './stream-fixture.ts';

//region Callback composition: caller mutations and replacements precede priority enforcement.

await describe({
  name: '',
  children: [
    describe({
      name: forcePriorityPayload.name,
      children: [
        it({
          name: 'copies frozen native record without changing its fields or nested identities',
          fn: async () => {
            /** Nested caller data is retained without deep cloning. */
            const nested = { fixture: true, };
            /** Frozen native request cannot be mutated by priority enforcement. */
            const payload = Object.freeze({ model: 'base-model', service_tier: 'auto', nested, },);
            /** Enforced result retains all fields but overrides the caller tier. */
            const result = await forcePriorityPayload({ payload, model: createStreamFixtureModel(), },);
            expect(result,).toEqual({ model: 'base-model', service_tier: 'priority', nested, },);
            expect(result,).not.toBe(payload,);
            expect(result['nested'],).toBe(nested,);
            expect(payload.service_tier,).toBe('auto',);
            expect(JSON.parse(JSON.stringify(result,)),).toHaveProperty('service_tier', 'priority',);
          },
        },),
        it({
          name: 'awaits async undefined callback and preserves its original-record mutations',
          fn: async ctx => {
            /** Exact live model delivered to caller callback. */
            const model = createStreamFixtureModel();
            /** Caller callback owns intentional native request edits. */
            const payload: Record<string, unknown> = { model: model.id, service_tier: 'auto', };
            /** Spy verifies original identity, async completion, and single invocation. */
            const onPayload = ctx.sinon.spy(async (received: unknown, receivedModel: unknown) => {
              expect(received,).toBe(payload,);
              expect(receivedModel,).toBe(model,);
              await Promise.resolve();
              payload['caller_edit'] = 'retained';
              payload['service_tier'] = 'default';
              return undefined;
            },);
            /** Priority is applied only after async customization has settled. */
            const result = await forcePriorityPayload({ payload, model, onPayload, },);
            expect(onPayload,).toHaveBeenCalledExactlyOnceWith(payload, model,);
            expect(result,).toEqual({ model: model.id, caller_edit: 'retained', service_tier: 'priority', },);
            expect(payload['service_tier'],).toBe('default',);
          },
        },),
        it({
          name: 'awaits async replacement and does not merge or mutate the discarded original',
          fn: async () => {
            /** Original-only fields must not survive replacement semantics. */
            const payload = Object.freeze({ original_only: true, },);
            /** Replacement may be frozen and request a different service tier. */
            const replacement = Object.freeze({ replacement_only: true, service_tier: 'flex', },);
            /** Selected replacement receives priority after the callback resolves. */
            const result = await forcePriorityPayload({
              payload,
              model: createStreamFixtureModel(),
              onPayload: async () => await Promise.resolve(replacement,),
            },);
            expect(result,).toEqual({ replacement_only: true, service_tier: 'priority', },);
            expect(result,).not.toBe(replacement,);
            expect(result,).not.toHaveProperty('original_only',);
            expect(replacement.service_tier,).toBe('flex',);
            expect(payload,).toEqual({ original_only: true, },);
          },
        },),
        it({
          name: 'allows caller replacement to repair an invalid original before record validation',
          fn: async () => {
            /** Callback composition happens before validation of the selected record. */
            const result = await forcePriorityPayload({
              payload: null,
              model: createStreamFixtureModel(),
              onPayload: () => ({ repaired: true, }),
            },);
            expect(result,).toEqual({ repaired: true, service_tier: 'priority', },);
          },
        },),
        ...(['auto', 'default', 'flex', 'priority', undefined,] as const).map(tier => it({
          name: `forces priority after replacement requesting ${String(tier,)}`,
          fn: async () => {
            /** Caller tier is overwritten regardless of its requested value. */
            const result = await forcePriorityPayload({
              payload: { native: true, },
              model: createStreamFixtureModel(),
              onPayload: () => ({ service_tier: tier, caller: true, }),
            },);
            expect(result,).toEqual({ service_tier: 'priority', caller: true, },);
          },
        },),),
        //endregion Callback composition

        //region Rejections: invalid values never become best-effort normal requests.

        ...([
          { name: 'null', value: null, },
          { name: 'array', value: [] as readonly unknown[], },
          { name: 'string', value: 'invalid payload', },
          { name: 'number', value: 7, },
          { name: 'boolean', value: false, },
          { name: 'function', value: () => ({ service_tier: 'default', }), },
          { name: 'bigint', value: 1n, },
          { name: 'symbol', value: Symbol('invalid-payload'), },
          { name: 'date', value: new Date(0,), },
          { name: 'map', value: new Map<string, string>(), },
          { name: 'set', value: new Set<string>(), },
          { name: 'typed array', value: new Uint8Array(1,), },
        ] as const).map(invalid => it({
          name: `rejects async ${invalid.name} replacement with custom diagnostic`,
          fn: async ctx => {
            ctx.expect.assertions(2,);
            try {
              await forcePriorityPayload({
                payload: { valid_native: true, },
                model: createStreamFixtureModel(),
                onPayload: async () => await Promise.resolve(invalid.value,),
              },);
            }
            catch (error) {
              ctx.expect(error,).toBeInstanceOf(PriorityRequestError,);
              ctx.expect((error as Error).message,).toContain('Return an object from onPayload',);
            }
          },
        },),),
        ...([null, 'invalid native', [] as readonly unknown[],] as const).map((payload, index) => it({
          name: `rejects invalid native record ${String(index,)}`,
          fn: async ctx => {
            ctx.expect.assertions(1,);
            try {
              await forcePriorityPayload({ payload, model: createStreamFixtureModel(), },);
            }
            catch (error) {
              ctx.expect(error,).toBeInstanceOf(PriorityRequestError,);
            }
          },
        },),),
        ...(['sync', 'async',] as const).map(mode => it({
          name: `preserves exact ${mode} caller rejection without wrapping or fallback`,
          fn: async ctx => {
            ctx.expect.assertions(1,);
            /** Caller error identity survives callback composition. */
            const failure = new Error('stream fixture caller rejection',);
            try {
              await forcePriorityPayload({
                payload: { native: true, },
                model: createStreamFixtureModel(),
                onPayload: mode === 'sync' ? () => { throw failure; } : async () => { throw failure; },
              },);
            }
            catch (error) {
              ctx.expect(error,).toBe(failure,);
            }
          },
        },),),
        it({
          name: 'preserves non-Error async caller rejection',
          fn: async ctx => {
            ctx.expect.assertions(1,);
            /** Non-Error callback rejection remains owned by its caller. */
            const failure = { fixture_rejection: true, };
            try {
              await forcePriorityPayload({
                payload: {},
                model: createStreamFixtureModel(),
                onPayload: async () => { throw failure; },
              },);
            }
            catch (error) {
              ctx.expect(error,).toBe(failure,);
            }
          },
        },),
        it({
          name: 'rejects root toJSON replacement that would erase enforced priority during serialization',
          fn: async ctx => {
            ctx.expect.assertions(2,);
            try {
              await forcePriorityPayload({
                payload: {},
                model: createStreamFixtureModel(),
                onPayload: () => ({ toJSON: () => ({ service_tier: 'default', }), }),
              },);
            }
            catch (error) {
              ctx.expect(error,).toBeInstanceOf(PriorityRequestError,);
              ctx.expect((error as Error).message,).toContain('callable toJSON',);
            }
          },
        },),
        it({
          name: 'accepts null-prototype record replacements without losing caller data',
          fn: async () => {
            /** Null-prototype JSON record is valid without inherited serialization hooks. */
            const replacement = Object.create(null,) as Record<string, unknown>;
            replacement['fixture'] = 'retained';
            replacement['service_tier'] = 'default';
            Object.freeze(replacement,);
            /** Native replacement retains all enumerable fields while enforcing priority. */
            const result = await forcePriorityPayload({
              payload: {}, model: createStreamFixtureModel(), onPayload: () => replacement,
            },);
            expect(result,).toEqual({ fixture: 'retained', service_tier: 'priority', },);
            expect(replacement['service_tier'],).toBe('default',);
          },
        },),
        it({
          name: 'permits inert toJSON data without interfering with priority serialization',
          fn: async () => {
            /** Non-callable JSON field does not override object serialization. */
            const result = await forcePriorityPayload({
              payload: { toJSON: 'ordinary data', },
              model: createStreamFixtureModel(),
            },);
            expect(JSON.parse(JSON.stringify(result,)),).toEqual({ toJSON: 'ordinary data', service_tier: 'priority', },);
          },
        },),
        //endregion Rejections
      ],
    },),
  ],
},);
