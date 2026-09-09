/** Synchronous live-scope snapshots shared by selection and final dispatch gates. @module */
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { NO_LIVE_SCOPE, readLiveScope, } from '../dist/final/node/index.mjs';

/** Complete structural model fixture. */
const model = {
  id: 'one', name: 'One', provider: 'fixture', api: 'faux', contextWindow: 4096, maxTokens: 1024,
  reasoning: false, baseUrl: 'https://example.invalid', input: ['text',] as const,
  cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, },
};

await describe({ name: readLiveScope.name, children: [
  it({ name: 'returns absence for unavailable or non-array live scope', fn: async (): Promise<void> => {
    expect(readLiveScope({},),).toBe(NO_LIVE_SCOPE,);
    expect(readLiveScope({ scopedModels: 'invalid', },),).toBe(NO_LIVE_SCOPE,);
  }, },),
  it({ name: 'normalizes raw and wrapped models and filters invalid entries', fn: async (): Promise<void> => {
    const scope = readLiveScope({ scopedModels: [model, { model, thinkingLevel: 'high', }, null, 2, {}, { model: null, },], },);
    expect(scope,).toEqual([
      { model, canonicalSlug: 'fixture/one', },
      { model, canonicalSlug: 'fixture/one', thinkingLevel: 'high', },
    ],);
  }, },),
  it({ name: 'preserves the existing authoritative empty-array behavior', fn: async (): Promise<void> => {
    expect(readLiveScope({ scopedModels: [], },),).toEqual([],);
  }, },),
  it({ name: 'getter overrides a stale property and is read on every invocation', fn: async (): Promise<void> => {
    const state = { entries: [model,], };
    const ctx = { scopedModels: [model,], getScopedModels: (): unknown => state.entries, };
    expect(readLiveScope(ctx,),).not.toBe(NO_LIVE_SCOPE,);
    state.entries = [];
    expect(readLiveScope(ctx,),).toEqual([],);
  }, },),
  ...['id', 'name', 'provider', 'api', 'contextWindow', 'maxTokens', 'cost',].map(key => it({
    name: `filters structurally invalid models missing ${key}`,
    fn: async (): Promise<void> => {
      const invalid: Record<string, unknown> = { ...model, };
      delete invalid[key];
      expect(readLiveScope({ scopedModels: [invalid,], },),).toEqual([],);
    },
  },)),
], },);
