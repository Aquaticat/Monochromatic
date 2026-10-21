/**
 Unit tests for the live-agent projection onto the review surface.
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type { Agent, } from '@deepseek-ai/dsh-agent';

import type { WorkingDirectoryService, } from '@deepseek-ai/dsh-working-directory';

import { toDshAdvisorAgentSurface, } from '../dist/final/node/index.mjs';

/**
 Options shape of the agent projection.
 */
type ProjectOptions = Parameters<typeof toDshAdvisorAgentSurface>[0];

await describe({
  name: toDshAdvisorAgentSurface.name,
  children: [
    it({
      name: 'projects session, cwd, and route identity onto the surface',
      fn: async () => {
        const appended: unknown[] = [];
        const session = {
          deriveMessages: () => [],
          append: (type: string, data: unknown): void => {
            appended.push([type, data,],);
          },
        };
        const surface = toDshAdvisorAgentSurface({
          agent: {
            session,
            options: {
              provider: 'route',
              model: 'model-id',
            },
          } as unknown as Agent,
          workingDirectory: {
            get: (): string => '/work/dir',
          } as unknown as ProjectOptions['workingDirectory'],
        },);
        expect(surface.cwd,).toBe('/work/dir',);
        expect(surface.options,).toEqual({
          provider: 'route',
          model: 'model-id',
        },);
        surface.appendOperationRecord({
          id: 'op-1',
        } as unknown as Parameters<typeof surface.appendOperationRecord>[0],);
        expect(appended.length,).toBe(1,);
      },
    },),
    it({
      name: 'omits absent route identity from the surface options',
      fn: async () => {
        const surface = toDshAdvisorAgentSurface({
          agent: {
            session: {
              deriveMessages: () => [],
            },
            options: {},
            whenIdle: () => Promise.resolve(),
          } as unknown as Agent,
          workingDirectory: {
            get: (): string => '/work/dir',
          } as unknown as ProjectOptions['workingDirectory'],
        },);
        expect(surface.options,).toEqual({},);
        await surface.whenIdle();
      },
    },),
  ],
},);
