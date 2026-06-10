/**
 * Unit tests for Hetzner config: token requirement, server-type/location
 * resolution, and RFC 1123 name validation. No network.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  requireToken,
  resolveLocations,
  resolveServerType,
  validateHetznerName,
} from '@monochromatic-dev/cli-mvm/ts/backends/hetzner/config.ts';

/**
 * Sets an env var for the duration of a `using` scope, restoring it after.
 */
function withEnv(key: string, value?: string,): Disposable {
  const prior = process.env[key];
  if (value === undefined) {
    Reflect.deleteProperty(process.env, key,);
  }
  else {
    process.env[key] = value;
  }
  return {
    [Symbol.dispose]() {
      if (prior === undefined) {
        Reflect.deleteProperty(process.env, key,);
      }
      else {
        process.env[key] = prior;
      }
    },
  };
}

/**
 * Names whose final `mvm-<name>` is not a valid RFC 1123 hostname.
 */
const INVALID_NAMES = [
  '',
  'dev_01',
  '-dev',
  'dev-',
  'has.dot',
  'a'.repeat(64,),
];

await describe({
  name: 'hetzner config',
  concurrency: 1,
  children: [
    it({
      name: 'validateHetznerName accepts a valid hostname name',
      fn: async () => {
        expect(() => validateHetznerName('dev-01',),).not.toThrow();
        expect(() => validateHetznerName('build2',),).not.toThrow();
      },
    },),
    it({
      name: 'validateHetznerName rejects underscores, empty, hyphen edges, dots, and over-length',
      fn: async () => {
        for (const name of INVALID_NAMES) {
          expect(() => validateHetznerName(name,),).toThrow();
        }
      },
    },),
    it({
      name: 'resolveServerType prefers override, then env, then the default',
      fn: async () => {
        using _env = withEnv('MVM_HCLOUD_SERVER_TYPE', undefined,);
        expect(resolveServerType('cpx41',),).toBe('cpx41',);
        expect(resolveServerType(),).toBe('cx23',);
      },
    },),
    it({
      name: 'resolveServerType reads the env when no override is given',
      fn: async () => {
        using _env = withEnv('MVM_HCLOUD_SERVER_TYPE', 'ccx13',);
        expect(resolveServerType(),).toBe('ccx13',);
      },
    },),
    it({
      name: 'resolveLocations parses a comma series and trims spaces',
      fn: async () => {
        using _env = withEnv('MVM_HCLOUD_LOCATIONS', undefined,);
        expect(resolveLocations('ash, hil',),).toEqual(['ash', 'hil',],);
      },
    },),
    it({
      name: 'resolveLocations defaults to the three EU locations',
      fn: async () => {
        using _env = withEnv('MVM_HCLOUD_LOCATIONS', undefined,);
        expect(resolveLocations(),).toEqual(['fsn1', 'nbg1', 'hel1',],);
      },
    },),
    it({
      name: 'requireToken returns the token when set and throws when unset',
      fn: async () => {
        using _set = withEnv('HCLOUD_TOKEN', 'tok-123',);
        expect(requireToken(),).toBe('tok-123',);
      },
    },),
    it({
      name: 'requireToken throws a clear error when the token is missing',
      fn: async () => {
        using _unset = withEnv('HCLOUD_TOKEN', undefined,);
        expect(() => requireToken(),).toThrow('HCLOUD_TOKEN',);
      },
    },),
  ],
},);
