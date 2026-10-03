import {
  describe,
  expect,
  expectTypeOf,
  it,
} from '@monochromatic-dev/module-test/ts';
import * as v from 'valibot';

import {
  ABSENT_GIT_VALUE,
  defineConfig,
  definePlugin,
  definePolicy,
  definePolicyOptions,
  type PolicyDefinition,
  type PolicyInput,
  type PolicyInputs,
  type PolicyInputsDeclaration,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'authoring API',
  children: [
    it({
      name: 'preserves Valibot schema identity and output inference',
      fn: async () => {
        const schema = v.object({
          suffix: v.string(),
        },);
        const options = definePolicyOptions(schema,);
        expect(options,).toBe(schema,);
        expect(v.parse(options, { suffix: '.ts', },),).toEqual({ suffix: '.ts', },);
      },
    },),
    it({
      name: 'preserves policy, plugin, and config identity',
      fn: async () => {
        const policy = {
          name: 'suffix',
          defaultSeverity: 'error',
          warnSafe: true,
          triggers: ['direct-check',],
          options: definePolicyOptions(v.object({ suffix: v.string(), },),),
          check: async () => [],
        } satisfies PolicyDefinition<{ readonly suffix: string }, 'suffix'>;
        const definedPolicy = definePolicy(policy,);
        const pluginInput = {
          name: 'example',
          policies: [definedPolicy,],
        } as const;
        const plugin = definePlugin(pluginInput,);
        const configInput = {
          plugins: {
            example: plugin,
          },
          policies: {
            'example/suffix': ['warn', { suffix: '.ts', },],
          },
        } as const;
        const config = defineConfig(configInput,);

        expect(definedPolicy,).toBe(policy,);
        expect(plugin,).toBe(pluginInput,);
        expect(config,).toBe(configInput,);
      },
    },),
    it({
      name: 'preserves an inputs declaration computed from typed options',
      fn: async () => {
        const policy = definePolicy({
          name: 'scanner',
          defaultSeverity: 'error',
          warnSafe: true,
          triggers: ['pre-forward',],
          options: definePolicyOptions(v.object({ executable: v.string(), },),),
          inputs: function inputs(options,): PolicyInputs {
            expectTypeOf(options.executable,).toEqualTypeOf<string>();
            return { external: [{ kind: 'executable', path: options.executable, },], };
          },
          check: async () => [],
        },);
        expect(definePolicy(policy,),).toBe(policy,);
        expectTypeOf<PolicyInputs>().toEqualTypeOf<'unrestricted' | Readonly<{ external: readonly PolicyInput[]; }>>();
        expectTypeOf<PolicyInputsDeclaration<undefined>>().toExtend<PolicyInputs | ((options: undefined) => PolicyInputs)>();
        expectTypeOf<PolicyInput>().toExtend<Readonly<{ kind: 'worktree' | 'executable' | 'revision' | 'env'; }>>();
      },
    },),
    it({
      name: 'exports one stable absence sentinel',
      fn: async () => {
        expect(typeof ABSENT_GIT_VALUE,).toBe('symbol',);
        expect(ABSENT_GIT_VALUE,).toBe(ABSENT_GIT_VALUE,);
      },
    },),
  ],
},);
