import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  INLINE_NU_SCRIPT,
  buildNuCommand,
  quotePosixShellToken,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'inline Nu command',
  children: [
    it({
      name: 'quotes embedded single quotes as one POSIX shell token',
      fn: async () => {
        expect(quotePosixShellToken("a'b",),).toBe(String.raw`'a'\''b'`,);
      },
    },),
    it({
      name: 'builds a nu command without tsx or checked-in script path',
      fn: async () => {
        const command = buildNuCommand();

        expect(command,).toContain('nu -c',);
        expect(command,).toContain('MUTATION_TEST_FILES_JSON',);
        expect(command,).not.toContain('tsx',);
        expect(command,).not.toContain('.nu',);
      },
    },),
    it({
      name: 'sequences tests from environment JSON',
      fn: async () => {
        expect(INLINE_NU_SCRIPT,).toContain('from json',);
        expect(INLINE_NU_SCRIPT,).toContain('^node $test',);
        expect(INLINE_NU_SCRIPT,).toContain('exit $result.exit_code',);
      },
    },),
  ],
},);
