/**
 * Tests for configuration loading and system prompt building.
 *
 * Covers valibot schema validation, config merging, regex compilation,
 * and system prompt construction.
 */

import { mkdtemp, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  compilePatterns,
  loadMergedConfig,
} from './config.ts';
import { CONTEXT_ACTIVITY_FLOOR, } from './constants.ts';
import {
  BASE_SYSTEM_PROMPT,
  buildSystemPrompt,
  DEFAULT_DENY_GUIDANCE,
} from './system-prompt.ts';

await describe({
  name: 'config constants',
  children: [
    it({
      name: 'has expected constant values',
      fn: async () => {
        expect(CONTEXT_ACTIVITY_FLOOR,).toBe(5,);
      },
    },),

    it({
      name: 'uses defaults when no global or project config exists',
      fn: async function testAbsentConfigDefaults() {
        const root = await mkdtemp(join(
          tmpdir(),
          'auto-mode-config-test-',
        ),);
        const config = await loadMergedConfig({
          cwd: join(
            root,
            'project',
          ),
          home: join(
            root,
            'home',
          ),
        },);

        expect(config.enabled,).toBe(true,);
        expect(config.commands,).toEqual([],);
        expect(config.patterns,).toEqual([],);
        expect(config.judgeModel.strategy,).toBe('any-provider',);
      },
    },),
    it({
      name: 'DEFAULT_DENY_GUIDANCE mentions propose_trust',
      fn: async () => {
        expect(DEFAULT_DENY_GUIDANCE.includes('propose_trust',),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: buildSystemPrompt.name,
  children: [
    it({
      name: 'includes base prompt without instructions',
      fn: async () => {
        const prompt = buildSystemPrompt({},);
        expect(prompt.includes(BASE_SYSTEM_PROMPT,),).toBe(true,);
      },
    },),

    it({
      name: 'appends global instructions',
      fn: async () => {
        const prompt = buildSystemPrompt({
          globalInstructions: 'Always approve terraform commands',
        },);
        expect(prompt.includes('Always approve terraform commands',),).toBe(true,);
        expect(prompt.includes('User instructions (global):',),).toBe(true,);
      },
    },),

    it({
      name: 'appends project instructions',
      fn: async () => {
        const prompt = buildSystemPrompt({
          projectInstructions: 'Allow access to .env in this project',
        },);
        expect(prompt.includes('Allow access to .env in this project',),).toBe(true,);
        expect(prompt.includes('Project instructions:',),).toBe(true,);
      },
    },),

    it({
      name: 'instructs judge to use render_verdict tool',
      fn: async () => {
        const prompt = buildSystemPrompt({},);
        expect(prompt.includes('render_verdict',),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: compilePatterns.name,
  children: [
    it({
      name: 'compiles valid regex patterns',
      fn: async () => {
        const result = compilePatterns({
          patterns: [
            'sudo',
            'production',
          ],
          label: 'test',
        },);
        expect(result,).toHaveLength(2,);
        expect(result[0]?.test('run sudo apt-get',),).toBe(true,);
      },
    },),

    it({
      name: 'throws on invalid regex',
      fn: async () => {
        expect(() =>
          compilePatterns({
            patterns: ['[invalid',],
            label: 'test',
          },)
        )
          .toThrow();
      },
    },),

    it({
      name: 'returns empty array for empty input',
      fn: async () => {
        expect(compilePatterns({
          patterns: [],
          label: 'test',
        },),)
          .toHaveLength(0,);
      },
    },),
  ],
},);
